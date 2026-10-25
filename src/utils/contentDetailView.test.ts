import * as choiceContract from "./contentDetailView";
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

it("episode choices use only explicit published rows, including gaps", async () => {
  const { episodeChoiceNumbers } = await import("./contentDetailView");
  assert.deepEqual(episodeChoiceNumbers([{ episode_number: 3 }, { episode_number: 1 }, { episode_number: 3 }]), [1, 3]);
  assert.deepEqual(episodeChoiceNumbers([]), []);
  assert.deepEqual(episodeChoiceNumbers([{ episode_number: 0 }, { episode_number: -1 }, { episode_number: Number.NaN }]), []);
});
it("episode choices use the actual single season of a standalone AniList sequel", async () => {
  const { episodeChoiceSeasonNumber } = await import("./contentDetailView");
  assert.equal(episodeChoiceSeasonNumber(null, 3, [{ season_number: 1 }]), 1);
  assert.equal(episodeChoiceSeasonNumber(2, 3, [{ season_number: 1 }, { season_number: 2 }]), 2);
  assert.equal(episodeChoiceSeasonNumber(null, 3, [{ season_number: 1 }, { season_number: 3 }]), 3);
});

it("EC-1 shows every numbered choice when API total is 26 or one", () => {
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: 26, releasedEpisodes: [] }), { kind: "count", numbers: Array.from({ length: 26 }, (_, i) => i + 1) });
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: 1, releasedEpisodes: [] }), { kind: "count", numbers: [1] });
});
it("EC-2 prefers selected season count over total and released rows", () => {
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: 12, totalEpisodes: 24, releasedEpisodes: [{ episode_number: 1 }] }), { kind: "count", numbers: Array.from({ length: 12 }, (_, i) => i + 1) });
});
it("EC-3 uses sorted distinct released numbers without filling gaps", () => {
  for (const releasedEpisodes of [[3, 1, 3], [1, 3]]) assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: null, releasedEpisodes: releasedEpisodes.map(episode_number => ({ episode_number })) }), { kind: "released", numbers: [1, 3] });
});
it("EC-4 uses manual input when neither count nor list exists", () => {
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: null, releasedEpisodes: [] }), { kind: "manual" });
});
it("EC-5 falls back to released rows or manual above the 200 choice limit", () => {
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: 1100, releasedEpisodes: [{ episode_number: 1 }, { episode_number: 2 }] }), { kind: "released", numbers: [1, 2] });
  assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: 1100, releasedEpisodes: [] }), { kind: "manual" });
});
it("EC-6 rejects zero, negative and fractional episode counts", () => {
  for (const totalEpisodes of [0, -3, 2.5]) assert.deepEqual(choiceContract.resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes, releasedEpisodes: [] }), { kind: "manual" });
});
it("EI-1 hides list status in count mode even while fetching or failed", () => {
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "count", numbers: [1] }, totalEpisodes: 26, isFetching: true, isError: true }), null);
});
it("EI-2 describes released rows and unknown total separately", () => {
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "released", numbers: [1, 2, 3] }, totalEpisodes: null, isFetching: false, isError: false }), "API 공개 회차 3개 · 최근 3화 · 총 화수 미정");
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "released", numbers: [1, 2] }, totalEpisodes: 1100, isFetching: false, isError: false }), "API 공개 회차 2개 · 최근 2화");
});
it("EI-3 explains manual input when no API count is available", () => {
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "manual" }, totalEpisodes: null, isFetching: false, isError: false }), choiceContract.EPISODE_CHOICE_MANUAL_COPY);
  assert.equal(choiceContract.EPISODE_CHOICE_MANUAL_COPY, "API에서 이 작품의 화수를 알려 주지 않아요. 본 회차를 직접 입력해 주세요.");
});
it("EI-4 shows error before loading in manual mode", () => {
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "manual" }, totalEpisodes: null, isFetching: false, isError: true }), "공개 회차를 불러오지 못했어요.");
  assert.equal(choiceContract.episodeChoiceInfoText({ mode: { kind: "manual" }, totalEpisodes: null, isFetching: true, isError: false }), "공개된 회차를 확인하고 있어요.");
});
