import { compactSearchResults, getSearchResultKey } from "../../_shared/searchResultMerge.ts";
import type { AdapterSearchResponse, SearchResult } from "./types.ts";

const MAX_QUERY_VARIANTS = 5;

export interface SearchQueryVariant {
  query: string;
  matchMode: "direct" | "compact-title" | "relaxed-words";
  compactQuery: string;
  /** Only relaxed variants carry words for result filtering and cache scoping. */
  words?: readonly string[];
}

export interface SeasonQuery {
  baseQuery: string;
  seasonNumber: number;
}

export function searchResultIdentity(result: Pick<SearchResult, "external_source" | "external_id" | "season_number"> & Partial<Pick<SearchResult, "content_type">>): string {
  return `${result.external_source}:${result.external_id}:${result.season_number ?? "whole"}`;
}

export function annotateFilterMatches(
  all: readonly SearchResult[], matched: readonly SearchResult[], hasFilters: boolean
): { results: SearchResult[]; filteredOutCount: number } {
  if (!hasFilters) return { results: [...all], filteredOutCount: 0 };
  const matchedByIdentity = new Map(matched.map(result => [getSearchResultKey(result), result]));
  let filteredOutCount = 0;
  const results = all.map(result => {
    const match = matchedByIdentity.get(getSearchResultKey(result));
    if (match) return { ...match, filter_match: true };
    filteredOutCount += 1;
    return { ...result, filter_match: false };
  });
  return { results, filteredOutCount };
}

export function filterResponseForVariant(
  response: AdapterSearchResponse, variant: SearchQueryVariant
): AdapterSearchResponse {
  if (variant.matchMode === "relaxed-words") {
    const results = filterResultsByRelaxedWords(response.results, variant.words ?? []);
    return { ...response, results, total: results.length };
  }
  if (variant.matchMode !== "compact-title") return response;
  const results = filterResultsByCompactQuery(response.results, variant.compactQuery);
  return { ...response, results, total: results.length };
}

export function compactResults(results: SearchResult[]): SearchResult[] {
  return compactSearchResults(results);
}

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

export function parseSeasonQuery(query: string): SeasonQuery | null {
  const match = /(?:시즌\s*(\d+)|(\d+)\s*[기期])\s*$/.exec(query.trim());
  if (!match) return null;

  const seasonNumber = Number.parseInt(match[1] ?? match[2] ?? "", 10);
  if (seasonNumber < 2 || seasonNumber > 9) return null;

  const baseQuery = query.slice(0, match.index).trim();
  return baseQuery.length >= 2 ? { baseQuery, seasonNumber } : null;
}

export function createSearchQueryVariants(query: string): SearchQueryVariant[] {
  const collapsed = collapseWhitespace(query);
  const compacted = compactSearchText(collapsed);
  const variants: SearchQueryVariant[] = [];
  const seen = new Set<string>();

  const addVariant = (query: string, matchMode: SearchQueryVariant["matchMode"]) => {
    const normalized = collapseWhitespace(query);
    if (!normalized) return;
    if (matchMode === "compact-title" && (normalized === collapsed || normalized === compacted)) return;

    const key = `${matchMode}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({ query: normalized, matchMode, compactQuery: compacted });
  };

  addVariant(collapsed, "direct");

  if (compacted && compacted !== collapsed) {
    addVariant(compacted, "direct");
  }

  for (const hint of createKoreanSpacingHints(compacted)) {
    addVariant(hint, "direct");
  }

  for (const anchor of createKoreanAnchorQueries(compacted)) {
    addVariant(anchor, "compact-title");
  }

  return variants.slice(0, MAX_QUERY_VARIANTS);
}

export function compactSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

export function filterResultsByCompactQuery(results: SearchResult[], compactQuery: string): SearchResult[] {
  if (!compactQuery) return results;

  const titleMatches = (result: SearchResult) =>
    [result.title_primary, result.title_original, ...(result.match_titles ?? [])].some((title) => {
      if (!title) return false;
      const compactTitle = compactSearchText(title);
      return compactTitle.includes(compactQuery) || compactQuery.includes(compactTitle);
    });

  // Expanded seasons follow their base in the same list (docs/67).
  // A season search can replace the base, so keep seasons without it (docs/15 RC-4).
  const baseVerdicts = new Map<string, boolean>();
  for (const result of results) {
    if (result.matched_via === "season_relation") continue;
    const key = `${result.external_source}:${result.external_id}`;
    baseVerdicts.set(key, baseVerdicts.get(key) === true || titleMatches(result));
  }

  return results.filter((result) => {
    if (result.matched_via !== "season_relation") return titleMatches(result);
    if (titleMatches(result)) return true;
    const baseVerdict = result.resolved_from_id
      ? baseVerdicts.get(`${result.external_source}:${result.resolved_from_id}`)
      : undefined;
    return baseVerdict !== false;
  });
}

export function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createKoreanSpacingHints(compactedQuery: string): string[] {
  if (
    compactedQuery.length < 4 ||
    /\s/.test(compactedQuery) ||
    !/[가-힣]/.test(compactedQuery)
  ) {
    return [];
  }

  const hints: string[] = [];
  const multiCharacterParticles = ["에서", "에게", "으로", "부터", "까지", "처럼", "하고"];
  const spacingAfterParticles = ["의", "와", "과", "는", "은", "이", "가", "를", "을"];

  for (const particle of multiCharacterParticles) {
    const index = compactedQuery.indexOf(particle);
    if (index <= 0 || index + particle.length >= compactedQuery.length) continue;
    hints.push(`${compactedQuery.slice(0, index + particle.length)} ${compactedQuery.slice(index + particle.length)}`);
    if (hints.length >= MAX_QUERY_VARIANTS - 1) return hints;
  }

  for (let index = 1; index < compactedQuery.length - 1; index += 1) {
    const character = compactedQuery[index];
    if (!character || !spacingAfterParticles.includes(character)) continue;
    hints.push(`${compactedQuery.slice(0, index + 1)} ${compactedQuery.slice(index + 1)}`);
    if (hints.length >= MAX_QUERY_VARIANTS - 1) break;
  }

  return hints;
}

function createKoreanAnchorQueries(compactedQuery: string): string[] {
  if (compactedQuery.length < 4 || !/[가-힣]/.test(compactedQuery)) {
    return [];
  }

  const anchors = new Set<string>();

  for (const hint of createKoreanSpacingHints(compactedQuery)) {
    const [firstPart] = hint.split(" ");
    if (firstPart && firstPart.length >= 2) {
      anchors.add(firstPart);
    }
  }

  const koreanPrefix = compactedQuery.match(/^[가-힣]+/)?.[0] ?? "";
  if (koreanPrefix.length >= 5) {
    anchors.add(koreanPrefix.slice(0, 3));
  } else if (koreanPrefix.length === 4) {
    anchors.add(koreanPrefix.slice(0, 2));
    anchors.add(koreanPrefix.slice(1));
  } else if (compactedQuery.length >= 4) {
    anchors.add(compactedQuery.slice(0, Math.min(3, compactedQuery.length - 1)));
  }

  return Array.from(anchors);
}

export const MAX_WORD_SPLIT_VARIANTS = 4;
export const WORD_SPLIT_MIN_REMAINING_MS = 3_000;

// TMDB matches whole words; only the last word permits prefix matches (docs/55 §2.1).
export function createKoreanWordSplitVariants(
  query: string, existing: readonly SearchQueryVariant[] = []
): SearchQueryVariant[] {
  const compactQuery = compactSearchText(collapseWhitespace(query));
  const chars = Array.from(compactQuery);
  // Composing jamo cannot match a title; NFKC maps U+3131 to U+1100.
  if (!/[가-힣]/.test(compactQuery) || /[ᄀ-ᇿ㄰-㆏]/.test(compactQuery)) return [];
  const seen = new Set(existing.map(variant => variant.query));
  const variants: SearchQueryVariant[] = [];
  for (let k = 1; k <= Math.min(MAX_WORD_SPLIT_VARIANTS, chars.length - 1); k += 1) {
    const text = `${chars.slice(0, k).join("")} ${chars[k]}`;
    if (seen.has(text)) continue;
    seen.add(text);
    variants.push({ query: text, matchMode: "compact-title", compactQuery });
  }
  return variants;
}

export type WordSplitFallbackReason = "run" | "page" | "no_tmdb" | "not_eligible" | "has_match" | "time";
export function planKoreanWordSplitFallback(input: {
  query: string;
  page: number;
  sources: readonly string[];
  remainingMs: number;
  primaryVariants: readonly SearchQueryVariant[];
  primaryResults: readonly SearchResult[];
}): { variants: SearchQueryVariant[]; reason: WordSplitFallbackReason } {
  if (input.page !== 1) return { variants: [], reason: "page" };
  if (!input.sources.includes("tmdb")) return { variants: [], reason: "no_tmdb" };
  const q = compactSearchText(collapseWhitespace(input.query));
  // Composing jamo cannot match a title; NFKC maps U+3131 to U+1100.
  if (!/[가-힣]/.test(q) || /[ᄀ-ᇿ㄰-㆏]/.test(q)) return { variants: [], reason: "not_eligible" };
  if (filterResultsByCompactQuery([...input.primaryResults], q).length > 0) return { variants: [], reason: "has_match" };
  if (input.remainingMs < WORD_SPLIT_MIN_REMAINING_MS) return { variants: [], reason: "time" };
  const variants = createKoreanWordSplitVariants(input.query, input.primaryVariants);
  return { variants, reason: variants.length ? "run" : "not_eligible" };
}

export const ANIME_FOLLOW_UP_MAX = 2;
export const ANIME_FOLLOW_UP_MIN_REMAINING_MS = 2_500;
export type AnimeFollowUpReason = "run" | "no_fallback" | "no_anilist" | "no_anime" | "time";

export function planAniListAnimeFollowUp(input: {
  query: string;
  fallbackRan: boolean;
  sources: readonly string[];
  remainingMs: number;
  fallbackResults: readonly SearchResult[];
  primaryVariants: readonly SearchQueryVariant[];
}): { variants: SearchQueryVariant[]; reason: AnimeFollowUpReason } {
  if (!input.fallbackRan) return { variants: [], reason: "no_fallback" };
  if (!input.sources.includes("anilist")) return { variants: [], reason: "no_anilist" };
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const item of input.fallbackResults) {
    if (item.external_source !== "tmdb" || item.content_type !== "anime" || !/[가-힣]/.test(item.title_primary)) continue;
    const identity = compactSearchText(item.title_primary);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (input.primaryVariants.some(variant => variant.query === item.title_primary)) continue;
    titles.push(item.title_primary);
    if (titles.length >= ANIME_FOLLOW_UP_MAX) break;
  }
  if (!titles.length) return { variants: [], reason: "no_anime" };
  if (input.remainingMs < ANIME_FOLLOW_UP_MIN_REMAINING_MS) return { variants: [], reason: "time" };
  const compactQuery = compactSearchText(collapseWhitespace(input.query));
  return {
    reason: "run",
    variants: titles.map(title => ({ query: collapseWhitespace(title), matchMode: "compact-title", compactQuery }))
  };
}

export const MAX_RELAXED_WORDS = 6;
export const MAX_RELAXED_CORE_WORDS = 3;
export const MAX_RELAXED_STEM_QUERIES = 2;
export const MAX_RELAXED_WORD_VARIANTS = 4;
export const RELAXED_WORD_MIN_REMAINING_MS = 2_500;

const KOREAN_WORD_ENDINGS = [
  "당했던", "당하는", "당하던", "당한다", "되었던", "시키는", "스러운",
  "당한", "당할", "되는", "되던", "된다", "됐던", "시킨", "받는", "받은", "하는", "하던",
  "했던", "한다", "로운", "다운", "적인", "에서", "에게", "으로", "까지", "부터", "처럼",
  "된", "될", "한", "할", "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "로", "만"
];

export function extractRelaxedSearchWords(query: string): string[] {
  const words = new Set<string>();
  for (const token of query.normalize("NFKC").toLocaleLowerCase().split(/[\s\p{P}\p{S}]+/u)) {
    if (Array.from(token).length < 2) continue;
    words.add(token);
    if (words.size === MAX_RELAXED_WORDS) break;
  }
  return [...words];
}

export function koreanWordStem(word: string): string {
  if (!/[가-힣]$/.test(word)) return word;
  for (const ending of KOREAN_WORD_ENDINGS) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, -ending.length);
    if (Array.from(stem).length >= 2) return stem;
  }
  return word;
}

// TMDB requires whole-word matches except for a prefix in the last position,
// so place core words first and an optional stem last (docs/66 D-3).
export function createKoreanRelaxedWordVariants(
  query: string, existing: readonly SearchQueryVariant[] = []
): SearchQueryVariant[] {
  const words = extractRelaxedSearchWords(query);
  if (words.length < 2) return [];

  const compactQuery = compactSearchText(collapseWhitespace(query));
  const stems = words.map(koreanWordStem);
  const core = words.filter((word, index) => stems[index] === word).slice(0, MAX_RELAXED_CORE_WORDS);
  const inflected = stems.filter((stem, index) => stem !== words[index]);
  const candidates: string[] = [];
  if (core.length) {
    const coreQuery = core.join(" ");
    const stemQueries = inflected.filter(stem => !core.includes(stem)).slice(0, MAX_RELAXED_STEM_QUERIES);
    candidates.push(...stemQueries.map(stem => `${coreQuery} ${stem}`), coreQuery);
    if (core.length >= 2) {
      candidates.push(...core.map((_, index) => core.filter((_, other) => other !== index).join(" ")));
    }
  } else {
    candidates.push(...inflected);
  }

  const seen = new Set(existing.map(variant => variant.query));
  const variants: SearchQueryVariant[] = [];
  for (const text of candidates) {
    if (seen.has(text)) continue;
    seen.add(text);
    variants.push({ query: text, matchMode: "relaxed-words", compactQuery, words });
    if (variants.length === MAX_RELAXED_WORD_VARIANTS) break;
  }
  return variants;
}

function relaxedSearchTitles(result: SearchResult): string[] {
  return [result.title_primary, result.title_original, result.series_title, ...(result.match_titles ?? [])]
    .filter((title): title is string => Boolean(title))
    .map(compactSearchText);
}

export function filterResultsByRelaxedWords(results: SearchResult[], words: readonly string[]): SearchResult[] {
  if (words.length < 2) return [];
  const forms = words.map(word => new Set([compactSearchText(word), compactSearchText(koreanWordStem(word))]));
  const minimumMatches = Math.max(2, Math.ceil(words.length * 2 / 3));
  return results.filter(result => {
    const titles = relaxedSearchTitles(result);
    const matches = forms.filter(wordForms => [...wordForms].some(form => titles.some(title => title.includes(form))));
    return matches.length >= minimumMatches;
  });
}

export function searchCacheScope(variant: SearchQueryVariant): string {
  if (variant.matchMode === "compact-title") return `compact-title:${variant.compactQuery}`;
  if (variant.matchMode === "relaxed-words") return `relaxed-words:${(variant.words ?? []).join(" ")}`;
  return variant.matchMode;
}

export type RelaxedWordFallbackReason =
  "run" | "page" | "no_tmdb" | "not_eligible" | "season" | "single_word" | "has_match" | "time";

export function planKoreanRelaxedWordFallback(input: {
  query: string;
  page: number;
  sources: readonly string[];
  remainingMs: number;
  existingVariants: readonly SearchQueryVariant[];
  priorResults: readonly SearchResult[];
}): { variants: SearchQueryVariant[]; reason: RelaxedWordFallbackReason } {
  if (input.page !== 1) return { variants: [], reason: "page" };
  if (!input.sources.includes("tmdb")) return { variants: [], reason: "no_tmdb" };
  const query = collapseWhitespace(input.query);
  const compactQuery = compactSearchText(query);
  if (!/[가-힣]/.test(compactQuery) || /[ᄀ-ᇿ㄰-㆏]/.test(compactQuery)) return { variants: [], reason: "not_eligible" };
  if (parseSeasonQuery(query) !== null) return { variants: [], reason: "season" };
  if (extractRelaxedSearchWords(input.query).length < 2) return { variants: [], reason: "single_word" };
  // Reverse inclusion and season_relation bypasses can block fallback with unrelated results (docs/66 §2.4).
  if (input.priorResults.some(result => relaxedSearchTitles(result).some(title => title.includes(compactQuery)))) {
    return { variants: [], reason: "has_match" };
  }
  if (input.remainingMs < RELAXED_WORD_MIN_REMAINING_MS) return { variants: [], reason: "time" };
  const variants = createKoreanRelaxedWordVariants(input.query, input.existingVariants);
  return { variants, reason: variants.length ? "run" : "not_eligible" };
}
