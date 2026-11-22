import type { MyLibraryShare } from "@/types/libraryShare";

export const LIBRARY_SHARE_MANAGEMENT_COPY = {
  screenTitle: "공유 링크",
  description: "만든 공유 링크예요. 링크를 받은 사람은 그 작품들의 상태·본 횟수·별점·한줄 후기를 볼 수 있어요. 공유를 멈추면 그 링크는 바로 열리지 않아요.",
  emptyTitle: "만든 공유 링크가 없어요.",
  emptyDescription: "라이브러리에서 필터를 고른 뒤 공유하면 여기에 모여요.",
  emptyAction: "라이브러리로 가기",
  loadFailed: "공유 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
  resend: "다시 보내기",
  stop: "공유 중지",
  stopping: "멈추는 중",
  stopped: "공유를 멈췄어요.",
  stopFailed: "공유를 멈추지 못했어요. 잠시 후 다시 시도해 주세요.",
  copied: "링크를 복사했어요.",
  resendFailed: "링크를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
  tooManyNote: "최근 100개만 보여요. 오래된 링크는 최근 링크를 멈춘 뒤 확인할 수 있어요.",
  createdHint: "링크를 받은 사람은 이 작품들의 상태·별점·한줄 후기를 볼 수 있어요. 프로필 > 공유 링크에서 언제든 멈출 수 있어요."
} as const;

export const LIBRARY_SHARE_APP_ONLY_COPY = {
  resendUnavailable: "앱에서는 아직 링크를 보낼 수 없어요. 공유 중지는 여기서 할 수 있어요.",
  emptyDescription: "공유 링크는 웹에서 만들 수 있어요."
} as const;

export function shouldShowLibrarySharesEntry(input: {
  featureEnabled: boolean;
  linksAvailable: boolean;
  count: number | null;
}): boolean {
  return input.featureEnabled && (input.linksAvailable || (input.count ?? 0) > 0);
}

export type LibraryShareStopOutcome = "stopped" | "already_gone" | "denied";

export function resolveLibraryShareStop(input: { deletedCount: number; stillExists: boolean }): LibraryShareStopOutcome {
  if (input.deletedCount > 0) return "stopped";
  return input.stillExists ? "denied" : "already_gone";
}

const createdAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function formatLibraryShareCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return createdAtFormatter.formatToParts(date)
    .filter(part => part.type === "year" || part.type === "month" || part.type === "day")
    .map(part => part.value)
    .join(".");
}

export function libraryShareRowMeta(share: Pick<MyLibraryShare, "itemCount" | "createdAt">): string {
  const count = `작품 ${share.itemCount.toLocaleString("ko-KR")}개`;
  const date = formatLibraryShareCreatedAt(share.createdAt);
  return date ? `${count} · ${date} 만듦` : count;
}

export function describeLibraryShareCount(count: number | null): string {
  if (count === null) return "";
  return count === 0 ? "없음" : `${count.toLocaleString("ko-KR")}개`;
}

export function libraryShareStopConfirm(title: string) {
  return {
    title: "공유를 멈출까요?",
    message: `「${title}」 링크를 받은 사람은 더 이상 이 목록을 볼 수 없어요. 되돌릴 수 없어요.`,
    confirmLabel: LIBRARY_SHARE_MANAGEMENT_COPY.stop
  };
}

export function removeLibraryShare<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter(share => share.id !== id);
}
