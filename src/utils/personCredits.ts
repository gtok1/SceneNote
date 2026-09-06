import type { SearchResult } from "@/types/content";
import type { LibraryListItem } from "@/types/library";
import type { PersonCredit } from "@/types/people";

export type PersonCreditFilter = "all" | "watched" | "library";
export type PersonWorkStatus = "wishlist" | "watching" | "completed";

export function createPersonCreditKey(
  credit: Pick<PersonCredit, "external_source" | "external_id">
): string {
  return `${credit.external_source}:${credit.external_id}`;
}

export function dedupeValidPersonCredits(credits: readonly PersonCredit[]): PersonCredit[] {
  const uniqueCredits = new Map<string, PersonCredit>();

  for (const credit of credits) {
    if (!credit.external_id.trim() || !credit.title.trim()) continue;
    const key = createPersonCreditKey(credit);
    if (!uniqueCredits.has(key)) uniqueCredits.set(key, credit);
  }

  return Array.from(uniqueCredits.values());
}

export function getPersonWorkStatus(item: LibraryListItem | undefined): PersonWorkStatus | null {
  if (!item) return null;
  if (item.statuses.includes("completed")) return "completed";
  if (item.statuses.includes("watching")) return "watching";
  if (item.statuses.includes("wishlist")) return "wishlist";

  // 추천/비추천 같은 보조 플래그만 남은 기존 데이터도 라이브러리 작품으로 취급한다.
  return "wishlist";
}

export function personCreditToSearchResult(credit: PersonCredit): SearchResult {
  return {
    external_source: credit.external_source,
    external_id: credit.external_id,
    content_type: credit.content_type,
    title_primary: credit.title,
    title_original: credit.original_title,
    poster_url: credit.poster_url,
    overview: null,
    air_year: credit.air_year,
    air_date: credit.air_date,
    has_seasons: credit.content_type !== "movie",
    episode_count: null
  };
}

export function parsePersonCreditFilter(value: string | string[] | undefined): PersonCreditFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "watched" || candidate === "library" ? candidate : "all";
}

function normalizeForCreditSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesPersonCreditQuery(credit: PersonCredit, query: string): boolean {
  const normalizedQuery = normalizeForCreditSearch(query);
  if (!normalizedQuery) return true;

  return [credit.title, credit.original_title, credit.role]
    .filter((value): value is string => Boolean(value))
    .some((value) => normalizeForCreditSearch(value).includes(normalizedQuery));
}
