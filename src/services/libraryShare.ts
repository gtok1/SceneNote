import Constants from "expo-constants";
import { Platform, Share } from "react-native";

import { LIBRARY_SHARE_MAX_ITEMS, selectSharedLibraryRows } from "../../supabase/functions/_shared/libraryShare";
import { supabase } from "@/lib/supabase";
import { getLibraryItems } from "@/services/library";
import { getSessionUserId } from "@/services/sessionUser";
import { readBatchedRows } from "@/utils/batchedQuery";
import { resolveLibraryShareOrigin } from "@/utils/libraryShareUrl";
import {
  type LibraryShareAction,
  type LibraryShareErrorInfo,
  libraryShareErrorMessage,
  tooManyShareItemsMessage
} from "@/utils/libraryShareErrors";
import type { Json } from "@/types/database";
import type { LibraryListItem } from "@/types/library";
import type { CreateLibraryShareInput, LibraryShareDetail, LibraryShareFilters, LibraryShareSummary } from "@/types/libraryShare";

interface CreateLibraryShareResponse {
  id: string;
  title: string;
  item_count: number;
  created_at: string;
  scope?: string;
}

interface GetLibraryShareResponse {
  id: string;
  title: string;
  owner_display_name: string;
  filters: LibraryShareFilters;
  item_count: number;
  created_at: string;
  items: LibraryShareDetail["items"];
  contract_version?: string;
}

interface DirectLibraryShareRow {
  id: string;
  owner_user_id: string;
  title: string;
  filters: Json;
  content_ids: string[];
  library_item_ids: string[] | null;
  item_count: number;
  created_at: string;
}

interface OptionalWebShareNavigator {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
}

export type LibraryShareDeliveryResult = "shared" | "copied" | "ready";

const SHARE_TABLE_MISSING_MESSAGE =
  "공유 테이블이 아직 DB에 없습니다. Supabase 마이그레이션 0012_library_shares.sql을 적용한 뒤 다시 시도해 주세요.";

export async function createLibraryShare(params: CreateLibraryShareInput): Promise<LibraryShareSummary> {
  const libraryItemIds = params.libraryItemIds === undefined ? null : Array.from(new Set(params.libraryItemIds));
  const contentIds = Array.from(new Set(params.contentIds ?? []));
  const selection = libraryItemIds ?? contentIds;
  if (!selection.length) throw new Error("공유할 작품이 없습니다.");
  if (selection.length > LIBRARY_SHARE_MAX_ITEMS) throw new Error(tooManyShareItemsMessage(LIBRARY_SHARE_MAX_ITEMS));

  const body = {
    title: params.title,
    filters: params.filters,
    content_ids: contentIds,
    ...(libraryItemIds === null ? {} : { library_item_ids: libraryItemIds })
  };

  const { data, error } = await supabase.functions.invoke<CreateLibraryShareResponse>("create-library-share", { body });

  if (!error && data) {
    if (libraryItemIds !== null && data.scope !== "library-item-v1") {
      throw new Error("공유 서버가 아직 업데이트되지 않았어요. 잠시 후 다시 시도해 주세요.");
    }
    return toLibraryShareSummary(data);
  }

  if (error && shouldFallbackToDirectShare(error)) {
    return createLibraryShareDirectly({ ...params, contentIds, libraryItemIds });
  }

  if (error) throw new Error(await toShareFunctionErrorMessage(error, "create"));
  throw new Error("공유 링크 생성 응답이 비어 있습니다.");
}

async function toShareFunctionErrorMessage(error: unknown, action: LibraryShareAction): Promise<string> {
  const info = await readShareFunctionError(error);
  if (info.message && isMissingShareTableMessage(info.message)) return SHARE_TABLE_MISSING_MESSAGE;
  return libraryShareErrorMessage(info, action);
}

// supabase-js의 FunctionsHttpError는 context에 응답(Response)을 담는다. 본문의 { error, message, max_items }를 읽는다.
async function readShareFunctionError(error: unknown): Promise<LibraryShareErrorInfo> {
  const info: LibraryShareErrorInfo = { status: getFunctionHttpStatus(error), code: null, message: null, maxItems: null };
  const context = (error as { context?: { clone?: () => { json: () => Promise<unknown> } } } | null)?.context;
  if (typeof context?.clone !== "function") return info;

  try {
    const body = (await context.clone().json()) as { error?: unknown; message?: unknown; max_items?: unknown } | null;
    return {
      ...info,
      code: typeof body?.error === "string" ? body.error : null,
      message: typeof body?.message === "string" ? body.message : null,
      maxItems: typeof body?.max_items === "number" ? body.max_items : null
    };
  } catch {
    return info;
  }
}

function toLibraryShareSummary(data: CreateLibraryShareResponse): LibraryShareSummary {
  return {
    id: data.id,
    title: data.title,
    itemCount: data.item_count,
    createdAt: data.created_at
  };
}

function shouldFallbackToDirectShare(error: unknown): boolean {
  const status = getFunctionHttpStatus(error);
  if (status === 404) return true;

  const message = toFunctionErrorMessage(error);
  return [
    "Failed to send a request to the Edge Function",
    "FunctionsFetchError",
    "NetworkError",
    "Load failed",
    "Function not found",
    "404",
    "fetch"
  ].some((needle) => message.toLocaleLowerCase().includes(needle.toLocaleLowerCase()));
}

function getFunctionHttpStatus(error: unknown): number | null {
  const context = (error as { context?: { status?: unknown } | null } | null)?.context;
  return typeof context?.status === "number" ? context.status : null;
}

function toFunctionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function createLibraryShareDirectly(params: {
  title: string;
  filters: LibraryShareFilters;
  contentIds: string[];
  libraryItemIds: string[] | null;
}): Promise<LibraryShareSummary> {
  const { userId, error: userError } = await getSessionUserId();

  if (userError) throw new Error(userError.message);
  if (!userId) throw new Error("공유 링크를 만들려면 로그인이 필요합니다.");

  let contentIds = Array.from(new Set(params.contentIds));
  if (params.libraryItemIds !== null) {
    const owned = await readBatchedRows(params.libraryItemIds, (ids, from, to) => supabase
      .from("user_library_items").select("id,content_id").eq("user_id", userId)
      .in("id", ids).order("id").range(from, to));
    if (owned.error) throw new Error(owned.error.message);
    const byId = new Map((owned.data ?? []).map(item => [item.id, item.content_id]));
    if (params.libraryItemIds.some(id => !byId.has(id))) {
      throw new Error("공유할 작품을 확인하지 못했어요. 라이브러리를 새로고침해 주세요.");
    }
    contentIds = Array.from(new Set(params.libraryItemIds.map(id => byId.get(id)!)));
  }
  if (!contentIds.length) throw new Error("공유할 작품이 없습니다.");

  const { data, error } = await supabase
    .from("library_shares")
    .insert({
      owner_user_id: userId,
      title: normalizeShareTitle(params.title),
      filters: params.filters as unknown as Json,
      content_ids: contentIds,
      library_item_ids: params.libraryItemIds,
      item_count: params.libraryItemIds?.length ?? contentIds.length
    })
    .select("id,title,item_count,created_at")
    .single();

  if (error) throw new Error(toCreateShareErrorMessage(error.message));
  if (!data) throw new Error("공유 링크 생성 응답이 비어 있습니다.");

  return toLibraryShareSummary(data);
}

function toCreateShareErrorMessage(message: string): string {
  if (isMissingShareTableMessage(message)) return SHARE_TABLE_MISSING_MESSAGE;
  return message;
}

function isMissingShareTableMessage(message: string): boolean {
  return [
    "library_shares",
    "schema cache",
    "relation",
    "does not exist",
    "Could not find the table"
  ].some((needle) => message.toLocaleLowerCase().includes(needle.toLocaleLowerCase()));
}

function normalizeShareTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  return (title || "SceneNote 공유 목록").slice(0, 80);
}

export async function getLibraryShare(id: string): Promise<LibraryShareDetail> {
  const { data, error } = await supabase.functions.invoke<GetLibraryShareResponse>("get-library-share", {
    body: { id }
  });

  if (error && shouldFallbackToDirectShare(error)) {
    return getLibraryShareDirectly(id);
  }

  if (error) throw new Error(await toShareFunctionErrorMessage(error, "open"));
  if (!data) throw new Error("공유 목록 응답이 비어 있습니다.");
  if (data.contract_version !== "library-share-v2") {
    throw new Error("공유 서버가 아직 업데이트되지 않았어요. 잠시 후 다시 시도해 주세요.");
  }

  return {
    id: data.id,
    title: data.title,
    ownerDisplayName: data.owner_display_name,
    filters: data.filters,
    itemCount: data.item_count,
    createdAt: data.created_at,
    items: data.items
  };
}

async function getLibraryShareDirectly(id: string): Promise<LibraryShareDetail> {
  const { data, error } = await supabase
    .from("library_shares")
    .select("id,owner_user_id,title,filters,content_ids,library_item_ids,item_count,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(toCreateShareErrorMessage(error.message));
  if (!data) throw new Error("공유 링크가 만료되었거나 존재하지 않습니다.");

  const share = data as DirectLibraryShareRow;
  const allItems = await getLibraryItems("all");
  const rows = allItems.map(item => ({ ...item, id: item.library_item_id }));
  const items: LibraryListItem[] = selectSharedLibraryRows(rows, share.library_item_ids ?? null, share.content_ids)
    .map(({ id: _id, ...item }) => item);

  return {
    id: share.id,
    title: share.title,
    ownerDisplayName: "SceneNote",
    filters: share.filters as unknown as LibraryShareFilters,
    itemCount: items.length,
    createdAt: share.created_at,
    items
  };
}

export function buildLibraryShareUrl(shareId: string): string {
  const path = `/share?id=${encodeURIComponent(shareId)}`;
  return `${getLibraryShareOrigin()}${path}`;
}

export function getLibraryShareOrigin(): string {
  return resolveLibraryShareOrigin({
    platform: Platform.OS,
    configuredOrigin: Constants.expoConfig?.extra?.publicWebOrigin,
    webOrigin: typeof window !== "undefined" ? window.location?.origin : null
  });
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

export async function shareLibraryUrl(params: {
  title: string;
  url: string;
}): Promise<LibraryShareDeliveryResult> {
  if (Platform.OS !== "web") {
    const origin = getLibraryShareOrigin();
    if (new URL(params.url).origin !== origin || !params.url.startsWith(`${origin}/share?`)) {
      throw new Error("공유 링크 주소가 올바르지 않아요.");
    }
    const result = await Share.share({ title: params.title, message: params.url, url: params.url });
    return result.action === Share.dismissedAction ? "ready" : "shared";
  }
  if (typeof navigator !== "undefined") {
    const webNavigator = navigator as OptionalWebShareNavigator;
    if (webNavigator.share) {
      try {
        await webNavigator.share({
          title: params.title,
          text: "SceneNote 라이브러리 공유 목록",
          url: params.url
        });
        return "shared";
      } catch (error) {
        if (isShareCancelled(error)) return "ready";
      }
    }
  }

  return (await copyTextToClipboard(params.url)) ? "copied" : "ready";
}

function isShareCancelled(error: unknown): boolean {
  return typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError";
}
