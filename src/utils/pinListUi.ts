import type { EmotionType, PinSortMode, PinViewMode, TimelinePin } from "../types/pins";
import { EMOTION_LABELS, EMOTION_OPTIONS } from "../constants/emotions";
import { ALL_GENRE_FILTER, createDisplayGenreNames, createGenreFilterOptions, matchesGenreFilter } from "./genre";
import { getHomeLayout } from "./homeLayout";
import { formatPinEpisodeLabel } from "./pinLabels";
import { sortPinsByScene } from "./pinSort";
import { formatSecondsToTimecode } from "./timecode";

export const PIN_DETAIL_PANEL_WIDTH = 360;
export const PIN_CARD_TAG_LIMIT = 3;
export const PIN_GROUP_POSTER_WIDTH = 40;
export const PIN_PANEL_TIMELINE_LIMIT = 5;
export const PIN_CONTEXT_COPY = {
  today: "오늘",
  yesterday: "어제",
  currentPin: "지금 보는 핀",
  showAllPins: "모두 보기",
  showAllPinsLabel: "이 작품의 핀 모두 보기",
  openContent: "작품 보기",
  addPin: "핀 추가",
  addPinToEpisode: "이 회차에 핀 추가",
  addPinToContent: "이 작품에 핀 추가",
  timelineSelectHint: "이 핀을 미리보기로 보여 줘요",
  groupHint: "작품 상세를 열어요"
} as const;
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

export function formatPinRelativeDate(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  const diff = day(now) - day(date);
  if (diff <= 0) return PIN_CONTEXT_COPY.today;
  if (diff === 1) return PIN_CONTEXT_COPY.yesterday;
  if (diff <= 6) return `${diff}일 전`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return formatPinDate(value);
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
  relativeDateLabel: string;
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

export function createPinCardModel(pin: TimelinePin, options: { spoilerRevealed: boolean; now?: Date }): PinCardModel {
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
    title, episodeLabel, relativeDateLabel: formatPinRelativeDate(pin.created_at, options.now),
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

export type PinListRow =
  | {
      type: "group";
      key: string;
      contentId: string;
      title: string;
      posterUrl: string | null;
      count: number;
      countLabel: string;
      accessibilityLabel: string;
    }
  | { type: "pin"; key: string; pin: TimelinePin; grouped: boolean };

export function buildPinListRows(pins: readonly TimelinePin[], mode: PinSortMode): PinListRow[] {
  if (mode === "latest") return pins.map(pin => ({ type: "pin", key: `pin:${pin.id}`, pin, grouped: false }));
  const groups = new Map<string, TimelinePin[]>();
  for (const pin of pins) {
    const group = groups.get(pin.content_id);
    if (group) group.push(pin);
    else groups.set(pin.content_id, [pin]);
  }
  const rows: PinListRow[] = [];
  for (const [contentId, group] of groups) {
    const first = group[0]!;
    const title = first.content_title?.trim() || PINS_SCREEN_COPY.untitled;
    const countLabel = `핀 ${group.length.toLocaleString("ko-KR")}개`;
    rows.push({
      type: "group", key: `group:${contentId}`, contentId, title,
      posterUrl: first.content_poster_url?.trim() || null,
      count: group.length, countLabel, accessibilityLabel: `${title}, ${countLabel}`
    });
    rows.push(...group.map((pin): PinListRow => ({ type: "pin", key: `pin:${pin.id}`, pin, grouped: true })));
  }
  return rows;
}

export function findPinRowIndex(rows: readonly PinListRow[], pinId: string): number {
  return rows.findIndex(row => row.type === "pin" && row.pin.id === pinId);
}

export interface PinPanelTimelineItem {
  id: string;
  label: string;
  memo: string;
  memoHidden: boolean;
  memoEmpty: boolean;
  current: boolean;
  accessibilityLabel: string;
}

export interface PinPanelTimeline {
  title: string;
  total: number;
  items: PinPanelTimelineItem[];
}

export function createPinPanelTimeline(input: {
  pins: readonly TimelinePin[];
  selectedId: string;
  mode: PinSortMode;
  filtered: boolean;
  revealedIds: ReadonlySet<string>;
  limit?: number;
}): PinPanelTimeline | null {
  const selected = input.pins.find(pin => pin.id === input.selectedId);
  if (!selected || input.mode !== "latest") return null;
  const sorted = sortPinsByScene(input.pins.filter(pin => pin.content_id === selected.content_id));
  const total = sorted.length;
  if (total < 2) return null;
  const limit = Math.max(1, Math.floor(input.limit ?? PIN_PANEL_TIMELINE_LIMIT));
  const index = sorted.findIndex(pin => pin.id === input.selectedId);
  const start = Math.min(Math.max(0, index - Math.floor(limit / 2)), Math.max(0, total - limit));
  const items = sorted.slice(start, start + limit).map(pin => {
    const model = createPinCardModel(pin, { spoilerRevealed: input.revealedIds.has(pin.id) });
    const label = [formatPinEpisodeLabel(pin, { includeTitle: false }), getPinTimeLabel(pin)].filter(Boolean).join(" · ");
    const current = pin.id === input.selectedId;
    return {
      id: pin.id, label, memo: model.memo, memoHidden: model.memoHidden, memoEmpty: model.memoEmpty, current,
      accessibilityLabel: [
        label, model.memoHidden ? "스포일러 메모 숨김" : model.memoEmpty ? null : model.memo,
        current ? PIN_CONTEXT_COPY.currentPin : null
      ].filter(Boolean).join(", ")
    };
  });
  const count = total.toLocaleString("ko-KR");
  return { title: input.filtered ? `조건에 맞는 핀 ${count}개` : `이 작품의 핀 ${count}개`, total, items };
}

export function getPinAddAccessibilityLabel(pin: Pick<TimelinePin, "episode_id">): string {
  return pin.episode_id ? PIN_CONTEXT_COPY.addPinToEpisode : PIN_CONTEXT_COPY.addPinToContent;
}

export const PIN_GALLERY_MEMO_LINES = 2;
export const PIN_SCENE_MEMO_LINES = 4;

export const PIN_VIEW_COPY = {
  toggleLabel: "보기 방식",
  loading: "핀을 불러오는 중이에요"
} as const;

export const PIN_VIEW_OPTIONS: readonly {
  value: PinViewMode;
  label: string;
  icon: "grid-outline" | "list-outline";
}[] = [
  { value: "gallery", label: "갤러리 보기", icon: "grid-outline" },
  { value: "list", label: "목록 보기", icon: "list-outline" }
];

/** 라이브러리 갤러리(libraryResponsive.ts)와 같은 열 경계. 글자 배율만큼 폭을 줄여 본다. */
export function getPinGalleryColumns(width: number, fontScale = 1): number {
  const base = Number.isFinite(width) && width > 0 ? width : 375;
  const w = base / Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  if (w >= 1280) return 6;
  if (w >= 960) return 5;
  if (w >= 700) return 4;
  return 2;
}

export interface PinViewPresentation {
  gallery: boolean;
  showDetailPanel: boolean;
  pressAction: "select" | "open";
  numColumns: number;
}

export function getPinViewPresentation(input: { viewMode: PinViewMode; width: number; fontScale?: number }): PinViewPresentation {
  const gallery = input.viewMode === "gallery";
  const showDetailPanel = !gallery && getPinsLayout(input.width).showDetailPanel;
  return {
    gallery,
    showDetailPanel,
    pressAction: getPinCardPressAction(showDetailPanel),
    numColumns: gallery ? getPinGalleryColumns(input.width, input.fontScale) : 1
  };
}

export interface PinGalleryCardModel {
  title: string;
  sceneLabel: string;
  timeLabel: string;
  emotionLabel: string | null;
  memo: string;
  memoHidden: boolean;
  memoEmpty: boolean;
  relativeDateLabel: string;
  posterUrl: string | null;
  accessibilityLabel: string;
}

export function createPinGalleryCardModel(pin: TimelinePin, options: { spoilerRevealed: boolean; now?: Date }): PinGalleryCardModel {
  const base = createPinCardModel(pin, options);
  return {
    title: base.title,
    sceneLabel: formatPinEpisodeLabel(pin, { includeTitle: false }) ?? "",
    timeLabel: base.timeLabel,
    emotionLabel: base.emotionLabel,
    memo: base.memo,
    memoHidden: base.memoHidden,
    memoEmpty: base.memoEmpty,
    relativeDateLabel: base.relativeDateLabel,
    posterUrl: base.posterUrl,
    accessibilityLabel: base.accessibilityLabel
  };
}

export function getPinGalleryRowSpan(row: PinListRow, maxColumns: number): number {
  return row.type === "group" ? Math.max(1, maxColumns) : 1;
}
