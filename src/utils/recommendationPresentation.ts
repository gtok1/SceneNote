import type { PersonalizedRecommendation } from "@/services/personalizedRecommendations";
import { createDisplayGenreNames, getGenreDisplayName } from "@/utils/genre";

import type { RecommendationSignal } from "../../supabase/functions/_shared/recommendationEngine";

export interface RecommendationPresentation {
  hook: string | null;
  personalizedReason: string | null;
  reasonLabel: "추천 이유" | "비슷한 점" | "취향 탐색" | null;
  reasonConfidence: "strong" | "medium" | "weak" | null;
  recommendationSignals: RecommendationSignal[];
  ratingLabel: string | null;
  popularityLabel: string | null;
  releaseStatusLabel: string | null;
  metadataLabel: string;
  sourceLabel: string | null;
  displayGenres: string[];
  statusBadges: string[];
  fullOverview: string | null;
}

const RELEASE_STATUS_LABELS: Record<string, string> = {
  RELEASING: "방영 중",
  FINISHED: "완결",
  NOT_YET_RELEASED: "공개 예정",
  CANCELLED: "취소",
  HIATUS: "휴방"
};

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV 시리즈",
  TV_SHORT: "TV 단편",
  MOVIE: "영화",
  SPECIAL: "스페셜",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "뮤직비디오"
};

export function mapRecommendationToCardViewModel(
  item: PersonalizedRecommendation,
  now = new Date()
): RecommendationPresentation {
  const recommendationSignals = item.recommendation_signals ?? [];
  const releaseStatusLabel = buildReleaseStatusLabel(item.release_status);
  return {
    hook: buildRecommendationHook(item),
    personalizedReason: buildPersonalizedReason(item, recommendationSignals),
    reasonLabel: item.recommendation_reason_detail?.label ?? (recommendationSignals.length > 0 ? "추천 이유" : null),
    reasonConfidence: item.recommendation_reason_detail?.confidence ?? null,
    recommendationSignals,
    ratingLabel: buildRatingPresentation(item),
    popularityLabel: buildPopularityPresentation(item),
    releaseStatusLabel,
    metadataLabel: buildReleaseMetadata(item),
    sourceLabel: buildSourceLabel(item.external_source),
    displayGenres: createDisplayGenreNames(item.genres),
    statusBadges: buildStatusBadges(item, releaseStatusLabel, now),
    fullOverview: chooseRecommendationOverview(
      item.content_type,
      item.localized_overview,
      item.overview
    )
  };
}

export function cleanOfficialOverview(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const decoded = decodeBasicEntities(value)
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/(^|\s)[#>]+/gu, "$1")
    .replace(/[*_~`]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^(?:이\s*(?:작품|애니(?:메이션)?|드라마|영화)(?:은|는)\s*)/u, "")
    .trim();
  return decoded || null;
}

export function chooseRecommendationOverview(
  contentType: PersonalizedRecommendation["content_type"],
  ...values: (string | null | undefined)[]
): string | null {
  const overviews = values.map(cleanOfficialOverview).filter((value): value is string => Boolean(value));
  if (contentType === "anime") {
    return overviews.find(hasHangul) ?? null;
  }
  return overviews[0] ?? null;
}

export function buildRecommendationHook(item: PersonalizedRecommendation): string | null {
  const overview = chooseRecommendationOverview(
    item.content_type,
    item.localized_overview,
    item.overview
  );
  if (overview) return shortenOverview(overview, 130);

  const signals = [
    ...createDisplayGenreNames(item.genres).slice(0, 2),
    ...(item.content_type === "anime"
      ? []
      : (item.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean).slice(0, 1)),
    formatLabel(item.format),
    item.content_type === "anime" ? null : item.studios?.[0]?.trim() || null,
    buildReleaseStatusLabel(item.release_status)
  ].filter((value): value is string => Boolean(value));
  if (signals.length === 0) return null;
  return `${Array.from(new Set(signals)).slice(0, 4).join(" · ")} 작품`;
}

export function buildPersonalizedReason(
  item: PersonalizedRecommendation,
  signals: readonly RecommendationSignal[] = item.recommendation_signals ?? []
): string | null {
  if (item.recommendation_reason_detail?.message) return item.recommendation_reason_detail.message;
  const signal = signals[0];
  if (!signal) return buildNonPersonalizedReason(item);

  const titles = signal.library_titles.filter(hasHangul).slice(0, 2).map(shortenTitle);
  const titleLabel = titles.map((title) => `‘${title}’`).join(", ");
  const values = signal.values.slice(0, 2);

  if (signal.type === "shared_people" && values.length > 0) {
    return titleLabel
      ? `${titleLabel}와 ${values.join("·")} 참여진이 같아요.`
      : `${values.join("·")} 참여진이 라이브러리 작품과 같아요.`;
  }
  if (signal.type === "shared_studios" && values.length > 0) {
    return titleLabel
      ? `${titleLabel}와 같은 ${values.join("·")} 제작 작품이에요.`
      : `라이브러리에 추가한 작품과 같은 ${values.join("·")} 제작 작품이에요.`;
  }
  if (signal.type === "shared_keywords" && values.length > 0) {
    return titleLabel
      ? `${titleLabel}와 핵심 태그 ${values.length}개가 겹쳐요.`
      : `라이브러리에 추가한 작품과 핵심 태그 ${values.length}개가 겹쳐요.`;
  }
  if (signal.type === "shared_genres" && values.length > 0) {
    const genreLabel = values.map(getGenreDisplayName).join("·");
    return titleLabel
      ? `${titleLabel}와 ${genreLabel} 장르가 겹쳐요.`
      : `라이브러리에 추가한 작품과 ${genreLabel} 장르가 겹쳐요.`;
  }
  if (signal.type === "preferred_genres" && values.length > 0) {
    return `라이브러리에서 자주 선택한 ${values.map(getGenreDisplayName).join("·")} 조합과 일치해요.`;
  }
  if (signal.type === "content_pattern") {
    return "라이브러리에서 자주 선택한 작품과 비슷한 분량이에요.";
  }
  return buildNonPersonalizedReason(item);
}

export function buildRatingPresentation(item: PersonalizedRecommendation): string | null {
  const score = finitePositive(item.rating_score);
  if (!score) return null;
  if (item.rating_scale === 10) {
    const count = finitePositive(item.rating_count);
    if (!count || count < 20) return null;
    return `평점 ${Math.min(score, 10).toFixed(1)} · ${formatCompactNumber(count)}명`;
  }
  if (item.rating_scale === 100) {
    const sample = finitePositive(item.rating_count);
    if (!sample || sample < 100) return null;
    return `평점 ${Math.round(Math.min(score, 100))}%`;
  }
  return null;
}

export function buildPopularityPresentation(item: PersonalizedRecommendation): string | null {
  const popularityCount = finitePositive(item.popularity_count);
  if (popularityCount) return `관심 ${formatCompactNumber(popularityCount)}`;
  const rank = finitePositive(item.rank);
  return rank && rank <= 20 ? `이번 달 인기 ${Math.floor(rank)}위` : null;
}

export function buildReleaseStatusLabel(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  return RELEASE_STATUS_LABELS[status.trim().toLocaleUpperCase()] ?? null;
}

export function buildReleaseMetadata(item: PersonalizedRecommendation): string {
  const release = buildReleaseDateLabel(item.air_date, item.air_year);
  const amount = item.episode_count && item.episode_count > 0
    ? `${Math.floor(item.episode_count)}화`
    : item.has_seasons && item.format
      ? formatLabel(item.format)
      : null;
  const duration = item.duration_minutes && item.duration_minutes > 0
    ? `회당 ${Math.floor(item.duration_minutes)}분`
    : null;
  const status = buildReleaseStatusLabel(item.release_status);
  return [release, amount, duration, status].filter(Boolean).join(" · ");
}

function buildNonPersonalizedReason(item: PersonalizedRecommendation): string | null {
  const genres = createDisplayGenreNames(item.genres).slice(0, 2);
  if (finitePositive(item.popularity_count) || (finitePositive(item.rank) ?? Infinity) <= 20) {
    return genres.length > 0
      ? `이번 달 공개작 중 주목도가 높은 ${genres.join("·")} 작품이에요.`
      : "이번 달 공개작 중 주목도가 높은 작품이에요.";
  }
  if (item.air_date || item.air_year) {
    return genres.length > 0
      ? `최근 공개된 ${genres.join("·")} 작품이에요.`
      : "최근 공개된 작품이에요.";
  }
  return null;
}

function buildStatusBadges(
  item: PersonalizedRecommendation,
  releaseStatusLabel: string | null,
  now: Date
): string[] {
  const badges: string[] = [];
  const releaseDate = item.air_date ? new Date(`${item.air_date}T00:00:00.000Z`) : null;
  if (releaseDate && Number.isFinite(releaseDate.getTime())) {
    const age = now.getTime() - releaseDate.getTime();
    if (age >= 0 && age <= 120 * 24 * 60 * 60 * 1000) badges.push("신작");
  }
  if (releaseStatusLabel) badges.push(releaseStatusLabel);
  return Array.from(new Set(badges)).slice(0, 2);
}

function buildReleaseDateLabel(date: string | null | undefined, year: number | null): string | null {
  const match = date ? /^(\d{4})-(\d{2})/.exec(date) : null;
  if (match?.[1] && match[2]) return `${match[1]}.${match[2]} 공개`;
  return year && year > 0 ? `${year} 공개` : null;
}

function shortenOverview(overview: string, maximum: number): string {
  if (overview.length <= maximum) return overview;
  const candidate = overview.slice(0, maximum + 1);
  const sentenceEnd = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("다. "), candidate.lastIndexOf("요. "));
  const wordEnd = candidate.lastIndexOf(" ");
  const cutAt = sentenceEnd >= 70 ? sentenceEnd + 1 : wordEnd >= 70 ? wordEnd : maximum;
  return `${overview.slice(0, cutAt).trim().replace(/[,:;·-]+$/u, "")}…`;
}

function shortenTitle(title: string): string {
  const normalized = title.trim();
  return normalized.length <= 24 ? normalized : `${normalized.slice(0, 23).trim()}…`;
}

function formatLabel(format: string | null | undefined): string | null {
  if (!format?.trim()) return null;
  return FORMAT_LABELS[format.trim().toLocaleUpperCase()] ?? format.trim();
}

function buildSourceLabel(source: PersonalizedRecommendation["external_source"]): string | null {
  if (source === "anilist") return "AniList";
  if (source === "tmdb") return "TMDB";
  if (source === "kitsu") return "Kitsu";
  if (source === "tvmaze") return "TVmaze";
  return null;
}

function formatCompactNumber(value: number): string {
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1).replace(/\.0$/u, "")}만`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/u, "")}천`;
  return String(Math.floor(value));
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function hasHangul(value: string | null | undefined): boolean {
  return /[가-힣]/u.test(value ?? "");
}

function decodeBasicEntities(value: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&nbsp;": " "
  };
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/giu, (entity) => entities[entity.toLocaleLowerCase()] ?? entity);
}
