import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

function readSource(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url).href), "utf8");
}

it("88 T-1: created dates are shown in Korean time", async () => {
  const { formatLibraryShareCreatedAt } = await import("./libraryShareManagement");
  assert.equal(formatLibraryShareCreatedAt("2026-11-19T15:30:00.000Z"), "2026.11.20");
  assert.equal(formatLibraryShareCreatedAt("2026-11-19T14:59:00.000Z"), "2026.11.19");
  assert.equal(formatLibraryShareCreatedAt("bad"), "");
});

it("88 T-2: row meta shows count and date", async () => {
  const { libraryShareRowMeta } = await import("./libraryShareManagement");
  assert.equal(libraryShareRowMeta({ itemCount: 12, createdAt: "2026-11-19T15:30:00.000Z" }), "작품 12개 · 2026.11.20 만듦");
  assert.equal(libraryShareRowMeta({ itemCount: 1234, createdAt: "bad" }), "작품 1,234개");
});

it("88 T-3: profile summary counts links", async () => {
  const { describeLibraryShareCount } = await import("./libraryShareManagement");
  assert.deepEqual([null, 0, 3, 1200].map(describeLibraryShareCount), ["", "없음", "3개", "1,200개"]);
});

it("88 T-4: stopping asks with the share title", async () => {
  const { libraryShareStopConfirm } = await import("./libraryShareManagement");
  assert.deepEqual(libraryShareStopConfirm("완료한 한국 드라마"), {
    title: "공유를 멈출까요?",
    message: "「완료한 한국 드라마」 링크를 받은 사람은 더 이상 이 목록을 볼 수 없어요. 되돌릴 수 없어요.",
    confirmLabel: "공유 중지"
  });
});

it("88 T-5: removing a link keeps the others and the input", async () => {
  const { removeLibraryShare } = await import("./libraryShareManagement");
  const input = Object.freeze([{ id: "first" }, { id: "middle" }, { id: "last" }]);
  assert.deepEqual(removeLibraryShare(input, "middle"), [input[0], input[2]]);
  const untouched = removeLibraryShare(input, "missing");
  assert.notStrictEqual(untouched, input);
  assert.deepEqual(untouched, input);
  assert.deepEqual(input.map(row => row.id), ["first", "middle", "last"]);
});

it("88 T-6: the management screen is wired", () => {
  assert.ok(readSource("../../app/_layout.tsx").includes('name="settings/library-shares"'), "missing settings route");
  const screen = readSource("../../app/settings/library-shares.tsx");
  for (const marker of ["confirmDestructive(", "useDeleteLibraryShare(", "SHARE_FEATURES_ENABLED"]) {
    assert.ok(screen.includes(marker), marker);
  }
  assert.ok(!screen.includes("Alert.alert"));
  assert.ok(readSource("../components/profile/AccountSection.tsx").includes("onOpenLibraryShares"));
  const profile = readSource("../../app/(tabs)/profile.tsx");
  assert.ok(profile.includes("SHARE_FEATURES_ENABLED"));
  assert.ok(profile.includes("/settings/library-shares"));
  assert.ok(readSource("../../app/(tabs)/library.tsx").includes("LIBRARY_SHARE_MANAGEMENT_COPY.createdHint"));
});

it("88 T-7: management copy is fixed", async () => {
  const { LIBRARY_SHARE_MANAGEMENT_COPY } = await import("./libraryShareManagement");
  assert.deepEqual(LIBRARY_SHARE_MANAGEMENT_COPY, {
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
  });
  const service = readSource("../services/libraryShare.ts");
  for (const marker of ["MY_LIBRARY_SHARE_LIMIT = 100", ".limit(MY_LIBRARY_SHARE_LIMIT)", '.eq("owner_user_id"']) {
    assert.ok(service.includes(marker), marker);
  }
});
