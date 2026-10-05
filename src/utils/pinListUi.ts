import type { EmotionType, PinSortMode, TimelinePin } from "../types/pins";
import { EMOTION_LABELS, EMOTION_OPTIONS } from "../constants/emotions";
import { ALL_GENRE_FILTER, createDisplayGenreNames, createGenreFilterOptions, matchesGenreFilter } from "./genre";
import { getHomeLayout } from "./homeLayout";
import { formatPinEpisodeLabel } from "./pinLabels";
import { formatSecondsToTimecode } from "./timecode";

export const PIN_DETAIL_PANEL_WIDTH = 360;
export const PIN_CARD_TAG_LIMIT = 3;
export const PIN_SORT_OPTIONS: readonly { label: string; value: PinSortMode }[] = [
  { label: "최신순", value: "latest" },
  { label: "작품별", value: "timeline" }
];
export const PINS_SCREEN_COPY = {
  title: "핀",
  subtitle: "감동적인 장면과 기억하고 싶은 대사를 모아보세요.",
  searchLabel: "핀 검색",
  searchPlaceholder: "작품명, 메모, 태그 검색",
  clearSearch: "검색어 지우기",
  sortLabel: "핀 정렬",
  filterButton: "필터",
  filterPanelTitle: "필터",
  filterPanelReset: "초기화",
  genreGroup: "장르",
  tagGroup: "태그",
  noTags: "아직 태그가 없어요. 핀을 남길 때 태그를 붙여 보세요.",
  emotionGroupLabel: "감정 필터",
  allOption: "전체",
  showAll: "전체 보기",
  partialError: "최신 핀을 불러오지 못해 저장된 기록을 보여 드려요.",
  retry: "다시 시도",
  emptyTitle: "아직 저장된 핀이 없어요",
  emptyDescription: "작품 상세에서 기억하고 싶은 장면을 핀으로 남겨 보세요.",
  emptyAction: "라이브러리 보기",
  noResultTitle: "조건에 맞는 핀이 없어요",
  noResultDescription: "검색어나 필터를 바꿔 보세요.",
  spoilerMasked: "스포일러가 포함된 메모예요",
  spoilerReveal: "스포일러 포함 · 보기",
  emptyMemo: "메모 없음",
  untitled: "제목 없음",
  noTime: "시간 미지정",
  memoSection: "메모",
  tagSection: "태그",
  savedAtPrefix: "저장일",
  openDetail: "핀 상세 열기",
  share: "공유",
  previewTitle: "핀 미리보기",
  previewDescription: "목록에서 핀을 고르면 여기에서 바로 볼 수 있어요.",
  selectHint: "오른쪽에 핀 내용을 보여 줘요",
  openHint: "핀 상세를 열어요"
} as const;

export function getPinCardPressAction(showDetailPanel: boolean): "select" | "open" {
  return showDetailPanel ? "select" : "open";
}

export interface PinsLayout {
  gutter: number;
  contentWidth: number;
  gap: number;
  showDetailPanel: boolean;
  detailPanelWidth: number;
  stackTools: boolean;
  posterWidth: number;
  cardPadding: number;
}

export function getPinsLayout(width: number): PinsLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const h = getHomeLayout(w);
  return {
    gutter: h.gutter,
    contentWidth: h.contentWidth,
    gap: h.posterGap,
    showDetailPanel: w >= 960,
    detailPanelWidth: PIN_DETAIL_PANEL_WIDTH,
    stackTools: w < 600,
    posterWidth: w < 600 ? 56 : 64,
    cardPadding: w < 600 ? 12 : 16
  };
}

export function getPinTimeLabel(pin: Pick<TimelinePin, "display_time_label" | "timestamp_seconds">): string {
  return pin.display_time_label ?? (pin.timestamp_seconds === null
    ? PINS_SCREEN_COPY.noTime : formatSecondsToTimecode(pin.timestamp_seconds));
}

export function formatPinDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, "0")}. ${String(date.getDate()).padStart(2, "0")}`;
}

export interface PinListFilters { query: string; emotion: EmotionType | "all"; genre: string }

export function filterPins<T extends TimelinePin>(pins: readonly T[], filters: PinListFilters): T[] {
  const q = filters.query.trim().toLocaleLowerCase();
  return pins.filter((pin) => {
    if (filters.emotion !== "all" && pin.emotion !== filters.emotion) return false;
    if (!matchesGenreFilter(pin.genres, filters.genre)) return false;
    if (!q) return true;
    return [
      pin.content_title, formatPinEpisodeLabel(pin), getPinTimeLabel(pin), pin.memo,
      pin.emotion ? EMOTION_LABELS[pin.emotion] : null,
      ...createDisplayGenreNames(pin.genres), ...(pin.tags ?? []).map((tag) => tag.name)
    ].some((field) => field?.toLocaleLowerCase().includes(q));
  });
}

export interface PinEmotionOption {
  value: EmotionType | "all";
  label: string;
  count: number;
  text: string;
  accessibilityLabel: string;
}

export function createEmotionFilterOptions(pins: readonly Pick<TimelinePin, "emotion">[], selected: EmotionType | "all"): PinEmotionOption[] {
  const counts = new Map<EmotionType, number>();
  for (const pin of pins) {
    if (pin.emotion) counts.set(pin.emotion, (counts.get(pin.emotion) ?? 0) + 1);
  }
  const emotions = EMOTION_OPTIONS.filter((value) => value !== "none" && (counts.get(value) ?? 0) > 0);
  emotions.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
    || EMOTION_OPTIONS.indexOf(a) - EMOTION_OPTIONS.indexOf(b));
  if (selected !== "all" && selected !== "none" && !emotions.includes(selected)) emotions.push(selected);
  const values: (EmotionType | "all")[] = ["all", ...emotions];
  return values.map((value) => {
    const label = value === "all" ? PINS_SCREEN_COPY.allOption : EMOTION_LABELS[value];
    const count = value === "all" ? pins.length : counts.get(value) ?? 0;
    const text = `${label} ${count.toLocaleString("ko-KR")}`;
    return { value, label, count, text, accessibilityLabel: text + "개" };
  });
}

export function createPinGenreOptions(pins: readonly Pick<TimelinePin, "genres">[], selected: string): string[] {
  return createGenreFilterOptions([
    ...pins.flatMap((pin) => pin.genres ?? []),
    ...(selected !== ALL_GENRE_FILTER ? [selected] : [])
  ], false);
}

export interface PinFilterSummary {
  panelCount: number;
  hasActive: boolean;
  buttonLabel: string;
  buttonAccessibilityLabel: string;
}

export function getPinFilterSummary(input: PinListFilters & { tagId: string | null }): PinFilterSummary {
  const panelCount = Number(input.genre !== ALL_GENRE_FILTER) + Number(input.tagId !== null);
  return {
    panelCount,
    hasActive: input.query.trim() !== "" || input.emotion !== "all" || panelCount > 0,
    buttonLabel: panelCount ? `필터 ${panelCount}` : PINS_SCREEN_COPY.filterButton,
    buttonAccessibilityLabel: panelCount ? `필터, ${panelCount}개 적용됨` : PINS_SCREEN_COPY.filterButton
  };
}

export function pinResultSummary(input: { shown: number; total: number; filtered: boolean }): string {
  return input.filtered
    ? `${Math.max(input.total, input.shown).toLocaleString("ko-KR")}개 중 ${input.shown.toLocaleString("ko-KR")}개`
    : `핀 ${input.total.toLocaleString("ko-KR")}개`;
}

export interface PinCardModel {
  title: string;
  episodeLabel: string | null;
  subtitle: string;
  dateLabel: string;
  timeLabel: string;
  emotionLabel: string | null;
  memo: string;
  memoHidden: boolean;
  memoEmpty: boolean;
  tags: string[];
  allTags: string[];
  extraTagCount: number;
  posterUrl: string | null;
  accessibilityLabel: string;
}

export function createPinCardModel(pin: TimelinePin, options: { spoilerRevealed: boolean }): PinCardModel {
  const rawMemo = pin.memo?.trim() ?? "";
  const memoHidden = pin.is_spoiler && !options.spoilerRevealed && rawMemo !== "";
  const memoEmpty = rawMemo === "";
  const title = pin.content_title?.trim() || PINS_SCREEN_COPY.untitled;
  const episodeLabel = formatPinEpisodeLabel(pin);
  const dateLabel = formatPinDate(pin.created_at);
  const timeLabel = getPinTimeLabel(pin);
  const emotionLabel = pin.emotion && pin.emotion !== "none" ? EMOTION_LABELS[pin.emotion] : null;
  const allTags = (pin.tags ?? []).map((tag) => `#${tag.name}`);
  return {
    title, episodeLabel, subtitle: [episodeLabel, dateLabel].filter(Boolean).join(" · "),
    dateLabel, timeLabel, emotionLabel,
    memo: memoHidden ? PINS_SCREEN_COPY.spoilerMasked : memoEmpty ? PINS_SCREEN_COPY.emptyMemo : rawMemo,
    memoHidden, memoEmpty, tags: allTags.slice(0, PIN_CARD_TAG_LIMIT), allTags,
    extraTagCount: Math.max(0, allTags.length - PIN_CARD_TAG_LIMIT),
    posterUrl: pin.content_poster_url?.trim() || null,
    accessibilityLabel: [
      title, episodeLabel, timeLabel, emotionLabel,
      memoHidden ? "스포일러 메모 숨김" : memoEmpty ? null : rawMemo,
      dateLabel ? `${PINS_SCREEN_COPY.savedAtPrefix} ${dateLabel}` : null
    ].filter(Boolean).join(", ")
  };
}
