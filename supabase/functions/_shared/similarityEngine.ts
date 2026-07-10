export type SimilarityFocus = "balanced" | "mood" | "story" | "setting" | "relationship" | "genre" | "character";
export type SimilaritySort = "similarity" | "latest" | "popular";
export type SimilaritySignalType = "genre" | "tag" | "story" | "staff" | "studio" | "provider_recommendation";

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
  has_seasons: boolean;
  episode_count: number | null;
  genres?: string[];
  tags?: string[];
  people?: string[];
  studios?: string[];
  popularity?: number | null;
  vote_count?: number | null;
  provider_recommended?: boolean;
}

export interface SimilaritySignal {
  type: SimilaritySignalType;
  label: string;
  score: number;
  source: string;
}

export interface RankedSimilarityWork<T extends SimilarityWork = SimilarityWork> extends T {
  similarity_score: number;
  shared_signals: SimilaritySignal[];
  similarity_reason: string;
}

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
  const anchorKey = externalKey(anchor);
  const deduped = new Map<string, T>();
  for (const candidate of candidates) {
    if (externalKey(candidate) === anchorKey || sameWork(anchor, candidate)) continue;
    const key = workKey(candidate);
    if (!deduped.has(key)) deduped.set(key, candidate);
  }
  const ranked = [...deduped.values()].map((candidate) => scoreWork(anchor, candidate, focus));
  ranked.sort(sorter(sort));
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
  if (candidate.provider_recommended) signals.push({ type: "provider_recommendation", label: "제공처 추천", score: 1, source: candidate.external_source });
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

function sorter<T extends RankedSimilarityWork>(sort: SimilaritySort): (a: T, b: T) => number {
  if (sort === "latest") return (a, b) => dateValue(b) - dateValue(a) || b.similarity_score - a.similarity_score;
  if (sort === "popular") return (a, b) => popularityValue(b) - popularityValue(a) || b.similarity_score - a.similarity_score;
  return (a, b) => b.similarity_score - a.similarity_score || popularityValue(b) - popularityValue(a) || dateValue(b) - dateValue(a);
}

function popularityValue(item: SimilarityWork): number { return Math.log1p(Math.max(0, item.popularity ?? 0)) + Math.log1p(Math.max(0, item.vote_count ?? 0)); }
function dateValue(item: SimilarityWork): number { const value = Date.parse(item.air_date ?? `${item.air_year ?? 0}-01-01`); return Number.isFinite(value) ? value : 0; }
function sameWork(a: SimilarityWork, b: SimilarityWork): boolean { return normalizeTitle(a.title_primary) === normalizeTitle(b.title_primary) && (!a.air_year || !b.air_year || a.air_year === b.air_year); }
function externalKey(item: SimilarityWork): string { return `${normalize(item.external_source)}:${String(item.external_id).trim()}`; }
function workKey(item: SimilarityWork): string { return `${normalize(item.content_type)}:${normalizeTitle(item.title_primary)}:${item.air_year ?? ""}`; }
function franchiseKey(item: SimilarityWork): string { return normalizeTitle(item.title_original || item.title_primary).replace(/(?:season|part|시즌)\d+$/u, ""); }
function normalizeTitle(value: string): string { return normalize(value).replace(/[\s\p{P}\p{S}]+/gu, ""); }
function normalize(value: string): string { return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " "); }
function translate(value: string): string { return KO_LABELS[value] ?? value; }
function round(value: number): number { return Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000; }
