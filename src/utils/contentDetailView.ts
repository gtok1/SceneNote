import type { ContentType } from "@/types/content";
import type { WatchStatus } from "@/types/library";
import { WATCH_STATUS_LABEL } from "@/constants/status";
import { getHomeLayout } from "@/utils/homeLayout";
import { CONTENT_TYPE_LABELS } from "@/utils/libraryFilters";

export const CONTENT_DETAIL_SIDE_WIDTH = 360;
export const EPISODE_PROGRESS_COMPLETED_COPY = {
  modeLabel: "완료로 표시됨",
  summary: "모든 화 시청 완료",
  hint: "완료 상태라 모든 화를 본 것으로 계산해요. 다시 보고 있다면 상태를 '보는 중'으로 바꾸면 진행 위치를 고칠 수 있어요."
} as const;
export const MANUAL_PROGRESS_COPY = {
  undo: "되돌리기",
  saveFailed: "시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  completedNotice: "완료 상태라 모든 화를 본 것으로 표시돼요. 상태를 '보는 중'으로 바꾸면 진행 위치를 정할 수 있어요.",
  resetTitle: "시청 진행 되돌리기",
  resetMessage: "직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?",
  resetConfirm: "되돌리기",
  reviewSaveFailed: "감상 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
} as const;
export function manualProgressSavedToast(episodeNumber: number): string {
  return `${Math.max(0, Math.floor(episodeNumber))}화까지 봤음으로 표시했어요.`;
}
export function isEpisodeProgressCompletedMode(input: { statuses: readonly WatchStatus[]; totalEpisodes: number | null }): boolean {
  return input.statuses.includes("completed") && input.totalEpisodes !== null && input.totalEpisodes > 0;
}
export const PRIMARY_WATCH_STATUSES: readonly WatchStatus[] = ["wishlist", "watching", "dropped", "completed"];
export const SECONDARY_WATCH_STATUSES: readonly WatchStatus[] = ["recommended", "not_recommended"];
export interface ContentDetailLayout {
  gutter: number; contentWidth: number; gap: number; columns: 1 | 2;
  mainWidth: number; sideWidth: number; poster: { width: number; height: number };
}
export function getContentDetailLayout(width: number): ContentDetailLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const home = getHomeLayout(w);
  const columns = w >= 960 ? 2 : 1;
  const sideWidth = columns === 2 ? CONTENT_DETAIL_SIDE_WIDTH : home.contentWidth;
  return { gutter: home.gutter, contentWidth: home.contentWidth, gap: home.posterGap, columns,
    mainWidth: columns === 2 ? home.contentWidth - sideWidth - home.posterGap : home.contentWidth,
    sideWidth, poster: w < 600 ? { width: 96, height: 144 } : { width: 160, height: 240 } };
}
export function createContentDetailMetaItems(input: { contentType: ContentType; airDateLabel: string | null; episodeLabel: string | null }): string[] {
  return [CONTENT_TYPE_LABELS[input.contentType] ?? "기타", input.airDateLabel, input.episodeLabel].filter((item): item is string => Boolean(item));
}
export function pinListLabel(pinCount: number | null | undefined): string {
  return pinCount ? `핀 목록 ${pinCount.toLocaleString("ko-KR")}` : "핀 목록";
}
export interface WatchStatusOption { status: WatchStatus; label: string; selected: boolean }
export function createWatchStatusControlModel(selected: readonly WatchStatus[], inLibrary: boolean): { title: string; hint: string | null; primary: WatchStatusOption[]; secondary: WatchStatusOption[] } {
  const option = (status: WatchStatus): WatchStatusOption => ({ status, label: WATCH_STATUS_LABEL[status], selected: selected.includes(status) });
  return { title: inLibrary ? "내 상태" : "내 목록에 추가", hint: inLibrary ? null : "상태를 고르면 내 목록에 추가돼요.", primary: PRIMARY_WATCH_STATUSES.map(option), secondary: inLibrary ? SECONDARY_WATCH_STATUSES.map(option) : [] };
}
export type ContentDetailSection = "progress" | "watchCount" | "providers" | "review" | "overview" | "cast" | "danger";
export function contentDetailSections(input: { columns: 1 | 2; inLibrary: boolean; isSeries: boolean; hasCast: boolean; peopleEnabled: boolean }): { main: ContentDetailSection[]; side: ContentDetailSection[] } {
  const enabled = (section: ContentDetailSection) => {
    switch (section) {
      case "progress": return input.inLibrary && input.isSeries;
      case "watchCount": case "review": case "danger": return input.inLibrary;
      case "cast": return input.hasCast && input.peopleEnabled;
      default: return true;
    }
  };
  const main: ContentDetailSection[] = input.columns === 2 ? ["progress", "review", "overview", "cast"] : ["progress", "watchCount", "providers", "review", "overview", "cast", "danger"];
  const side: ContentDetailSection[] = input.columns === 2 ? ["providers", "watchCount", "danger"] : [];
  return { main: main.filter(enabled), side: side.filter(enabled) };
}
