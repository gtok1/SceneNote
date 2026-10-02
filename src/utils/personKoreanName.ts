import type { FavoritePerson, KoreanNameSource, PersonDetail } from "@/types/people";
import { formatPersonName, hasHangul, hasJapaneseScript, type PersonReadingStatus } from "@/utils/japaneseName";

export const KOREAN_NAME_MAX_LENGTH = 40;
export const KOREAN_NAME_RECHECK_DAYS = 30;
export const KOREAN_NAME_RESOLVE_BATCH = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeKoreanNameInput(
  value: string
): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return { ok: false, message: "한글 이름을 입력해 주세요." };
  if (hasJapaneseScript(normalized)) return { ok: false, message: "일본어 표기는 빼고 한글로만 입력해 주세요." };
  if (!hasHangul(normalized)) return { ok: false, message: "한글이 들어간 이름을 입력해 주세요." };
  if (Array.from(normalized).length > KOREAN_NAME_MAX_LENGTH) {
    return { ok: false, message: `${KOREAN_NAME_MAX_LENGTH}자 이하로 입력해 주세요.` };
  }
  return { ok: true, value: normalized };
}

export function koreanNameCaption(
  status: PersonReadingStatus,
  favorited: boolean
): { caption: string | null; actionLabel: string | null } {
  switch (status) {
    case "not_applicable":
      return { caption: null, actionLabel: null };
    case "provided":
      return { caption: null, actionLabel: favorited ? "한글 이름 고치기" : null };
    case "estimated":
      return { caption: "일본어 읽기를 자동으로 옮긴 한글 표기예요.", actionLabel: favorited ? "고치기" : null };
    case "user":
      return { caption: "직접 입력한 한글 이름이에요.", actionLabel: favorited ? "고치기" : null };
    case "missing":
      return favorited
        ? { caption: "한글 이름이 아직 없어요.", actionLabel: "한글 이름 넣기" }
        : { caption: "좋아하는 인물로 등록하면 한글 이름을 직접 넣을 수 있어요.", actionLabel: null };
  }
}

export function selectFavoritesNeedingKoreanName<T extends FavoritePerson>(favorites: readonly T[], now: Date): T[] {
  return favorites
    .filter((favorite) => {
      const status = formatPersonName(favorite).readingStatus;
      if (status !== "missing" && status !== "estimated") return false;
      if (favorite.name_ko_source === "user") return false;
      if (!favorite.name_ko_checked_at) return true;
      const checkedAt = Date.parse(favorite.name_ko_checked_at);
      return Number.isNaN(checkedAt) || now.getTime() - checkedAt >= KOREAN_NAME_RECHECK_DAYS * DAY_MS;
    })
    .slice(0, KOREAN_NAME_RESOLVE_BATCH);
}

export function missingKoreanNameNotice(favorites: readonly FavoritePerson[]): string | null {
  const count = favorites.filter((favorite) => formatPersonName(favorite).readingStatus === "missing").length;
  return count === 0 ? null : `한글 이름이 없는 인물 ${count}명은 인물 상세에서 이름을 넣을 수 있어요.`;
}

export function pickKoreanName(
  detail: Pick<PersonDetail, "name_ko" | "name_ko_source"> | null | undefined,
  favorite: Pick<FavoritePerson, "name_ko" | "name_ko_source"> | null | undefined
): { name_ko: string | null; name_ko_source: KoreanNameSource | null } {
  if (favorite?.name_ko_source === "user" && favorite.name_ko) {
    return { name_ko: favorite.name_ko, name_ko_source: "user" };
  }
  if (detail?.name_ko) return { name_ko: detail.name_ko, name_ko_source: detail.name_ko_source ?? null };
  if (favorite?.name_ko) return { name_ko: favorite.name_ko, name_ko_source: favorite.name_ko_source ?? null };
  return { name_ko: null, name_ko_source: null };
}
