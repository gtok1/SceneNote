import {
  isBroadGenre,
  NICHE_THEME_CENTRALITY_THRESHOLD,
  normalizeContentThemes,
  themeIdentity,
  type ContentTheme,
  type SourceContentTag
} from "./recommendationThemes.ts";

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
  source_tags?: readonly SourceContentTag[] | null;
  themes?: readonly ContentTheme[] | null;
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
  source_tags?: readonly SourceContentTag[] | null;
  themes?: readonly ContentTheme[] | null;
  countries?: readonly string[] | null;
  languages?: readonly string[] | null;
  people?: readonly string[] | null;
  studios?: readonly string[] | null;
}

export type PreferenceState = "positive" | "negative" | "unknown";
export type PreferenceStrength = "none" | "weak" | "strong" | "reduced" | "excluded";
export type RecommendationFeedbackAction = "more" | "less" | "exclude" | "not_interested";

export interface RecommendationFeedback {
  target_type: "content" | "genre" | "tag" | "theme" | "studio" | "cast" | "staff";
  target_key: string;
  action: RecommendationFeedbackAction;
  weight?: number | null;
  source_content_id?: string | null;
  updated_at?: string | null;
}

export interface PreferenceEvidence {
  key: string;
  family: string;
  state: PreferenceState;
  strength: PreferenceStrength;
  score: number;
  evidence_count: number;
  source_content_ids: string[];
  explicit: boolean;
  last_updated_at: string | null;
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
  theme_evidence: ReadonlyMap<string, PreferenceEvidence>;
  explicit_content_feedback: ReadonlyMap<string, RecommendationFeedbackAction>;
  preferred_episode_count: number | null;
  preferred_season_count: number | null;
}

export type RankedRecommendation<T extends RecommendationCandidate> = T & {
  canonical_id: string;
  similarity_score: number;
  recommendation_reason: string;
  recommendation_signals: RecommendationSignal[];
  themes: ContentTheme[];
  recommendation_reason_detail: RecommendationReason;
  is_exploration: boolean;
  preference_evidence: PreferenceState;
  candidate_score: RecommendationCandidateScore;
};

export type RecommendationSignalType =
  | "shared_people"
  | "shared_studios"
  | "shared_keywords"
  | "shared_themes"
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

export interface RecommendationEvidenceSignal {
  type: "specific_title_match" | "tag_match" | "theme_match" | "studio_match" | "staff_match" | "cast_match" | "broad_genre_match" | "exploration";
  key: string;
  value: string;
  contribution: number;
}

export interface RecommendationReason {
  type: RecommendationEvidenceSignal["type"];
  message: string;
  source_content_ids: string[];
  signals: RecommendationEvidenceSignal[];
  confidence: "strong" | "medium" | "weak";
  label: "추천 이유" | "비슷한 점" | "취향 탐색";
}

export interface RecommendationCandidateScore {
  popularity: number;
  quality: number;
  personalization: number;
  explicit_feedback: number;
  exploration: number;
  final_score: number;
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
  feedback?: readonly RecommendationFeedback[];
}

export interface RecommendationBatchOptions extends RankCandidatesOptions {
  limit?: number;
  excludeIds?: readonly string[];
  sessionSeenIds?: readonly string[];
  cursor?: string | null;
  now?: Date | string | number;
}

const SIGNAL_WEIGHTS = {
  broadGenres: 0.12,
  specificGenres: 0.18,
  themes: 0.28,
  keywords: 0.17,
  people: 0.1,
  studios: 0.06,
  contentType: 0.03,
  countries: 0.02,
  languages: 0.01,
  episodeCount: 0.02,
  seasonCount: 0.01
} as const;

// Explicit feedback is seeded at this magnitude; implicit evidence is measured
// against the same scale so one tap remains intentionally stronger than one view.
const EXPLICIT_THEME_EVIDENCE_SCORE = 10;

export const RECOMMENDATION_DIVERSITY_CONFIG = {
  unknownNicheThemeCap: 1,
  weakNicheThemeCap: 2,
  strongNicheThemeCap: 4,
  reducedThemeCap: 1,
  excludedThemeCap: 0,
  unknownNicheExplorationSlots: 1
} as const;

export function buildPreferenceProfile(
  libraryItems: readonly RecommendationLibraryItem[],
  feedback: readonly RecommendationFeedback[] = []
): RecommendationPreferenceProfile {
  const contentTypeScores = new Map<string, number>();
  const genreScores = new Map<string, number>();
  const keywordScores = new Map<string, number>();
  const countryScores = new Map<string, number>();
  const languageScores = new Map<string, number>();
  const peopleScores = new Map<string, number>();
  const studioScores = new Map<string, number>();
  const themeEvidence = new Map<string, PreferenceEvidence>();
  const explicitContentFeedback = new Map<string, RecommendationFeedbackAction>();
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
    for (const theme of resolveThemes(item)) {
      const key = themeIdentity(theme);
      const existing = themeEvidence.get(key);
      const positiveWeight = Math.max(0, weight) * theme.centrality;
      if (positiveWeight <= 0) continue;
      const sourceId = createRecommendationIdentity(item);
      const sourceIds = Array.from(new Set([...(existing?.source_content_ids ?? []), sourceId]));
      const evidenceCount = (existing?.evidence_count ?? 0) + (theme.centrality >= NICHE_THEME_CENTRALITY_THRESHOLD ? 1 : 0);
      themeEvidence.set(key, {
        key,
        family: theme.family,
        state: "positive",
        strength: evidenceCount >= 2 && theme.centrality >= 0.8 ? "strong" : "weak",
        score: (existing?.score ?? 0) + positiveWeight,
        evidence_count: evidenceCount,
        source_content_ids: sourceIds,
        explicit: existing?.explicit ?? false,
        last_updated_at: existing?.last_updated_at ?? null
      });
    }

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

  for (const item of feedback) {
    const key = normalizeFeature(item.target_key);
    if (!key) continue;
    if (item.target_type === "content") {
      explicitContentFeedback.set(key, item.action);
      continue;
    }
    if (item.target_type !== "theme") continue;
    const previous = themeEvidence.get(key);
    const isPositive = item.action === "more";
    const strength: PreferenceStrength = item.action === "exclude" ? "excluded" : item.action === "less" ? "reduced" : "strong";
    themeEvidence.set(key, {
      key,
      family: key.split(":")[0] ?? "theme",
      state: isPositive ? "positive" : "negative",
      strength,
      score: isPositive ? Math.max(EXPLICIT_THEME_EVIDENCE_SCORE, previous?.score ?? 0) : -Math.max(EXPLICIT_THEME_EVIDENCE_SCORE, Math.abs(previous?.score ?? 0)),
      evidence_count: (previous?.evidence_count ?? 0) + 1,
      source_content_ids: Array.from(new Set([...(previous?.source_content_ids ?? []), item.source_content_id ?? ""].filter(Boolean))),
      explicit: true,
      last_updated_at: item.updated_at ?? null
    });
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
    theme_evidence: themeEvidence,
    explicit_content_feedback: explicitContentFeedback,
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

  const broadGenres = (candidate.genres ?? []).filter(isBroadGenre);
  const specificGenres = (candidate.genres ?? []).filter((genre) => !isBroadGenre(genre));
  addSignal(scoreValues(profile.genre_scores, broadGenres), SIGNAL_WEIGHTS.broadGenres);
  addSignal(scoreValues(profile.genre_scores, specificGenres), SIGNAL_WEIGHTS.specificGenres);
  addSignal(scoreThemeValues(profile, resolveThemes(candidate)), SIGNAL_WEIGHTS.themes);
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

  // Defensive for externally constructed profiles: buildPreferenceProfile always
  // supplies a content-type signal outside cold start, but this function is public.
  if (availableWeight === 0) return 0;
  const confidence = profile.mode === "light" ? 0.7 : 1;
  // Normalize over metadata that is actually present. Catalog list endpoints do not
  // expose TMDB keywords, and fetching details per candidate would be too expensive.
  const normalizedScore = (weightedScore / availableWeight) * confidence;
  const hasSpecificEvidence = specificGenres.length > 0 || resolveThemes(candidate).length > 0 ||
    normalizeValues(candidate.keywords).length > 0 || normalizeValues(candidate.people).length > 0 ||
    normalizeValues(candidate.studios).length > 0;
  // Broad genres and format alone are intentionally weak even after missing-signal
  // normalization; otherwise generic Drama/Comedy rows look highly personalized.
  return roundScore(hasSpecificEvidence ? normalizedScore : Math.min(normalizedScore, 0.15));
}

export function calculatePreferenceEvidence(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate
): PreferenceEvidence[] {
  return resolveThemes(candidate).map((theme) =>
    profile.theme_evidence.get(themeIdentity(theme)) ?? {
      key: themeIdentity(theme),
      family: theme.family,
      state: "unknown",
      strength: "none",
      score: 0,
      evidence_count: 0,
      source_content_ids: [],
      explicit: false,
      last_updated_at: null
    }
  );
}

export function classifyExplorationCandidate(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate
): boolean {
  const themes = resolveThemes(candidate).filter((theme) => theme.centrality >= NICHE_THEME_CENTRALITY_THRESHOLD);
  if (themes.some((theme) => profile.theme_evidence.get(themeIdentity(theme))?.state === "positive")) return false;
  const specificKeywordMatch = scoreValues(profile.keyword_scores, candidate.keywords) ?? 0;
  const peopleMatch = scoreValues(profile.people_scores, candidate.people) ?? 0;
  return themes.length > 0 || (specificKeywordMatch < 0.2 && peopleMatch < 0.2);
}

export function calculateCandidateScore(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate
): RecommendationCandidateScore {
  const personalization = calculateSimilarity(profile, candidate);
  const feedbackAction = profile.explicit_content_feedback.get(normalizeFeature(createRecommendationIdentity(candidate)));
  const themeFeedback = calculatePreferenceEvidence(profile, candidate)
    .filter((item) => item.explicit)
    .reduce((sum, item) => sum + (item.state === "negative" ? (item.strength === "excluded" ? -1 : -0.7) : 0.8), 0);
  const explicitFeedback = clamp(
    (feedbackAction === "more" ? 1 : feedbackAction === "less" ? -0.7 : feedbackAction === "exclude" || feedbackAction === "not_interested" ? -1 : 0) + themeFeedback,
    -1,
    1
  );
  const popularity = clamp(finiteOr(candidate.popularity, 0) / 100, 0, 1);
  const qualityScore = normalizeQuality(candidate);
  const exploration = classifyExplorationCandidate(profile, candidate) ? 0.15 : 0;
  return {
    popularity: roundScore(popularity),
    quality: roundScore(qualityScore),
    personalization,
    explicit_feedback: explicitFeedback,
    exploration,
    // Release month is already the primary ranking key. Redistribute the previous
    // constant recency weight to signals that can distinguish candidates.
    final_score: roundSignedScore(clamp(
      popularity * 0.1 + qualityScore * 0.1 + personalization * 0.76 + exploration * 0.04 + explicitFeedback,
      -1,
      1
    ))
  };
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
      const themes = resolveThemes(candidate);
      const candidateScore = calculateCandidateScore(profile, candidate);
      const evidence = calculatePreferenceEvidence(profile, candidate);
      const isExploration = classifyExplorationCandidate(profile, candidate);
      const reasonDetail = buildRecommendationReason(profile, candidate, evidence, isExploration, options.libraryItems);
      return {
        ...candidate,
        themes,
        canonical_id: createRecommendationIdentity(candidate),
        similarity_score: similarityScore,
        recommendation_reason: reasonDetail.message,
        recommendation_reason_detail: reasonDetail,
        recommendation_signals: createRecommendationSignals(
          profile,
          candidate,
          options.libraryItems
        ),
        is_exploration: isExploration,
        preference_evidence: summarizePreferenceState(evidence),
        candidate_score: candidateScore
      };
    })
    .sort((left, right) => {
      const leftMonth = getReleaseMonthSortValue(left);
      const rightMonth = getReleaseMonthSortValue(right);
      if (leftMonth !== rightMonth) return rightMonth - leftMonth;

      if (left.candidate_score.final_score !== right.candidate_score.final_score) {
        return right.candidate_score.final_score - left.candidate_score.final_score;
      }

      const leftPopularity = finiteOr(left.popularity, 0);
      const rightPopularity = finiteOr(right.popularity, 0);
      if (leftPopularity !== rightPopularity) return rightPopularity - leftPopularity;

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
  const profile = buildPreferenceProfile(libraryItems, options.feedback);
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
  const selectedUnseen = selectDiverse(unseen.slice(cursorOffset), limit, profile);

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
  const evidence = calculatePreferenceEvidence(profile, candidate);
  return buildRecommendationReason(
    profile,
    candidate,
    evidence,
    classifyExplorationCandidate(profile, candidate),
    libraryItems
  ).message;
}

export function buildRecommendationReason(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate,
  themeEvidence = calculatePreferenceEvidence(profile, candidate),
  isExploration = classifyExplorationCandidate(profile, candidate),
  libraryItems: readonly RecommendationLibraryItem[] = []
): RecommendationReason {
  const signals = createRecommendationSignals(profile, candidate, libraryItems);
  const signal = signals[0];
  const title = signal?.library_titles[0];
  const values = signal?.values.slice(0, 3) ?? [];
  const sourceContentIds = title
    ? libraryItems.filter((item) => item.title_primary?.trim() === title).map(createRecommendationIdentity)
    : [];

  if (signal?.type === "shared_people" || signal?.type === "shared_studios") {
    const value = values.join("·");
    return reason(signal.type === "shared_people" ? "staff_match" : "studio_match", `‘${title}’와 ${value} ${signal.type === "shared_people" ? "참여진이 같아요" : "제작 작품이에요"}.`, sourceContentIds, values, "strong", "추천 이유");
  }
  if (signal?.type === "shared_themes" || signal?.type === "shared_keywords") {
    const value = values.join("·");
    const keys = signal.type === "shared_themes"
      ? values.map((label) => themeIdentity(resolveThemes(candidate).find((theme) => theme.label === label) ?? { family: "format", key: normalizeFeature(label) }))
      : undefined;
    return reason(signal.type === "shared_themes" ? "theme_match" : "tag_match", `‘${title}’와 ${value} ${signal.type === "shared_themes" ? "테마가" : "태그가"} 겹쳐요.`, sourceContentIds, values, "strong", "추천 이유", keys);
  }

  const positiveThemes = themeEvidence.filter((item) => item.state === "positive");
  if (positiveThemes.length > 0) {
    const labels = resolveThemes(candidate)
      .filter((theme) => positiveThemes.some((item) => item.key === themeIdentity(theme)))
      .map((theme) => theme.label)
      .slice(0, 2);
    if (labels.length > 0) {
      return reason("theme_match", `라이브러리에서 확인된 ${labels.join("·")} 취향과 일치해요.`, positiveThemes.flatMap((item) => item.source_content_ids), labels, "medium", "추천 이유");
    }
  }

  if (isExploration) {
    const theme = resolveThemes(candidate)[0];
    const detail = theme ? `${theme.label} 분위기를 담은 ` : "새로운 분위기의 ";
    return reason("exploration", `기존 선택과 다른 방향으로 ${detail}최신 인기작을 섞어봤어요.`, [], theme ? [theme.label] : [], "weak", "취향 탐색");
  }

  if (signal?.type === "shared_genres" || signal?.type === "preferred_genres") {
    return reason("broad_genre_match", `${values.join("·")} 장르가 일부 겹쳐요.`, sourceContentIds, values, "weak", "비슷한 점");
  }

  return reason("exploration", "새로운 취향 탐색을 위한 최근 인기작이에요.", [], [], "weak", "취향 탐색");
}

export function createRecommendationSignals(
  profile: RecommendationPreferenceProfile,
  candidate: RecommendationCandidate,
  libraryItems: readonly RecommendationLibraryItem[] = []
): RecommendationSignal[] {
  const positiveItems = libraryItems.filter((item) => getLibraryItemWeight(item) > 0);
  const directSignals: Array<{
    type: Extract<RecommendationSignalType, "shared_people" | "shared_studios" | "shared_keywords" | "shared_genres" | "shared_themes">;
    candidateValues: readonly string[] | null | undefined;
    libraryValues: (item: RecommendationLibraryItem) => readonly string[] | null | undefined;
    minimumMatches: number;
    displayValue?: (value: string) => string;
  }> = [
    { type: "shared_people", candidateValues: candidate.people, libraryValues: (item) => item.people, minimumMatches: 1 },
    { type: "shared_studios", candidateValues: candidate.studios, libraryValues: (item) => item.studios, minimumMatches: 1 },
    {
      type: "shared_themes",
      candidateValues: resolveThemes(candidate).map(themeIdentity),
      libraryValues: (item) => resolveThemes(item).map(themeIdentity),
      minimumMatches: 1,
      displayValue: (value) => resolveThemes(candidate).find((theme) => themeIdentity(theme) === value)?.label ?? value
    },
    { type: "shared_keywords", candidateValues: candidate.keywords, libraryValues: (item) => item.keywords, minimumMatches: 2 },
    { type: "shared_genres", candidateValues: candidate.genres, libraryValues: (item) => item.genres, minimumMatches: 2 }
  ];

  for (const definition of directSignals) {
    const matches = positiveItems
      .map((item) => ({ item, values: findSharedValues(definition.candidateValues, definition.libraryValues(item)) }))
      .filter((match) => match.values.length >= definition.minimumMatches)
      .sort((left, right) => right.values.length - left.values.length);
    if (matches.length > 0) {
      const values = Array.from(new Set(matches.flatMap((match) => match.values)))
        .map((value) => definition.displayValue?.(value) ?? value)
        .slice(0, 3);
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

// Mirrors scoreValues: a signal the profile has no evidence for is unavailable, not
// zero. calculateSimilarity normalizes over available weight, so returning 0 here
// would make carrying theme metadata cost more than having none at all.
function scoreThemeValues(
  profile: RecommendationPreferenceProfile,
  themes: readonly ContentTheme[]
): number | null {
  if (themes.length === 0 || profile.theme_evidence.size === 0) return null;
  const maximumPositive = Math.max(0, ...[...profile.theme_evidence.values()].map((item) => item.score));
  // centrality weights how much a theme counts toward the average rather than capping the
  // match itself: AniList ranks span 0.4-1.0 while TMDB keywords are a flat 0.45 and genre
  // backfill a flat 0.3, so scaling the score would rank identical matches by provenance.
  let weightedTotal = 0;
  let centralityTotal = 0;
  for (const theme of themes) {
    const evidence = profile.theme_evidence.get(themeIdentity(theme));
    // Scored against the strongest theme this profile holds, so implicit library evidence
    // saturates the same way genres and keywords do. Explicit feedback still outranks it
    // because it writes EXPLICIT_THEME_EVIDENCE_SCORE into the maximum.
    const match = !evidence || maximumPositive <= 0
      ? 0
      : evidence.state === "negative" ? -1 : clamp(evidence.score / maximumPositive, 0, 1);
    weightedTotal += match * theme.centrality;
    centralityTotal += theme.centrality;
  }
  if (centralityTotal <= 0) return null;
  return clamp(weightedTotal / centralityTotal, 0, 1);
}

function normalizeQuality(candidate: RecommendationCandidate): number {
  const score = finiteOr(candidate.rating_score, 0);
  const scale = candidate.rating_scale === 100 ? 100 : 10;
  const count = finiteOr(candidate.rating_count, finiteOr(candidate.vote_count, 0));
  if (score <= 0 || count <= 0) return 0;
  const confidence = clamp(Math.log10(count + 1) / 4, 0, 1);
  return clamp((score / scale) * confidence, 0, 1);
}

function resolveThemes(item: RecommendationCandidate | RecommendationLibraryItem): ContentTheme[] {
  const derivedThemes = normalizeContentThemes({
    external_source: item.external_source ?? ("source_api" in item ? item.source_api : null),
    genres: item.genres,
    keywords: item.keywords,
    source_tags: item.source_tags
  });
  const mergedThemes = new Map<string, ContentTheme>();
  for (const theme of [...(item.themes ?? []), ...derivedThemes]) {
    const key = themeIdentity(theme);
    const previous = mergedThemes.get(key);
    if (!previous || previous.centrality < theme.centrality) mergedThemes.set(key, theme);
  }
  return [...mergedThemes.values()].sort((left, right) => right.centrality - left.centrality);
}

function summarizePreferenceState(evidence: readonly PreferenceEvidence[]): PreferenceState {
  if (evidence.some((item) => item.state === "negative")) return "negative";
  if (evidence.some((item) => item.state === "positive")) return "positive";
  return "unknown";
}

function reason(
  type: RecommendationReason["type"],
  message: string,
  sourceContentIds: string[],
  values: string[],
  confidence: RecommendationReason["confidence"],
  label: RecommendationReason["label"],
  keys?: readonly string[]
): RecommendationReason {
  return {
    type,
    message,
    source_content_ids: Array.from(new Set(sourceContentIds)),
    signals: values.map((value, index) => ({ type, key: keys?.[index] ?? normalizeFeature(value), value, contribution: confidence === "strong" ? 1 : confidence === "medium" ? 0.6 : 0.2 })),
    confidence,
    label
  };
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

export function applyBatchDiversityConstraints<T extends RecommendationCandidate>(
  candidates: readonly RankedRecommendation<T>[],
  limit: number,
  profile?: RecommendationPreferenceProfile,
  config = RECOMMENDATION_DIVERSITY_CONFIG,
  enforcePrimaryGenreDiversity = true
): RankedRecommendation<T>[] {
  const selected: RankedRecommendation<T>[] = [];
  const franchises = new Set<string>();
  const primaryGenreCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();
  const unknownExplorationCounts = new Map<string, number>();
  const maxPerPrimaryGenre = limit <= 2 ? limit : Math.max(2, Math.ceil(limit * 0.67));

  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    const franchise = createFranchiseKey(candidate);
    if (franchises.has(franchise)) continue;
    const primaryGenre = enforcePrimaryGenreDiversity ? normalizeValues(candidate.genres)[0] ?? "" : "";
    if (primaryGenre && (primaryGenreCounts.get(primaryGenre) ?? 0) >= maxPerPrimaryGenre) continue;
    const nicheThemes = candidate.themes.filter((theme) => theme.centrality >= NICHE_THEME_CENTRALITY_THRESHOLD);
    let blocked = false;
    const unknownThemeKeys: string[] = [];
    for (const theme of nicheThemes) {
      const key = themeIdentity(theme);
      const evidence = profile?.theme_evidence.get(key);
      const strength = evidence?.strength ?? "none";
      const cap = strength === "excluded" ? config.excludedThemeCap
        : strength === "reduced" ? config.reducedThemeCap
        : strength === "strong" ? config.strongNicheThemeCap
        : strength === "weak" ? config.weakNicheThemeCap
        : config.unknownNicheThemeCap;
      if ((themeCounts.get(key) ?? 0) >= cap) blocked = true;
      if (!evidence || evidence.state === "unknown") unknownThemeKeys.push(key);
    }
    if (unknownThemeKeys.some((key) => (unknownExplorationCounts.get(key) ?? 0) >= config.unknownNicheExplorationSlots)) blocked = true;
    if (blocked) continue;

    selected.push(candidate);
    franchises.add(franchise);
    if (primaryGenre) primaryGenreCounts.set(primaryGenre, (primaryGenreCounts.get(primaryGenre) ?? 0) + 1);
    for (const theme of nicheThemes) {
      const key = themeIdentity(theme);
      themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
    }
    for (const key of unknownThemeKeys) {
      unknownExplorationCounts.set(key, (unknownExplorationCounts.get(key) ?? 0) + 1);
    }
  }

  return selected;
}

const selectDiverse = applyBatchDiversityConstraints;

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

function roundSignedScore(value: number): number {
  return Math.round(clamp(value, -1, 1) * 10_000) / 10_000;
}
