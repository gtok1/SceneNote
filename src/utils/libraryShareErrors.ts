import { LIBRARY_SHARE_MAX_ITEMS } from "../../supabase/functions/_shared/libraryShare";

export interface LibraryShareErrorInfo {
  status: number | null;
  code: string | null;
  message: string | null;
  maxItems: number | null;
}

export type LibraryShareAction = "create" | "open";

const SHARE_ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// 메신저·복사 과정에서 링크 뒤에 괄호·마침표·공백이 붙거나 인코딩되는 경우가 있어 UUID 부분만 꺼낸다.
export function extractShareId(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // 잘못된 % 인코딩은 원문 그대로 검사한다.
  }
  return decoded.match(SHARE_ID_PATTERN)?.[0]?.toLowerCase() ?? null;
}

export function tooManyShareItemsMessage(maxItems: number): string {
  return `한 번에 최대 ${maxItems.toLocaleString("ko-KR")}개까지 공유할 수 있어요. 상태나 작품 유형 필터로 범위를 줄여 주세요.`;
}

// Edge Function의 영문 오류("Edge Function returned a non-2xx status code" 등)를 그대로 보여주지 않는다.
export function libraryShareErrorMessage(info: LibraryShareErrorInfo, action: LibraryShareAction): string {
  if (info.code === "TOO_MANY_ITEMS") {
    const fromMessage = Number(info.message?.match(/\d+/)?.[0]);
    const maxItems = info.maxItems ?? (Number.isFinite(fromMessage) && fromMessage > 0 ? fromMessage : LIBRARY_SHARE_MAX_ITEMS);
    return tooManyShareItemsMessage(maxItems);
  }
  if (info.status === 401 || info.code === "UNAUTHORIZED") {
    return "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.";
  }
  if (info.code === "EXPIRED" || info.status === 410) return "공유 기간이 끝난 링크예요.";
  if (action === "open" && (info.code === "NOT_FOUND" || info.status === 404)) {
    return "공유 링크가 만료되었거나 존재하지 않습니다.";
  }
  if (info.code === "INVALID_REQUEST") {
    return action === "create"
      ? "공유할 작품을 확인하지 못했어요. 라이브러리를 새로고침한 뒤 다시 시도해 주세요."
      : "공유 링크 주소가 올바르지 않아요. 링크가 잘리지 않았는지 확인해 주세요.";
  }
  return action === "create"
    ? "공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요."
    : "공유 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
}
