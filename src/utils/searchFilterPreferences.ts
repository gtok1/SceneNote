import type { Json } from "../types/database";
import type { LibraryStatusFilter } from "../types/library";
import { normalizeYearFilter } from "./contentSort";
import { getGenreDisplayName } from "./genre";
import { createSearchFilterDraft, emptySearchFilters, type SearchFilterDraft, type SelectedSearchMediaType } from "./searchFilterDraft";

const MEDIA_TYPES: SelectedSearchMediaType[] = ["anime", "drama", "movie"];
const STATUSES = new Set<LibraryStatusFilter>(["all", "wishlist", "watching", "completed", "recommended", "not_recommended", "dropped"]);

/** Parse untrusted persisted JSON; never restore query text or another UI field. */
export function normalizeSavedSearchFilters(value: unknown): SearchFilterDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createSearchFilterDraft(emptySearchFilters);
  const raw = value as Record<string, unknown>;
  const mediaTypes = normalizeStrings(raw.mediaTypes);
  const selectedMediaTypes = MEDIA_TYPES.filter((type) => mediaTypes.includes(type));
  const year = typeof raw.year === "string" ? normalizeYearFilter(raw.year) : null;
  const status = typeof raw.statusFilter === "string" ? raw.statusFilter as LibraryStatusFilter : "all";
  return {
    mediaTypes: selectedMediaTypes.length === MEDIA_TYPES.length ? [] : selectedMediaTypes,
    genreFilters: [...new Set(normalizeStrings(raw.genreFilters)
      .filter((genre) => genre.toLowerCase() !== "all" && genre.length <= 60)
      .map(getGenreDisplayName))].sort((a, b) => a.localeCompare(b, "ko")).slice(0, 30),
    countryFilters: [...new Set(normalizeStrings(raw.countryFilters)
      .map((country) => country.toUpperCase()).filter((country) => /^[A-Z]{2}$/.test(country)))].sort().slice(0, 10),
    statusFilter: STATUSES.has(status) ? status : "all",
    year: year === null ? "" : String(year),
    sortOrder: raw.sortOrder === "oldest" ? "oldest" : "latest"
  };
}

export function serializeSearchFilters(filters: SearchFilterDraft): Json {
  return { version: 1, ...normalizeSavedSearchFilters(filters) };
}

/** Monotonic ownership survives React batching, including A → B → A in one render. */
export function getSearchAccountTransition(
  state: { accountUserId: string | null; accountRevision: number }, userId: string | null
) {
  if (state.accountUserId === userId) return null;
  return {
    ...createSearchFilterDraft(emptySearchFilters), query: "", filterUserId: null,
    accountUserId: userId, accountRevision: state.accountRevision + 1
  };
}

function normalizeStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.slice(0, 64).flatMap((item) => typeof item === "string" && item.trim()
    ? [item.normalize("NFKC").trim()] : []) : [];
}

/** Each mount/account activation has its own lifetime; A→B→A cannot revive A's old response. */
export function createSearchFilterPreferenceScope(userId: string | null, getActiveUserId: () => string | null) {
  let active = true;
  let writeInFlight = false;
  const isCurrent = () => active && userId !== null && getActiveUserId() === userId;
  return {
    isCurrent,
    isSaving: () => writeInFlight,
    close() { active = false; },
    async save<T>(write: () => Promise<T>, commit: (value: T) => void): Promise<T> {
      if (!isCurrent()) throw new Error("로그인한 계정의 필터를 먼저 불러와 주세요.");
      if (writeInFlight) throw new Error("필터를 저장하는 중입니다.");
      writeInFlight = true;
      try {
        const value = await write();
        if (!isCurrent()) throw new Error("계정이 변경되어 이전 계정의 필터는 이 화면에 적용하지 않았어요.");
        commit(value);
        return value;
      } finally { writeInFlight = false; }
    },
    hydrate<T>(value: T, commit: (value: T) => void): boolean {
      if (!isCurrent() || writeInFlight) return false;
      commit(value);
      return true;
    }
  };
}
