import { it } from "node:test";
import assert from "node:assert/strict";
import { EPISODE_PROGRESS_COMPLETED_COPY, MANUAL_PROGRESS_COPY, manualProgressSavedToast, isEpisodeProgressCompletedMode, getContentDetailLayout, createContentDetailMetaItems, pinListLabel, createWatchStatusControlModel, contentDetailSections, CONTENT_DETAIL_SIDE_WIDTH, PRIMARY_WATCH_STATUSES, SECONDARY_WATCH_STATUSES } from "./contentDetailView";

const mobile = { gutter: 16, contentWidth: 343, gap: 12, columns: 1, mainWidth: 343, sideWidth: 343, poster: { width: 96, height: 144 } };
it("L-1: layout at 375", () => assert.deepEqual(getContentDetailLayout(375), mobile));
it("L-2: layout at 599", () => assert.deepEqual(getContentDetailLayout(599), { ...mobile, contentWidth: 567, mainWidth: 567, sideWidth: 567 }));
it("L-3: layout at 600", () => assert.deepEqual(getContentDetailLayout(600), { gutter: 24, contentWidth: 552, gap: 16, columns: 1, mainWidth: 552, sideWidth: 552, poster: { width: 160, height: 240 } }));
it("L-4: layout at 960", () => assert.deepEqual(getContentDetailLayout(960), { gutter: 24, contentWidth: 912, gap: 16, columns: 2, mainWidth: 536, sideWidth: 360, poster: { width: 160, height: 240 } }));
it("L-5: capped layout at 1440 and 2000", () => { for (const width of [1440, 2000]) assert.deepEqual(getContentDetailLayout(width), { gutter: 24, contentWidth: 1152, gap: 16, columns: 2, mainWidth: 776, sideWidth: 360, poster: { width: 160, height: 240 } }); });
it("L-6: invalid widths use mobile fallback", () => { for (const width of [NaN, 0, -1]) assert.deepEqual(getContentDetailLayout(width), mobile); });
it("M-1: Korean anime metadata", () => assert.deepEqual(createContentDetailMetaItems({ contentType: "anime", airDateLabel: "2026.07", episodeLabel: "26화" }), ["애니", "2026.07", "26화"]));
it("M-2: omit missing metadata", () => {
  assert.deepEqual(createContentDetailMetaItems({ contentType: "movie", airDateLabel: null, episodeLabel: null }), ["영화"]);
  assert.deepEqual(createContentDetailMetaItems({ contentType: "kdrama", airDateLabel: "", episodeLabel: "16화" }), ["한국 드라마", "16화"]);
  assert.deepEqual(createContentDetailMetaItems({ contentType: "other", airDateLabel: "2020", episodeLabel: null }), ["기타", "2020"]);
});
it("P-1: pin counts", () => assert.deepEqual([undefined, null, 0, 3, 1234].map(pinListLabel), ["핀 목록", "핀 목록", "핀 목록", "핀 목록 3", "핀 목록 1,234"]));
const primary = [{ status: "wishlist", label: "보고 싶음", selected: false }, { status: "watching", label: "보는 중", selected: false }, { status: "dropped", label: "보류", selected: false }, { status: "completed", label: "완료", selected: false }];
it("S-1: registered status model", () => assert.deepEqual(createWatchStatusControlModel(["completed", "recommended"], true), { title: "내 상태", hint: null, primary: primary.map(option => ({ ...option, selected: option.status === "completed" })), secondary: [{ status: "recommended", label: "추천", selected: true }, { status: "not_recommended", label: "비추천", selected: false }] }));
it("S-2: unregistered status model", () => assert.deepEqual(createWatchStatusControlModel([], false), { title: "내 목록에 추가", hint: "상태를 고르면 내 목록에 추가돼요.", primary, secondary: [] }));
const input = { columns: 2 as const, inLibrary: true, isSeries: true, hasCast: true, peopleEnabled: true };
it("C-1: registered series two columns", () => assert.deepEqual(contentDetailSections(input), { main: ["progress", "review", "overview", "cast"], side: ["providers", "watchCount", "danger"] }));
it("C-2: registered series one column", () => assert.deepEqual(contentDetailSections({ ...input, columns: 1 }), { main: ["progress", "watchCount", "providers", "review", "overview", "cast", "danger"], side: [] }));
it("C-3: movie without cast", () => assert.deepEqual(contentDetailSections({ ...input, isSeries: false, hasCast: false }), { main: ["review", "overview"], side: ["providers", "watchCount", "danger"] }));
it("C-4: unregistered sections at both widths", () => {
  assert.deepEqual(contentDetailSections({ ...input, inLibrary: false }), { main: ["overview", "cast"], side: ["providers"] });
  assert.deepEqual(contentDetailSections({ ...input, inLibrary: false, columns: 1 }), { main: ["providers", "overview", "cast"], side: [] });
});
it("C-5: disabled people features", () => assert.deepEqual(contentDetailSections({ ...input, peopleEnabled: false }), { main: ["progress", "review", "overview"], side: ["providers", "watchCount", "danger"] }));
it("K-1: layout and status constants", () => {
  assert.equal(CONTENT_DETAIL_SIDE_WIDTH, 360);
  assert.deepEqual(PRIMARY_WATCH_STATUSES, ["wishlist", "watching", "dropped", "completed"]);
  assert.deepEqual(SECONDARY_WATCH_STATUSES, ["recommended", "not_recommended"]);
});

it("C-1 exposes the exact completed and manual progress copy", () => {
  assert.deepEqual(EPISODE_PROGRESS_COMPLETED_COPY, {
    modeLabel:"완료로 표시됨", summary:"모든 화 시청 완료",
    hint:"완료 상태라 모든 화를 본 것으로 계산해요. 다시 보고 있다면 상태를 '보는 중'으로 바꾸면 진행 위치를 고칠 수 있어요."
  });
  assert.deepEqual(MANUAL_PROGRESS_COPY, {
    undo:"되돌리기", saveFailed:"시청 진행을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    completedNotice:"완료 상태라 모든 화를 본 것으로 표시돼요. 상태를 '보는 중'으로 바꾸면 진행 위치를 정할 수 있어요.",
    resetTitle:"시청 진행 되돌리기", resetMessage:"직접 설정한 진행 위치를 지우고 에피소드 체크 기준으로 되돌릴까요?",
    resetConfirm:"되돌리기", reviewSaveFailed:"감상 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
  });
});
it("C-2 formats saved progress toasts with integer episode numbers", () => {
  assert.equal(manualProgressSavedToast(3),"3화까지 봤음으로 표시했어요.");
  assert.equal(manualProgressSavedToast(0),"0화까지 봤음으로 표시했어요.");
  assert.equal(manualProgressSavedToast(2.7),"2화까지 봤음으로 표시했어요.");
});
it("C-3 enables completed mode only with a positive known total", () => {
  assert.equal(isEpisodeProgressCompletedMode({statuses:["completed"],totalEpisodes:10}),true);
  assert.equal(isEpisodeProgressCompletedMode({statuses:["completed"],totalEpisodes:null}),false);
  assert.equal(isEpisodeProgressCompletedMode({statuses:["completed"],totalEpisodes:0}),false);
  assert.equal(isEpisodeProgressCompletedMode({statuses:["watching"],totalEpisodes:10}),false);
  assert.equal(isEpisodeProgressCompletedMode({statuses:["completed","recommended"],totalEpisodes:1}),true);
});
