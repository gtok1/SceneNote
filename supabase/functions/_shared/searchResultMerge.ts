/** Public search metadata only. Provider IDs and tracking seasons are never rewritten here. */
export interface SearchMergeIdentity {
  external_source: string;
  external_id: string;
  content_type: string;
  season_number?: number;
}

export interface SearchMergeResult extends SearchMergeIdentity {
  title_primary: string;
  title_original: string | null;
  air_year: number | null;
  air_date?: string | null;
  end_date?: string | null;
  episode_count: number | null;
  has_seasons: boolean;
  poster_url: string | null;
  overview: string | null;
  localized_overview?: string | null;
  genres?: string[];
  match_titles?: string[];
  matched_people?: string[];
  anime_format?: string;
  title_is_synthesized?: boolean;
  duplicate_hint?: boolean;
  filter_match?: boolean;
  equivalent_results?: SearchMergeIdentity[];
}

export function getSearchExternalKey(result: { external_source: string; external_id: string; content_type?: string }): string {
  const source = result.external_source === "tmdb" && result.content_type
    ? `tmdb:${result.content_type === "movie" ? "movie" : "tv"}` : result.external_source;
  return `${source}:${result.external_id}`;
}

export function getSearchResultKey(result: {
  external_source: string; external_id: string; content_type?: string; season_number?: number | null;
}): string {
  return `${getSearchExternalKey(result)}:${result.season_number ?? "whole"}`;
}

function compact(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").trim();
}

function romanNumber(value: string): number {
  return ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 } as Record<string, number>)[value] ?? 0;
}

function parseTitle(value: string): { base: string; season: number | null; part: number | null; special: boolean } {
  let base = value.normalize("NFKC");
  let part: number | null = null;
  let season: number | null = null;
  const special = /\b(?:ova|oad|specials?)\b|特別編|番外編|특별편|스페셜/iu.test(base);
  base = base.replace(/(?:\b(?:part|cour)\s*(\d+)\b|第\s*(\d+)\s*クール|(?:파트|쿨)\s*(\d+)|(\d+)\s*(?:쿨|파트))/giu,
    (_match, a, b, c, d) => { part = Number(a ?? b ?? c ?? d); return " "; });
  base = base.replace(/(?:\bseason\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)\s+season\b|第\s*(\d+)\s*[期季]|시즌\s*(\d+)|(\d+)\s*기)/giu,
    (_match, a, b, c, d, e) => { season = Number(a ?? b ?? c ?? d ?? e); return " "; });
  // Native titles use attached numerals (無職転生Ⅲ); Latin titles use a standalone suffix.
  base = base.replace(/(?<=[^\x00-\x7F])([IVX]+)(?=\s|[~～〜]|$)|\s([IVX]+)\s*$/gu, (match, a, b) => {
    // A proper-name letter (ガンダムX, V) is not a season marker. Native attached
    // numerals require the provider's explicit Unicode numeral; Latin suffixes need >=2 letters.
    if ((a && !/[Ⅰ-Ⅻ]/u.test(value)) || (b && b.length < 2)) return match;
    const n = romanNumber(a ?? b);
    if (!n) return match;
    season = n;
    return " ";
  });
  return { base: base.trim(), season, part, special };
}

function animeUnit(result: SearchMergeResult) {
  const native = parseTitle(result.title_original ?? "");
  const primary = parseTitle(result.title_primary);
  const aliases = (result.match_titles ?? [])
    .filter(title => !result.title_is_synthesized || !/[가-힣]/u.test(title))
    .map(parseTitle);
  const aliasSeasons = [...new Set(aliases.flatMap(title => title.season === null ? [] : [title.season]))];
  const aliasParts = [...new Set(aliases.flatMap(title => title.part === null ? [] : [title.part]))];
  const season = result.external_source === "tmdb" && result.season_number != null ? result.season_number
    : native.season ?? (!result.title_is_synthesized ? primary.season : null) ?? (aliasSeasons.length === 1 ? aliasSeasons[0] : null) ?? 1;
  const part = native.part ?? primary.part ?? (aliasParts.length === 1 ? aliasParts[0] : null) ?? 1;
  const special = native.special || primary.special || aliases.some(title => title.special) ||
    ["OVA", "SPECIAL"].includes(result.anime_format ?? "");
  const ambiguous = result.external_source !== "tmdb" && native.season === null &&
    (result.title_is_synthesized || primary.season === null) && aliasSeasons.length > 1;
  return { season, part, special, ambiguous, bases: [native.base, primary.base].map(compact).filter(title => title.length >= 2) };
}

function rawTitleMatch(left: SearchMergeResult, right: SearchMergeResult): boolean {
  const rightTitles = [right.title_primary, right.title_original ?? ""].map(compact).filter(title => title.length >= 2);
  return [left.title_primary, left.title_original ?? ""].map(compact).some(title => title.length >= 2 && rightTitles.includes(title));
}

function knownDate(value?: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

export function areSameSearchWork(left: SearchMergeResult, right: SearchMergeResult): boolean {
  if (left.season_number != null && right.season_number != null && left.season_number !== right.season_number) return false;
  // Different media IDs within a provider can be separate cours, specials, or remakes.
  if (left.external_source === right.external_source) return false;
  const leftIdentities = [left, ...(left.equivalent_results ?? [])];
  const rightIdentities = [right, ...(right.equivalent_results ?? [])];
  const seasons = new Set([...leftIdentities, ...rightIdentities].flatMap(item => item.season_number == null ? [] : [item.season_number]));
  if (seasons.size > 1) return false;
  if (leftIdentities.some(a => rightIdentities.some(b =>
    a.external_source === b.external_source && getSearchResultKey(a) !== getSearchResultKey(b)
  ))) return false;
  const anime = left.content_type === "anime" || right.content_type === "anime";
  if (!anime) {
    return left.content_type === right.content_type &&
      !(left.air_year && right.air_year && left.air_year !== right.air_year) && rawTitleMatch(left, right);
  }
  const filmPair = [left, right].some(item => item.external_source === "anilist" && item.anime_format === "MOVIE") &&
    [left, right].some(item => item.external_source === "tmdb" && item.content_type === "movie" &&
      (item.genres ?? []).some(genre => ["animation", "애니메이션"].includes(genre.toLowerCase())));
  if (!filmPair && (left.content_type !== "anime" || right.content_type !== "anime" || left.has_seasons !== right.has_seasons)) return false;
  if (!left.air_year || !right.air_year || left.air_year !== right.air_year) return false;
  const a = animeUnit(left), b = animeUnit(right);
  if (a.ambiguous || b.ambiguous || a.season !== b.season || a.part !== b.part || a.special !== b.special) return false;
  const leftDate = knownDate(left.air_date), rightDate = knownDate(right.air_date);
  if (leftDate !== null && rightDate !== null && Math.abs(leftDate - rightDate) > 7 * 86_400_000) return false;
  if (!filmPair && left.episode_count && right.episode_count && left.episode_count !== right.episode_count) return false;
  if (rawTitleMatch(left, right)) return true;
  // A shared series name alone is insufficient: both release date and equal coverage are required.
  return leftDate !== null && rightDate !== null && Boolean(left.episode_count && left.episode_count === right.episode_count) &&
    a.bases.some(title => b.bases.includes(title));
}

function preference(result: SearchMergeResult): number {
  if (result.content_type === "anime") return ({ anilist: 5, tmdb: 3, kitsu: 2 } as Record<string, number>)[result.external_source] ?? 1;
  return result.external_source === "tmdb" ? 4 : result.external_source === "tvmaze" ? 3 : 1;
}

function completeness(result: SearchMergeResult): number {
  return [result.poster_url, result.overview, result.localized_overview, result.air_year,
    result.air_date, result.end_date, result.episode_count, result.title_original].filter(Boolean).length;
}

function identity(result: SearchMergeIdentity): SearchMergeIdentity {
  return { external_source: result.external_source, external_id: result.external_id, content_type: result.content_type,
    ...(result.season_number != null ? { season_number: result.season_number } : {}) };
}

function merge<T extends SearchMergeResult>(left: T, right: T): T {
  const rightPreferred = preference(right) > preference(left) ||
    (preference(right) === preference(left) && completeness(right) > completeness(left));
  const preferred = rightPreferred ? right : left, fallback = rightPreferred ? left : right;
  const equivalents = new Map([left, right, ...(left.equivalent_results ?? []), ...(right.equivalent_results ?? [])]
    .map(item => [getSearchResultKey(item), identity(item)]));
  return {
    ...preferred,
    title_original: preferred.title_original ?? fallback.title_original,
    poster_url: preferred.poster_url ?? fallback.poster_url,
    overview: preferred.overview ?? fallback.overview,
    localized_overview: preferred.localized_overview ?? fallback.localized_overview,
    air_year: preferred.air_year ?? fallback.air_year,
    air_date: preferred.air_date ?? fallback.air_date,
    end_date: preferred.end_date ?? fallback.end_date,
    episode_count: preferred.episode_count ?? fallback.episode_count,
    genres: [...new Set([...(preferred.genres ?? []), ...(fallback.genres ?? [])])],
    matched_people: [...new Set([...(left.matched_people ?? []), ...(right.matched_people ?? [])])],
    equivalent_results: [...equivalents.values()],
    duplicate_hint: left.duplicate_hint || right.duplicate_hint || getSearchResultKey(left) !== getSearchResultKey(right),
    ...((left.filter_match === true || right.filter_match === true) ? { filter_match: true } : {})
  };
}

export function compactSearchResults<T extends SearchMergeResult>(results: readonly T[], options: { exactFirstWins?: boolean } = {}): T[] {
  const byKey = new Map<string, T>();
  for (const result of results) {
    const key = getSearchResultKey(result), previous = byKey.get(key);
    byKey.set(key, previous ? options.exactFirstWins ? previous : merge(previous, result) : result);
  }
  const seasonScopes = new Set([...byKey.values()].filter(result => result.season_number != null)
    .map(result => getSearchResultKey({ ...result, season_number: null })));
  const compacted: T[] = [];
  for (const result of byKey.values()) {
    if (result.season_number == null && seasonScopes.has(getSearchResultKey(result))) continue;
    const index = compacted.findIndex(item => areSameSearchWork(item, result));
    const previous = compacted[index];
    if (index < 0 || !previous) compacted.push(result);
    else compacted[index] = merge(previous, result);
  }
  return compacted.map(result => {
    const title = formatAnimeSearchTitle(result);
    return title === result.title_primary ? result : { ...result, title_primary: title };
  });
}

function animeDisplayUnit(result: Partial<SearchMergeResult> & { title_primary: string }) {
  const native = parseTitle(result.title_original ?? "");
  const primary = parseTitle(result.title_primary);
  const aliases = (result.match_titles ?? []).filter(title => title !== result.title_primary &&
    (!result.title_is_synthesized || !/[가-힣]/u.test(title))).map(parseTitle);
  const seasons = [...new Set(aliases.flatMap(title => title.season === null ? [] : [title.season]))];
  let season = native.season ?? (!result.title_is_synthesized ? primary.season : null) ?? (seasons.length === 1 ? seasons[0] : null) ?? null;
  const part = native.part ?? primary.part ?? aliases.find(title => title.part !== null)?.part;
  if (season == null && part != null) season = 1;
  const special = native.special || aliases.some(title => title.special) || ["OVA", "SPECIAL"].includes(result.anime_format ?? "");
  return { primary, season, part, special };
}

export function animeReleaseLabel(result: Partial<SearchMergeResult> & { title_primary: string }): string | null {
  if (result.external_source !== "anilist" || result.content_type !== "anime" || result.anime_format === "MOVIE") return null;
  const { season, part, special } = animeDisplayUnit(result);
  return [season !== null ? `${season}기` : null, part != null && part > 1 ? `파트 ${part}` : null,
    special ? "특별편" : null].filter(Boolean).join(" ") || null;
}

/** Display-only correction: a relation ordinal remains the stored registration identity. */
export function formatAnimeSearchTitle(result: Partial<SearchMergeResult> & { title_primary: string }): string {
  if (result.external_source !== "anilist" || result.content_type !== "anime" || !/[가-힣]/u.test(result.title_primary)) return result.title_primary;
  const { primary, season, part, special } = animeDisplayUnit(result);
  if (season === null && part == null && !special) return result.title_primary;
  let base = result.title_is_synthesized || primary.season !== null || primary.part !== null ? primary.base : result.title_primary;
  if (special) base = base.replace(/\s*(?:특별편|스페셜)\s*$/u, "").trim();
  return [base, season !== null ? `${season}기` : null, part != null && part > 1 ? `파트 ${part}` : null,
    special && !/특별편|스페셜/iu.test(base) ? "특별편" : null].filter(Boolean).join(" ");
}
