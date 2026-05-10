import type { SearchResult } from "./types.ts";

const MAX_QUERY_VARIANTS = 5;

export interface SearchQueryVariant {
  query: string;
  matchMode: "direct" | "compact-title";
  compactQuery: string;
}

export function compactResults(results: SearchResult[]): SearchResult[] {
  const byExactKey = new Map<string, SearchResult>();

  for (const result of results) {
    const exactKey = `${result.external_source}:${result.external_id}`;
    const previous = byExactKey.get(exactKey);
    byExactKey.set(exactKey, previous ? mergeSearchResult(previous, result) : result);
  }

  const compacted: SearchResult[] = [];

  for (const result of byExactKey.values()) {
    const duplicateIndex = compacted.findIndex((item) => areSameWork(item, result));

    if (duplicateIndex < 0) {
      compacted.push({ ...result, duplicate_hint: false });
      continue;
    }

    const previous = compacted[duplicateIndex];
    if (!previous) continue;

    const merged = mergeSearchResult(previous, result);
    compacted[duplicateIndex] = preferSearchResult(previous, result) === result
      ? { ...merged, ...pickPreferredFields(result, merged), duplicate_hint: true }
      : { ...merged, duplicate_hint: true };
  }

  return compacted;
}

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
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
  if (compactQuery.length < 4) return results;

  return results.filter((result) =>
    [result.title_primary, result.title_original].some((title) => {
      if (!title) return false;
      const compactTitle = compactSearchText(title);
      return compactTitle.includes(compactQuery) || compactQuery.includes(compactTitle);
    })
  );
}

export function yearFromDate(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function areSameWork(left: SearchResult, right: SearchResult): boolean {
  if (left.content_type !== right.content_type) return false;
  if (left.air_year && right.air_year && left.air_year !== right.air_year) return false;

  const leftTitles = compactTitleCandidates(left);
  const rightTitles = compactTitleCandidates(right);
  if (!leftTitles.length || !rightTitles.length) return false;

  return leftTitles.some((leftTitle) => rightTitles.includes(leftTitle));
}

function compactTitleCandidates(result: SearchResult): string[] {
  return Array.from(
    new Set(
      [result.title_primary, result.title_original]
        .map((title) => compactSearchText(title ?? ""))
        .filter((title) => title.length >= 2)
    )
  );
}

function mergeSearchResult(left: SearchResult, right: SearchResult): SearchResult {
  const preferred = preferSearchResult(left, right);
  const fallback = preferred === left ? right : left;

  return {
    ...preferred,
    title_primary: preferred.title_primary || fallback.title_primary,
    title_original: preferred.title_original ?? fallback.title_original,
    poster_url: preferred.poster_url ?? fallback.poster_url,
    overview: preferred.overview ?? fallback.overview,
    localized_overview: preferred.localized_overview ?? fallback.localized_overview,
    air_year: preferred.air_year ?? fallback.air_year,
    episode_count: preferred.episode_count ?? fallback.episode_count,
    genres: Array.from(new Set([...(preferred.genres ?? []), ...(fallback.genres ?? [])])),
    has_seasons: preferred.has_seasons || fallback.has_seasons
  };
}

function preferSearchResult(left: SearchResult, right: SearchResult): SearchResult {
  const leftScore = sourcePreferenceScore(left);
  const rightScore = sourcePreferenceScore(right);
  if (leftScore !== rightScore) return rightScore > leftScore ? right : left;

  const leftCompleteness = completenessScore(left);
  const rightCompleteness = completenessScore(right);
  return rightCompleteness > leftCompleteness ? right : left;
}

function sourcePreferenceScore(result: SearchResult): number {
  if (result.content_type === "anime") {
    if (result.external_source === "anilist") return 4;
    if (result.external_source === "tmdb") return 3;
    if (result.external_source === "kitsu") return 2;
    return 1;
  }

  if (result.external_source === "tmdb") return 4;
  if (result.external_source === "tvmaze") return 3;
  return 1;
}

function completenessScore(result: SearchResult): number {
  return [
    result.poster_url,
    result.overview,
    result.localized_overview,
    result.air_year,
    result.episode_count,
    result.title_original
  ].filter(Boolean).length;
}

function pickPreferredFields(preferred: SearchResult, merged: SearchResult): SearchResult {
  return {
    ...merged,
    external_source: preferred.external_source,
    external_id: preferred.external_id,
    content_type: preferred.content_type,
    title_primary: preferred.title_primary || merged.title_primary,
    title_original: preferred.title_original ?? merged.title_original
  };
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
