import { supabase } from "@/lib/supabase";
import { getLibraryItems } from "@/services/library";
import type { Json } from "@/types/database";
import type { LibraryListItem } from "@/types/library";
import type { LibraryShareDetail, LibraryShareFilters, LibraryShareSummary } from "@/types/libraryShare";

interface CreateLibraryShareResponse {
  id: string;
  title: string;
  item_count: number;
  created_at: string;
}

interface GetLibraryShareResponse {
  id: string;
  title: string;
  owner_display_name: string;
  filters: LibraryShareFilters;
  item_count: number;
  created_at: string;
  items: LibraryShareDetail["items"];
}

interface DirectLibraryShareRow {
  id: string;
  owner_user_id: string;
  title: string;
  filters: Json;
  content_ids: string[];
  item_count: number;
  created_at: string;
}

const SHARE_TABLE_MISSING_MESSAGE =
  "공유 테이블이 아직 DB에 없습니다. Supabase 마이그레이션 0012_library_shares.sql을 적용한 뒤 다시 시도해 주세요.";

export async function createLibraryShare(params: {
  title: string;
  filters: LibraryShareFilters;
  contentIds: string[];
}): Promise<LibraryShareSummary> {
  const body = {
    title: params.title,
    filters: params.filters,
    content_ids: params.contentIds
  };

  const { data, error } = await supabase.functions.invoke<CreateLibraryShareResponse>("create-library-share", { body });

  if (!error && data) return toLibraryShareSummary(data);

  if (error && shouldFallbackToDirectInsert(error.message)) {
    return createLibraryShareDirectly(params);
  }

  if (error) throw new Error(error.message);
  throw new Error("공유 링크 생성 응답이 비어 있습니다.");
}

function toLibraryShareSummary(data: CreateLibraryShareResponse): LibraryShareSummary {
  return {
    id: data.id,
    title: data.title,
    itemCount: data.item_count,
    createdAt: data.created_at
  };
}

function shouldFallbackToDirectInsert(message: string): boolean {
  return [
    "Failed to send a request to the Edge Function",
    "FunctionsFetchError",
    "NetworkError",
    "Load failed",
    "fetch"
  ].some((needle) => message.toLocaleLowerCase().includes(needle.toLocaleLowerCase()));
}

async function createLibraryShareDirectly(params: {
  title: string;
  filters: LibraryShareFilters;
  contentIds: string[];
}): Promise<LibraryShareSummary> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("공유 링크를 만들려면 로그인이 필요합니다.");

  const contentIds = Array.from(new Set(params.contentIds));
  if (!contentIds.length) throw new Error("공유할 작품이 없습니다.");

  const { data, error } = await supabase
    .from("library_shares")
    .insert({
      owner_user_id: user.id,
      title: normalizeShareTitle(params.title),
      filters: params.filters as unknown as Json,
      content_ids: contentIds,
      item_count: contentIds.length
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

  if (error && shouldFallbackToDirectInsert(error.message)) {
    return getLibraryShareDirectly(id);
  }

  if (error) throw new Error(toCreateShareErrorMessage(error.message));
  if (!data) throw new Error("공유 목록 응답이 비어 있습니다.");

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
    .select("id,owner_user_id,title,filters,content_ids,item_count,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(toCreateShareErrorMessage(error.message));
  if (!data) throw new Error("공유 링크가 만료되었거나 존재하지 않습니다.");

  const share = data as DirectLibraryShareRow;
  const allItems = await getLibraryItems("all");
  const itemsByContentId = new Map(allItems.map((item) => [item.content_id, item]));
  const items = share.content_ids
    .map((contentId) => itemsByContentId.get(contentId))
    .filter((item): item is LibraryListItem => Boolean(item));

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
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/share/${shareId}`;
  }

  return `/share/${shareId}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
}
