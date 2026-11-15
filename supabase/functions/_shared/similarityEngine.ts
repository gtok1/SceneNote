export type SimilarityFocus = "balanced" | "mood" | "story" | "setting" | "relationship" | "genre" | "character";
export type SimilaritySort = "similarity" | "latest" | "popular";
export type SimilaritySignalType = "genre" | "tag" | "story" | "staff" | "studio" | "provider_recommendation";

export interface SimilarityIdentityAlias {
  external_source: string;
  external_id: string;
  content_type: string;
  has_seasons?: boolean;
  season_number?: number | null;
  title_primary: string;
  title_original: string | null;
  air_year: number | null;
}

export interface SimilarityWork {
  external_source: string;
  external_id: string;
  content_type: string;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  air_date?: string | null;
  season_number?: number | null;
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  tags?: string[];
  people?: string[];
  studios?: string[];
  popularity?: number | null;
  vote_count?: number | null;
  provider_recommended?: boolean;
  provider_recommendation_sources?: string[];
  identity_aliases?: SimilarityIdentityAlias[];
}

export interface SimilaritySignal {
  type: SimilaritySignalType;
  label: string;
  score: number;
  source: string;
}

export type RankedSimilarityWork<T extends SimilarityWork = SimilarityWork> = T & {
  similarity_score: number;
  shared_signals: SimilaritySignal[];
  similarity_reason: string;
};

const WEIGHTS: Record<SimilarityFocus, Record<SimilaritySignalType, number>> = {
  balanced: { provider_recommendation: 0.28, tag: 0.2, genre: 0.18, story: 0.18, staff: 0.08, studio: 0.08 },
  mood: { provider_recommendation: 0.2, tag: 0.34, genre: 0.14, story: 0.2, staff: 0.04, studio: 0.08 },
  story: { provider_recommendation: 0.18, tag: 0.18, genre: 0.1, story: 0.42, staff: 0.06, studio: 0.06 },
  setting: { provider_recommendation: 0.18, tag: 0.38, genre: 0.14, story: 0.22, staff: 0.02, studio: 0.06 },
  relationship: { provider_recommendation: 0.18, tag: 0.36, genre: 0.1, story: 0.28, staff: 0.04, studio: 0.04 },
  genre: { provider_recommendation: 0.16, tag: 0.18, genre: 0.46, story: 0.1, staff: 0.04, studio: 0.06 },
  character: { provider_recommendation: 0.18, tag: 0.28, genre: 0.08, story: 0.28, staff: 0.12, studio: 0.06 }
};

const KO_LABELS: Record<string, string> = {
  dystopian: "디스토피아", tragedy: "비극", "coming of age": "성장", "found family": "유사가족",
  military: "군대", "workplace romance": "직업 로맨스", "super power": "초능력", psychological: "심리",
  survival: "생존", "post-apocalyptic": "포스트 아포칼립스", action: "액션", adventure: "모험",
  animation: "애니메이션", comedy: "코미디", drama: "드라마", fantasy: "판타지", romance: "로맨스",
  thriller: "스릴러", mystery: "미스터리", "science fiction": "SF", "sci-fi & fantasy": "SF·판타지"
};

export function rankSimilarWorks<T extends SimilarityWork>(anchor: SimilarityWork, candidates: readonly T[], focus: SimilarityFocus, sort: SimilaritySort): RankedSimilarityWork<T>[] {
  const anchorKey = catalogKey(anchor);
  const groups: T[][] = [];
  for (const candidate of candidates) {
    if (catalogKey(candidate) === anchorKey || sameWork(anchor, candidate, true)) continue;
    const group = [candidate];
    // Keep every alias until grouping is complete so a later provider alias can
    // connect duplicates even when their preferred display titles differ.
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const existing = groups[index]!;
      if (!existing.some((item) => group.some((alias) => externalKey(item) === externalKey(alias) || sameWork(item, alias)))) continue;
      group.push(...existing);
      groups.splice(index, 1);
    }
    groups.push(group);
  }
  const ranked = groups.map((group) => scoreWork(anchor, mergeWorks(group), focus)).filter((item) => item.shared_signals.length > 0);
  ranked.sort(sorter(sort, focus));
  return diversifySimilarityResults(ranked);
}

export function scoreWork<T extends SimilarityWork>(anchor: SimilarityWork, candidate: T, focus: SimilarityFocus): RankedSimilarityWork<T> {
  const signals = createSignals(anchor, candidate);
  const weights = WEIGHTS[focus];
  const availableWeight = signals.reduce((sum, signal) => sum + weights[signal.type], 0);
  const score = availableWeight > 0
    ? signals.reduce((sum, signal) => sum + signal.score * weights[signal.type], 0) / availableWeight
    : 0;
  const sharedSignals = signals.sort((a, b) => b.score * weights[b.type] - a.score * weights[a.type]);
  return { ...candidate, similarity_score: round(score), shared_signals: sharedSignals, similarity_reason: buildSimilarityReason(sharedSignals) };
}

export function diversifySimilarityResults<T extends RankedSimilarityWork>(items: readonly T[]): T[] {
  const selected: T[] = [];
  const franchiseCounts = new Map<string, number>();
  const studioCounts = new Map<string, number>();
  for (const item of items) {
    const franchise = franchiseKey(item);
    const studio = normalize(item.studios?.[0] ?? "");
    if ((franchiseCounts.get(franchise) ?? 0) >= 2) continue;
    if (studio && selected.length < 12 && (studioCounts.get(studio) ?? 0) >= 4) continue;
    selected.push(item);
    franchiseCounts.set(franchise, (franchiseCounts.get(franchise) ?? 0) + 1);
    if (studio) studioCounts.set(studio, (studioCounts.get(studio) ?? 0) + 1);
  }
  return selected;
}

export function buildSimilarityReason(signals: readonly SimilaritySignal[]): string {
  const provider = signals.find((signal) => signal.type === "provider_recommendation");
  const concrete = signals.filter((signal) => signal.type !== "provider_recommendation").slice(0, 3).map((signal) => signal.label);
  if (concrete.length >= 2) return `${concrete.slice(0, -1).join("·")}과 ${concrete.at(-1)} 요소가 겹쳐요.`;
  if (concrete.length === 1 && provider) return `제공처 추천 신호가 있고 ${concrete[0]} 요소가 겹쳐요.`;
  if (concrete.length === 1) return `${concrete[0]} 요소가 비슷해요.`;
  if (provider) return "외부 제공처에서 함께 추천되는 작품이에요.";
  return "공식 작품 정보에서 일부 요소가 겹쳐요.";
}

function createSignals(anchor: SimilarityWork, candidate: SimilarityWork): SimilaritySignal[] {
  const signals: SimilaritySignal[] = [];
  addOverlap(signals, "genre", anchor.genres, candidate.genres, "공식 장르");
  addOverlap(signals, "tag", anchor.tags, candidate.tags, "공식 태그");
  addOverlap(signals, "staff", anchor.people, candidate.people, "참여진");
  addOverlap(signals, "studio", anchor.studios, candidate.studios, "제작사");
  const storyScore = lexicalSimilarity(anchor.overview, candidate.overview);
  if (storyScore > 0.06) signals.push({ type: "story", label: "줄거리 키워드", score: storyScore, source: "official_overview" });
  if (candidate.provider_recommended) signals.push({ type: "provider_recommendation", label: "제공처 추천", score: 1, source: candidate.provider_recommendation_sources?.join(", ") || candidate.external_source });
  return signals;
}

function addOverlap(target: SimilaritySignal[], type: SimilaritySignalType, left?: string[], right?: string[], source = "metadata"): void {
  const leftSet = new Set((left ?? []).map(normalize).filter(Boolean));
  const shared = [...new Set((right ?? []).map(normalize).filter((value) => leftSet.has(value)))];
  if (!shared.length) return;
  const union = new Set([...leftSet, ...(right ?? []).map(normalize).filter(Boolean)]);
  target.push({ type, label: shared.slice(0, 2).map(translate).join("·"), score: shared.length / Math.max(1, union.size), source });
}

function lexicalSimilarity(left?: string | null, right?: string | null): number {
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0; for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / new Set([...a, ...b]).size;
}

function tokens(value?: string | null): Set<string> {
  return new Set(normalize(value ?? "").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2));
}

function sorter<T extends RankedSimilarityWork>(sort: SimilaritySort, focus: SimilarityFocus): (a: T, b: T) => number {
  const byEvidence = (a: T, b: T): number => round(evidenceValue(b, focus)) - round(evidenceValue(a, focus));
  const byDate = (a: T, b: T): number => compareDescending(dateValue(a), dateValue(b));
  const byPopularity = (a: T, b: T): number => popularityValue(b) - popularityValue(a);
  const secondary = sort === "popular" ? byPopularity : byDate;
  return (a, b) => byEvidence(a, b) || secondary(a, b) || compareIdentity(a, b);
}

function evidenceValue(item: RankedSimilarityWork, focus: SimilarityFocus): number {
  // similarity_score remains normalized over available signals. For ordering,
  // multiply that match by its weighted evidence coverage: a single provider
  // recommendation must not become a perfect match that beats several real
  // mood/story signals. The comparator rounds this evidence to four decimals
  // before using the requested date/popularity tie breaker.
  return item.shared_signals.reduce((sum, signal) => sum + signal.score * WEIGHTS[focus][signal.type], 0);
}

function mergeWorks<T extends SimilarityWork>(group: readonly T[]): T {
  const ordered = [...group].sort((a, b) => metadataRichness(b) - metadataRichness(a) || compareIdentity(a, b));
  const preferred = ordered[0]!;
  return {
    ...preferred,
    title_primary: ordered.find((item) => /[가-힣]/u.test(item.title_primary))?.title_primary || preferred.title_primary,
    title_original: preferred.title_original || ordered.find((item) => item.title_original)?.title_original || null,
    poster_url: preferred.poster_url || ordered.find((item) => item.poster_url)?.poster_url || null,
    overview: preferred.overview || ordered.find((item) => item.overview)?.overview || null,
    air_year: preferred.air_year ?? ordered.find((item) => item.air_year != null)?.air_year ?? null,
    air_date: preferred.air_date ?? ordered.find((item) => item.air_date)?.air_date ?? null,
    episode_count: preferred.episode_count ?? ordered.find((item) => item.episode_count != null)?.episode_count ?? null,
    genres: mergeValues(ordered.flatMap((item) => item.genres ?? [])),
    tags: mergeValues(ordered.flatMap((item) => item.tags ?? [])),
    people: mergeValues(ordered.flatMap((item) => item.people ?? [])),
    studios: mergeValues(ordered.flatMap((item) => item.studios ?? [])),
    popularity: preferred.popularity ?? ordered.find((item) => item.popularity != null)?.popularity ?? null,
    vote_count: preferred.vote_count ?? ordered.find((item) => item.vote_count != null)?.vote_count ?? null,
    identity_aliases: mergeIdentityAliases(ordered),
    provider_recommended: ordered.some((item) => item.provider_recommended),
    provider_recommendation_sources: mergeValues(ordered.filter((item) => item.provider_recommended).flatMap((item) => item.provider_recommendation_sources?.length ? item.provider_recommendation_sources : [item.external_source]))
  };
}

function mergeIdentityAliases(items: readonly SimilarityWork[]): SimilarityIdentityAlias[] {
  const aliases = new Map<string, SimilarityIdentityAlias>();
  for (const item of items) {
    for (const alias of [item, ...(item.identity_aliases ?? [])]) {
      const identity: SimilarityIdentityAlias = {
        external_source: alias.external_source,
        external_id: alias.external_id,
        content_type: alias.content_type,
        ...(alias.has_seasons !== undefined ? { has_seasons: alias.has_seasons } : {}),
        ...(alias.season_number !== undefined ? { season_number: alias.season_number } : {}),
        title_primary: alias.title_primary,
        title_original: alias.title_original,
        air_year: alias.air_year
      };
      const key = JSON.stringify(identity);
      if (!aliases.has(key)) aliases.set(key, identity);
    }
  }
  return [...aliases.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, alias]) => alias);
}

function mergeValues(values: readonly string[]): string[] {
  const byName = new Map<string, string>();
  for (const value of values) {
    const key = normalize(value);
    if (key && !byName.has(key)) byName.set(key, value);
  }
  return [...byName.values()];
}

function metadataRichness(item: SimilarityWork): number {
  return [item.genres, item.tags, item.people, item.studios].filter((values) => values?.length).length
    + [item.overview, item.poster_url, item.air_date, item.episode_count].filter(Boolean).length;
}

function popularityValue(item: SimilarityWork): number { return Math.log1p(nonNegativeFinite(item.popularity)) + Math.log1p(nonNegativeFinite(item.vote_count)); }
function nonNegativeFinite(value?: number | null): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0; }
function dateValue(item: SimilarityWork): number {
  if (item.air_date && /^\d{4}-\d{2}-\d{2}$/u.test(item.air_date)) {
    const value = Date.parse(item.air_date);
    if (Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === item.air_date) return value;
  }
  if (typeof item.air_year === "number" && Number.isInteger(item.air_year) && item.air_year >= 1 && item.air_year <= 9999) return Date.parse(`${String(item.air_year).padStart(4, "0")}-01-01`);
  return Number.NEGATIVE_INFINITY;
}
function compareDescending(a: number, b: number): number { return a === b ? 0 : a > b ? -1 : 1; }
function sameWork(a: SimilarityWork, b: SimilarityWork, allowUnknownYear = false): boolean {
  const yearsMatch = a.air_year === b.air_year || (allowUnknownYear && (a.air_year == null || b.air_year == null));
  if (normalize(a.content_type) !== normalize(b.content_type) || !yearsMatch || seasonKey(a) !== seasonKey(b)) return false;
  const titles = new Set([a.title_primary, a.title_original ?? ""].map(normalizeTitle).filter(Boolean));
  return [b.title_primary, b.title_original ?? ""].map(normalizeTitle).some((title) => titles.has(title));
}
function externalKey(item: SimilarityWork): string {
  return `${catalogKey(item)}:${seasonKey(item)}`;
}
function catalogKey(item: SimilarityWork): string {
  const source = normalize(item.external_source);
  const namespace = source === "tmdb" ? item.content_type === "movie" ? "movie:" : "tv:" : "";
  return `${source}:${namespace}${String(item.external_id).trim()}`;
}
function seasonKey(item: SimilarityWork): string { return item.season_number == null ? "" : String(item.season_number); }
function compareIdentity(a: SimilarityWork, b: SimilarityWork): number {
  const left = externalKey(a); const right = externalKey(b);
  if (left !== right) return left < right ? -1 : 1;
  const leftTitle = normalizeTitle(a.title_primary); const rightTitle = normalizeTitle(b.title_primary);
  return leftTitle < rightTitle ? -1 : leftTitle > rightTitle ? 1 : 0;
}
function franchiseKey(item: SimilarityWork): string { return normalizeTitle(item.title_original || item.title_primary).replace(/(?:season|part|시즌)\d+$/u, ""); }
function normalizeTitle(value: string): string { return normalize(value).replace(/[\s\p{P}\p{S}]+/gu, ""); }
function normalize(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " "); }
function translate(value: string): string { return KO_LABELS[value] ?? value; }
function round(value: number): number { return Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000; }
