export interface ConfirmCopy { title: string; message: string; confirmLabel: string; cancelLabel: string }
export function createLibraryDeleteConfirmCopy(contentTitle: string): ConfirmCopy {
  const name = contentTitle.trim() || "이 작품";
  return { title: "내 목록에서 삭제할까요?", message: `‘${name}’의 감상 상태, 본 횟수, 시청 위치, 감상 날짜가 삭제됩니다. 남긴 핀과 회차 체크, 평점은 그대로 남아요.`, confirmLabel: "삭제", cancelLabel: "취소" };
}

export const LIBRARY_DELETE_ZONE_COPY = {
  title: "목록 관리",
  description: "삭제하면 감상 상태·본 횟수·시청 위치·감상 날짜가 지워져요. 핀·회차 체크·평점은 남아요.",
  actionLabel: "내 목록에서 삭제",
  pendingLabel: "삭제 중",
  errorFallback: "내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
} as const;
