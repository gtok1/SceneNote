import { it } from "node:test";
import assert from "node:assert/strict";
import { createLibraryDeleteConfirmCopy, LIBRARY_DELETE_ZONE_COPY } from "./libraryFeedbackCopy";
import { userFacingErrorMessage } from "./profileDashboard";
it("D-1: exact library deletion copy", () => assert.deepEqual(createLibraryDeleteConfirmCopy("무빙"), { title: "내 목록에서 삭제할까요?", message: "‘무빙’의 감상 상태, 본 횟수, 시청 위치, 감상 날짜가 삭제됩니다. 남긴 핀과 회차 체크, 평점은 그대로 남아요.", confirmLabel: "삭제", cancelLabel: "취소" }));
it("D-2: trim title and fallback for blank title", () => {
  assert.ok(createLibraryDeleteConfirmCopy("   ").message.startsWith("‘이 작품’의 감상 상태,"));
  assert.ok(createLibraryDeleteConfirmCopy("  무빙 ").message.startsWith("‘무빙’의 감상 상태,"));
});

it("Z-T1: exact library delete zone copy", () => {
  assert.deepEqual(LIBRARY_DELETE_ZONE_COPY, {
    title: "목록 관리",
    description: "삭제하면 감상 상태·본 횟수·시청 위치·감상 날짜가 지워져요. 핀·회차 체크·평점은 남아요.",
    actionLabel: "내 목록에서 삭제",
    pendingLabel: "삭제 중",
    errorFallback: "내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
  });
});

it("Z-T2: English server errors use the Korean deletion fallback", () => {
  assert.equal(
    userFacingErrorMessage(new Error("Edge Function returned a non-2xx status code"), LIBRARY_DELETE_ZONE_COPY.errorFallback),
    "내 목록에서 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
  );
});

it("Z-T3: delete zone and confirmation describe the same four deleted fields", () => {
  for (const field of ["감상 상태", "본 횟수", "시청 위치", "감상 날짜"]) {
    assert.ok(LIBRARY_DELETE_ZONE_COPY.description.includes(field), `Card description includes ${field}`);
    assert.ok(createLibraryDeleteConfirmCopy("무빙").message.includes(field), `Confirmation includes ${field}`);
  }
});
