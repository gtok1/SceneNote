export type RecommendationMediaType = "all" | "drama" | "anime" | "movie";

export type RecommendationProfileMode = "cold_start" | "light" | "personalized";

export interface RecommendationExternalId {
  api_source?: string | null;
  external_source?: string | null;
  source?: string | null;
  external_id?: string | null;
  id?: string | number | null;
}

export interface RecommendationCandidate {
  external_source: string;
  external_id: string;
  content_type: string;
  title_primary: string;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  release_date?: string | null;
  genres?: readonly string[] | null;
  episode_count?: number | null;
  season_count?: number | null;
  has_seasons?: boolean | null;
  popularity?: number | null;
  vote_count?: number | null;
  rank?: number | null;
  canonical_id?: string | null;
  external_ids?: Readonly<Record<string, string | number | null | undefined>> | readonly RecommendationExternalId[] | null;
  keywords?: readonly string[] | null;
  countries?: readonly string[] | null;
  languages?: readonly string[] | null;
  people?: readonly string[] | null;
  studios?: readonly string[] | null;
  rating_score?: number | null;
  rating_scale?: 10 | 100 | null;
  rating_count?: number | null;
  popularity_count?: number | null;
  release_status?: string | null;
  format?: string | null;
  duration_minutes?: number | null;
  trailer_url?: string | null;
}

export interface RecommendationLibraryItem {
  content_id?: string | null;
  source_api?: string | null;
  source_id?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  content_type?: string | null;
  title_primary?: string | null;
  title_original?: string | null;
  air_year?: number | null;
  air_date?: string | null;
  release_date?: string | null;
  genres?: readonly string[] | null;
  episode_count?: number | null;
  season_count?: number | null;
  status?: string | null;
  status_flags?: readonly string[] | null;
  statuses?: readonly string[] | null;
  watch_count?: number | null;
  canonical_id?: string | null;
  content_external_ids?: readonly RecommendationExternalId[] | null;
  external_ids?: Readonly<Record<string, string | number | null | undefined>> | readonly RecommendationExternalId[] | null;
  keywords?: readonly string[] | null;
  countries?: readonly string[] | null;
  languages?: readonly string[] | null;
  people?: readonly string[] | null;
  studios?: readonly string[] | null;
}

export interface RecommendationPreferenceProfile {
  mode: RecommendationProfileMode;
  library_size: number;
  content_type_scores: ReadonlyMap<string, number>;
  genre_scores: ReadonlyMap<string, number>;
  keyword_scores: ReadonlyMap<string, number>;
  country_scores: ReadonlyMap<string, number>;
  language_scores: ReadonlyMap<string, number>;
  people_scores: ReadonlyMap<string, number>;
  studio_scores: ReadonlyMap<string, number>;
  preferred_episode_count: number | null;
  preferred_season_count: number | null;
}

export type RankedRecommendation<T extends RecommendationCandidate> = T & {
  canonical_id: string;
  similarity_score: number;
  recommendation_reason: string;
  recommendation_signals: RecommendationSignal[];
};

export type RecommendationSignalType =
  | "shared_people"
  | "shared_studios"
  | "shared_keywords"
  | "shared_genres"
  | "preferred_genres"
  | "content_pattern"
  | "latest_popular"
  | "latest";

export interface RecommendationSignal {
  type: RecommendationSignalType;
  values: string[];
  library_titles: string[];
}

export interface RecommendationBatch<T extends RecommendationCandidate> {
  items: RankedRecommendation<T>[];
  next_cursor: string | null;
  is_exhausted: boolean;
  broadened: boolean;
  profile_mode: RecommendationProfileMode;
}

export interface RankCandidatesOptions {
  mediaType?: RecommendationMediaType;
  libraryItems?: readonly RecommendationLibraryItem[];
}

export interface RecommendationBatchOptions extends RankCandidatesOptions {
  limit?: number;
  excludeIds?: readonly string[];
  sessionSeenIds?: readonly string[];
  cursor?: string | null;
  now?: Date | string | number;
}

const SIGNAL_WEIGHTS = {
  genres: 0.55,
  contentType: 0.18,
  keywords: 0.08,
  people: 0.07,
  studios: 0.04,
  countries: 0.03,
  languages: 0.02,
  episodeCount: 0.02,
  seasonCount: 0.01
} as const;

export function buildPreferenceProfile(
  libraryItems: readonly RecommendationLibraryItem[]
): RecommendationPreferenceProfile {
  const contentTypeScores = new Map<string, number>();
  const genreScores = new Map<string, number>();
  const keywordScores = new Map<string, number>();
  const countryScores = new Map<string, number>();
  const languageScores = new Map<string, number>();
  const peopleScores = new Map<string, number>();
  const studioScores = new Map<string, number>();
  let episodeWeightedTotal = 0;
  let episodeWeight = 0;
  let seasonWeightedTotal = 0;
  let seasonWeight = 0;

  for (const item of libraryItems) {
    const weight = getLibraryItemWeight(item);
    addScore(contentTypeScores, normalizeContentType(item.content_type), weight);
    addScores(genreScores, item.genres, weight);
    addScores(keywordScores, item.keywords, weight);
    addScores(countryScores, item.countries, weight);
    addScores(languageScores, item.languages, weight);
    addScores(peopleScores, item.people, weight);
    addScores(studioScores, item.studios, weight);

    const numericWeight = Math.max(0, weight);
    if (numericWeight > 0 && isPositiveFiniteNumber(item.episode_count)) {
      episodeWeightedTotal += item.episode_count * numericWeight;
      episodeWeight += numericWeight;
    }
    if (numericWeight > 0 && isPositiveFiniteNumber(item.season_count)) {
      seasonWeightedTotal += item.season_count * numericWeight;
      seasonWeight += numericWeight;
    }
  }

  return {
    mode: getProfileMode(libraryItems.length),
    library_size: libraryItems.length,
    content_type_scores: contentTypeScores,
    genre_scores: genreScores,
    keyword_scores: keywordScores,
    country_scores: countryScores,
    language_scores: languageScores,
    people_scores: peopleScores,
    studio_scores: studioScores,
    preferred_episode_count: episodeWeight > 0 ? episodeWeightedTotal / episodeWeight : null,
    preferred_season_count: seasonWeight > 0 ? seasonWeightedTotal / seasonWeight : null
  };
}

export function calculateSimilarity(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate
): number {
  if (profile.mode === "cold_start") return 0;

  let weightedScore = 0;
  let availableWeight = 0;
  const addSignal = (score: number | null, weight: number) => {
    if (score === null) return;
    weightedScore += clamp(score, 0, 1) * weight;
    availableWeight += weight;
  };

  addSignal(scoreValues(profile.genre_scores, candidate.genres), SIGNAL_WEIGHTS.genres);
  addSignal(
    scoreValues(profile.content_type_scores, [normalizeContentType(candidate.content_type)]),
    SIGNAL_WEIGHTS.contentType
  );
  addSignal(scoreValues(profile.keyword_scores, candidate.keywords), SIGNAL_WEIGHTS.keywords);
  addSignal(scoreValues(profile.people_scores, candidate.people), SIGNAL_WEIGHTS.people);
  addSignal(scoreValues(profile.studio_scores, candidate.studios), SIGNAL_WEIGHTS.studios);
  addSignal(scoreValues(profile.country_scores, candidate.countries), SIGNAL_WEIGHTS.countries);
  addSignal(scoreValues(profile.language_scores, candidate.languages), SIGNAL_WEIGHTS.languages);
  addSignal(
    scoreNumericPreference(profile.preferred_episode_count, candidate.episode_count),
    SIGNAL_WEIGHTS.episodeCount
  );
  addSignal(
    scoreNumericPreference(profile.preferred_season_count, candidate.season_count),
    SIGNAL_WEIGHTS.seasonCount
  );

  if (availableWeight === 0) return 0;
  const normalized = weightedScore / availableWeight;
  const confidence = profile.mode === "light" ? 0.7 : 1;
  return roundScore(normalized * confidence);
}

export function rankCandidates<T extends RecommendationCandidate>(
  profile: RecommendationPreferenceProfile,
  candidates: readonly T[],
  options: RankCandidatesOptions = {}
): RankedRecommendation<T>[] {
  const mediaType = options.mediaType ?? "all";

  return candidates
    .filter((candidate) => matchesMediaType(candidate, mediaType))
    .map((candidate) => {
      const similarityScore = calculateSimilarity(profile, candidate);
      return {
        ...candidate,
        canonical_id: createRecommendationIdentity(candidate),
        similarity_score: similarityScore,
        recommendation_reason: createRecommendationReason(
          profile,
          candidate,
          similarityScore,
          options.libraryItems
        ),
        recommendation_signals: createRecommendationSignals(
          profile,
          candidate,
          options.libraryItems
        )
      };
    })
    .sort((left, right) => {
      const leftMonth = getReleaseMonthSortValue(left);
      const rightMonth = getReleaseMonthSortValue(right);
      if (leftMonth !== rightMonth) return rightMonth - leftMonth;

      const leftPopularity = finiteOr(left.popularity, 0);
      const rightPopularity = finiteOr(right.popularity, 0);
      if (leftPopularity !== rightPopularity) return rightPopularity - leftPopularity;

      if (left.similarity_score !== right.similarity_score) {
        return right.similarity_score - left.similarity_score;
      }

      const leftDate = getReleaseTimestamp(left);
      const rightDate = getReleaseTimestamp(right);
      if (leftDate !== rightDate) return rightDate - leftDate;

      const leftVotes = finiteOr(left.vote_count, 0);
      const rightVotes = finiteOr(right.vote_count, 0);
      if (leftVotes !== rightVotes) return rightVotes - leftVotes;
      return finiteOr(left.rank, Number.MAX_SAFE_INTEGER) - finiteOr(right.rank, Number.MAX_SAFE_INTEGER);
    });
}

export function getRecommendationBatch<T extends RecommendationCandidate>(
  libraryItems: readonly RecommendationLibraryItem[],
  candidates: readonly T[],
  options: RecommendationBatchOptions = {}
): RecommendationBatch<T> {
  const profile = buildPreferenceProfile(libraryItems);
  const limit = clampInteger(options.limit ?? 12, 1, 12);
  const now = toDate(options.now) ?? new Date();
  const explicitExclusions = createNormalizedIdSet(options.excludeIds ?? []);
  const sessionSeenIds = (options.sessionSeenIds ?? []).map(normalizeIdentity).filter(Boolean);
  const sessionSeenSet = new Set(sessionSeenIds);
  // sessionSeenIds already removes previously consumed candidates. Applying the old
  // cursor again would skip the next unseen page a second time.
  const cursorOffset = sessionSeenIds.length > 0 || explicitExclusions.size > 0 ? 0 : parseCursor(options.cursor);
  const libraryIdentitySets = libraryItems.map(createIdentitySet);

  const ranked = rankCandidates(profile, candidates, {
    mediaType: options.mediaType ?? "all",
    libraryItems
  });
  const deduped: RankedRecommendation<T>[] = [];
  const acceptedIdentitySets: Set<string>[] = [];

  for (const candidate of ranked) {
    const identities = createIdentitySet(candidate);
    if (
      intersectsAny(identities, libraryIdentitySets) ||
      libraryItems.some((libraryItem) => areSameWork(candidate, libraryItem))
    ) {
      continue;
    }
    if (intersects(identities, explicitExclusions)) continue;
    if (
      intersectsAny(identities, acceptedIdentitySets) ||
      deduped.some((accepted) => areSameWork(candidate, accepted))
    ) {
      continue;
    }
    deduped.push(candidate);
    acceptedIdentitySets.push(identities);
  }

  const unseen = deduped.filter((candidate) => !intersects(createIdentitySet(candidate), sessionSeenSet));
  const selectedUnseen = selectDiverse(unseen.slice(cursorOffset), limit);

  const allNewCandidatesExhausted = cursorOffset + selectedUnseen.length >= unseen.length;

  const consumedUnseen = cursorOffset + selectedUnseen.length;
  const isExhausted = allNewCandidatesExhausted;

  return {
    items: selectedUnseen,
    next_cursor: isExhausted ? null : `v1:${consumedUnseen}`,
    is_exhausted: isExhausted,
    broadened: selectedUnseen.some((candidate) => isBeforeCurrentMonth(candidate, now)),
    profile_mode: profile.mode
  };
}

export function createRecommendationReason(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate,
  _similarityScore = calculateSimilarity(profile, candidate),
  libraryItems: readonly RecommendationLibraryItem[] = []
): string {
  const signal = createRecommendationSignals(profile, candidate, libraryItems)[0];
  const typeLabel = getContentTypeLabel(candidate.content_type);
  if (!signal || signal.type === "latest") return `최근 공개된 ${typeLabel}예요.`;
  if (signal.type === "latest_popular") return `이번 달 주목받는 최신 ${typeLabel}예요.`;

  const title = signal.library_titles[0];
  const values = signal.values.slice(0, 2).join("·");
  if (signal.type === "shared_people") return `‘${title}’와 ${values} 참여진이 같아요.`;
  if (signal.type === "shared_studios") return `‘${title}’와 같은 ${values} 제작 작품이에요.`;
  if (signal.type === "shared_keywords") return `‘${title}’와 ${values} 태그가 겹쳐요.`;
  if (signal.type === "shared_genres") return `‘${title}’와 ${values} 장르가 겹쳐요.`;
  if (signal.type === "preferred_genres") return `라이브러리에서 자주 선택한 ${values} 조합과 일치해요.`;
  return `자주 선택한 ${typeLabel}의 분량과 비슷해요.`;
}

export function createRecommendationSignals(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate,
  libraryItems: readonly RecommendationLibraryItem[] = []
): RecommendationSignal[] {
  const positiveItems = libraryItems.filter((item) => getLibraryItemWeight(item) > 0);
  const directSignals: Array<{
    type: Extract<RecommendationSignalType, "shared_people" | "shared_studios" | "shared_keywords" | "shared_genres">;
    candidateValues: readonly string[] | null | undefined;
    libraryValues: (item: RecommendationLibraryItem) => readonly string[] | null | undefined;
    minimumMatches: number;
  }> = [
    { type: "shared_people", candidateValues: candidate.people, libraryValues: (item) => item.people, minimumMatches: 1 },
    { type: "shared_studios", candidateValues: candidate.studios, libraryValues: (item) => item.studios, minimumMatches: 1 },
    { type: "shared_keywords", candidateValues: candidate.keywords, libraryValues: (item) => item.keywords, minimumMatches: 2 },
    { type: "shared_genres", candidateValues: candidate.genres, libraryValues: (item) => item.genres, minimumMatches: 2 }
  ];

  for (const definition of directSignals) {
    const matches = positiveItems
      .map((item) => ({ item, values: findSharedValues(definition.candidateValues, definition.libraryValues(item)) }))
      .filter((match) => match.values.length >= definition.minimumMatches)
      .sort((left, right) => right.values.length - left.values.length);
    if (matches.length > 0) {
      const values = Array.from(new Set(matches.flatMap((match) => match.values))).slice(0, 3);
      const libraryTitles = matches
        .map((match) => match.item.title_primary?.trim())
        .filter((title): title is string => Boolean(title))
        .filter((title, index, titles) => titles.indexOf(title) === index)
        .slice(0, 2);
      if (libraryTitles.length > 0) {
        return [{ type: definition.type, values, library_titles: libraryTitles }];
      }
    }
  }

  const preferredGenres = normalizeValues(candidate.genres)
    .map((value) => ({
      value,
      score: profile.genre_scores.get(value) ?? 0,
      display: candidate.genres?.find((genre) => normalizeFeature(genre) === value)?.trim() ?? value
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2);
  if (preferredGenres.length >= 2) {
    return [{
      type: "preferred_genres",
      values: preferredGenres.map((entry) => entry.display),
      library_titles: []
    }];
  }

  const contentPatternMatches = [
    scoreNumericPreference(profile.preferred_episode_count, candidate.episode_count),
    scoreNumericPreference(profile.preferred_season_count, candidate.season_count)
  ].filter((value): value is number => value !== null);
  if (profile.mode !== "cold_start" && contentPatternMatches.some((value) => value >= 0.85)) {
    return [{ type: "content_pattern", values: [], library_titles: [] }];
  }

  const hasPopularityEvidence =
    isPositiveFiniteNumber(candidate.popularity_count) ||
    isPositiveFiniteNumber(candidate.popularity) ||
    (isPositiveFiniteNumber(candidate.rank) && candidate.rank <= 20);
  return [{
    type: hasPopularityEvidence ? "latest_popular" : "latest",
    values: [],
    library_titles: []
  }];
}

export function createRecommendationIdentity(
  item: RecommendationCandidate | RecommendationLibraryItem
): string {
  const explicitCanonicalId = normalizeIdentity(item.canonical_id ?? "");
  if (explicitCanonicalId) return explicitCanonicalId;

  const workKeys = createWorkKeys(item);
  const firstWorkKey = [...workKeys].sort()[0];
  if (firstWorkKey) return firstWorkKey;

  const externalKey = createExternalRecommendationKey(item);
  if (externalKey) return externalKey;

  const contentId = "content_id" in item ? normalizeIdentity(item.content_id ?? "") : "";
  return contentId ? `content:${contentId}` : "work:unknown:untitled:unknown";
}

export function createRecommendationIdentityAliases(
  item: RecommendationCandidate | RecommendationLibraryItem
): string[] {
  return [...createIdentitySet(item)];
}

export function createExternalRecommendationKey(
  item: RecommendationCandidate | RecommendationLibraryItem | RecommendationExternalId
): string {
  const source =
    "external_source" in item && typeof item.external_source === "string"
      ? item.external_source
      : "source_api" in item && typeof item.source_api === "string"
        ? item.source_api
        : "source" in item && typeof item.source === "string"
          ? item.source
          : "api_source" in item && typeof item.api_source === "string"
            ? item.api_source
            : "";
  const externalId =
    "external_id" in item && (typeof item.external_id === "string" || typeof item.external_id === "number")
      ? item.external_id
      : "source_id" in item && (typeof item.source_id === "string" || typeof item.source_id === "number")
        ? item.source_id
        : "id" in item && (typeof item.id === "string" || typeof item.id === "number")
          ? item.id
          : "";

  const normalizedSource = normalizeFeature(source);
  const normalizedExternalId = String(externalId).trim().toLocaleLowerCase();
  return normalizedSource && normalizedExternalId ? `${normalizedSource}:${normalizedExternalId}` : "";
}

function getProfileMode(librarySize: number): RecommendationProfileMode {
  if (librarySize === 0) return "cold_start";
  if (librarySize < 3) return "light";
  return "personalized";
}

function getLibraryItemWeight(item: RecommendationLibraryItem): number {
  const statuses = new Set(
    [...(item.status_flags ?? []), ...(item.statuses ?? []), item.status ?? ""]
      .map(normalizeFeature)
      .filter(Boolean)
  );
  if (statuses.has("not_recommended") || statuses.has("dropped")) return -3;
  if (statuses.has("recommended")) return 7;
  if (statuses.has("completed")) return 5 + Math.min(Math.max(0, finiteOr(item.watch_count, 0)), 3);
  if (statuses.has("watching")) return 4;
  return 1;
}

function addScores(target: Map<string, number>, values: readonly string[] | null | undefined, weight: number): void {
  const normalizedValues = normalizeValues(values);
  for (const value of normalizedValues) addScore(target, value, weight);
}

function addScore(target: Map<string, number>, key: string, weight: number): void {
  if (!key || weight === 0) return;
  target.set(key, (target.get(key) ?? 0) + weight);
}

function scoreValues(
  scores: ReadonlyMap<string, number>,
  values: readonly string[] | null | undefined
): number | null {
  const normalizedValues = normalizeValues(values);
  if (scores.size === 0 || normalizedValues.length === 0) return null;
  const maximumPositive = Math.max(0, ...scores.values());
  if (maximumPositive <= 0) return 0;
  const total = normalizedValues.reduce((sum, value) => sum + Math.max(0, scores.get(value) ?? 0), 0);
  return clamp(total / (maximumPositive * normalizedValues.length), 0, 1);
}

function scoreNumericPreference(preferred: number | null, candidate: number | null | undefined): number | null {
  if (!isPositiveFiniteNumber(preferred) || !isPositiveFiniteNumber(candidate)) return null;
  const distance = Math.abs(Math.log1p(preferred) - Math.log1p(candidate));
  return clamp(1 - distance / 3, 0, 1);
}

function findSharedValues(
  candidateValues: readonly string[] | null | undefined,
  libraryValues: readonly string[] | null | undefined
): string[] {
  const librarySet = new Set(normalizeValues(libraryValues));
  return Array.from(
    new Set(
      (candidateValues ?? [])
        .map((value) => value.trim())
        .filter((value) => value && librarySet.has(normalizeFeature(value)))
    )
  );
}

function matchesMediaType(candidate: RecommendationCandidate, mediaType: RecommendationMediaType): boolean {
  const contentType = normalizeContentType(candidate.content_type);
  if (mediaType === "all") return contentType !== "other";
  if (mediaType === "drama") return contentType === "kdrama" || contentType === "jdrama";
  return contentType === mediaType;
}

function createIdentitySet(item: RecommendationCandidate | RecommendationLibraryItem): Set<string> {
  const identities = new Set<string>();
  const canonical = normalizeIdentity(item.canonical_id ?? "");
  if (canonical) identities.add(canonical);
  const externalKey = createExternalRecommendationKey(item);
  if (externalKey) identities.add(normalizeIdentity(externalKey));
  for (const key of createExternalIdKeys(item.external_ids)) identities.add(normalizeIdentity(key));
  if ("content_external_ids" in item) {
    for (const key of createExternalIdKeys(item.content_external_ids)) identities.add(normalizeIdentity(key));
  }
  for (const key of createWorkKeys(item)) identities.add(normalizeIdentity(key));
  return identities;
}

function createExternalIdKeys(
  value:
    | Readonly<Record<string, string | number | null | undefined>>
    | readonly RecommendationExternalId[]
    | null
    | undefined
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(createExternalRecommendationKey).filter(Boolean);
  }
  return Object.entries(value).flatMap(([source, id]) => {
    if (id === null || id === undefined || String(id).trim() === "") return [];
    return [`${normalizeFeature(source)}:${String(id).trim().toLocaleLowerCase()}`];
  });
}

function createWorkKeys(item: RecommendationCandidate | RecommendationLibraryItem): Set<string> {
  const contentType = normalizeContentType(item.content_type);
  const releaseYear = getReleaseYear(item);
  const titles = [item.title_primary, item.title_original]
    .map((title) => normalizeTitle(title ?? ""))
    .filter((title) => title.length >= 2);
  return new Set(titles.map((title) => `work:${contentType}:${title}:${releaseYear ?? "unknown"}`));
}

function areSameWork(
  left: RecommendationCandidate | RecommendationLibraryItem,
  right: RecommendationCandidate | RecommendationLibraryItem
): boolean {
  if (normalizeContentType(left.content_type) !== normalizeContentType(right.content_type)) return false;
  const leftYear = getReleaseYear(left);
  const rightYear = getReleaseYear(right);
  if (leftYear !== null && rightYear !== null && leftYear !== rightYear) return false;

  const leftTitles = new Set(
    [left.title_primary, left.title_original]
      .map((title) => normalizeTitle(title ?? ""))
      .filter((title) => title.length >= 2)
  );
  const rightTitles = new Set(
    [right.title_primary, right.title_original]
      .map((title) => normalizeTitle(title ?? ""))
      .filter((title) => title.length >= 2)
  );
  return intersects(leftTitles, rightTitles);
}

function createFranchiseKey(item: RecommendationCandidate): string {
  const rawTitle = item.title_original || item.title_primary;
  const withoutSeason = rawTitle
    .normalize("NFKC")
    .replace(/\b(?:season|part|cour)\s*(?:\d+|[ivx]+)\b/giu, " ")
    .replace(/(?:시즌\s*\d+|\d+\s*(?:기|시즌|부)|第?\s*\d+\s*期)/gu, " ");
  const normalized = normalizeTitle(withoutSeason) || normalizeTitle(rawTitle);
  return `${normalizeContentType(item.content_type)}:${normalized}`;
}

function selectDiverse<T extends RecommendationCandidate>(
  candidates: readonly RankedRecommendation<T>[],
  limit: number
): RankedRecommendation<T>[] {
  const selected: RankedRecommendation<T>[] = [];
  const franchises = new Set<string>();
  const primaryGenreCounts = new Map<string, number>();
  const maxPerPrimaryGenre = limit <= 2 ? limit : Math.max(2, Math.ceil(limit * 0.67));

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const franchise = createFranchiseKey(candidate);
    if (franchises.has(franchise)) continue;
    const primaryGenre = normalizeValues(candidate.genres)[0] ?? "";
    if (primaryGenre && (primaryGenreCounts.get(primaryGenre) ?? 0) >= maxPerPrimaryGenre) continue;

    selected.push(candidate);
    franchises.add(franchise);
    if (primaryGenre) primaryGenreCounts.set(primaryGenre, (primaryGenreCounts.get(primaryGenre) ?? 0) + 1);
  }

  return selected;
}

function isBeforeCurrentMonth(candidate: RecommendationCandidate, now: Date): boolean {
  const releaseDate = getReleaseDate(candidate);
  if (!releaseDate) return true;
  return (
    releaseDate.getUTCFullYear() < now.getUTCFullYear() ||
    (releaseDate.getUTCFullYear() === now.getUTCFullYear() &&
      releaseDate.getUTCMonth() < now.getUTCMonth())
  );
}

function getReleaseTimestamp(candidate: RecommendationCandidate): number {
  const value = candidate.release_date ?? candidate.air_date;
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : Number.NEGATIVE_INFINITY;
}

function getReleaseMonthSortValue(candidate: RecommendationCandidate): number {
  const value = candidate.release_date ?? candidate.air_date;
  if (!value) return Number.NEGATIVE_INFINITY;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match?.[1] || !match[2]) return Number.NEGATIVE_INFINITY;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return Number.NEGATIVE_INFINITY;
  return year * 12 + month;
}

function getReleaseDate(item: RecommendationCandidate | RecommendationLibraryItem): Date | null {
  const value = item.release_date ?? item.air_date;
  if (value) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  const year = getReleaseYear(item);
  return year ? new Date(Date.UTC(year, 0, 1)) : null;
}

function getReleaseYear(item: RecommendationCandidate | RecommendationLibraryItem): number | null {
  if (Number.isInteger(item.air_year) && (item.air_year ?? 0) > 0) return item.air_year ?? null;
  const value = item.release_date ?? item.air_date;
  if (!value) return null;
  const match = /^(\d{4})/.exec(value);
  const year = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isFinite(year) ? year : null;
}

function createNormalizedIdSet(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizeIdentity).filter(Boolean));
}

function intersectsAny(target: Set<string>, sets: readonly Set<string>[]): boolean {
  return sets.some((set) => intersects(target, set));
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function normalizeValues(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map(normalizeFeature).filter(Boolean)));
}

function normalizeContentType(value: string | null | undefined): string {
  const normalized = normalizeFeature(value ?? "");
  if (normalized === "drama") return "kdrama";
  return normalized || "other";
}

function normalizeFeature(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .trim();
}

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function getContentTypeLabel(contentType: string): string {
  switch (normalizeContentType(contentType)) {
    case "anime":
      return "애니";
    case "movie":
      return "영화";
    case "kdrama":
    case "jdrama":
      return "드라마";
    default:
      return "작품";
  }
}

function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const match = /^v1:(\d+)$/.exec(cursor);
  if (!match?.[1]) return 0;
  return clampInteger(Number.parseInt(match[1], 10), 0, Number.MAX_SAFE_INTEGER);
}

function toDate(value: Date | string | number | undefined): Date | null {
  if (value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isPositiveFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 1) * 10_000) / 10_000;
}
