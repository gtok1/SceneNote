import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolveTimecodeInput } from "./timecode";
import { createPinSchema } from "./validation";

import { isPinDraftDirty } from "./pinDraft";
import type { PinFormDraft } from "../atoms/pinFormAtom";
import { resolvePinContext } from "./pinContext";
import { createSearchFilterDraft, emptySearchFilters } from "./searchFilterDraft";
import { shouldShowPinDetailPanel } from "./pinResponsive";
for (const raw of ["12:3x", "::", "12:60", "1:60:00", "abc", "12x3"]) {
  test(`MU-08/09 preserves invalid input through change → blur → save: ${raw}`, () => {
    let text = raw;
    for (const phase of ["change", "blur", "save"] as const) {
      const result = resolveTimecodeInput(text, phase);
      assert.equal(result.kind, "invalid_nonempty");
      assert.equal(result.text, raw);
      text = result.text;
    }
  });
}
for (const [raw, seconds] of [["14:32",872],["1432",872],["90",90],["1:02:30",3750],["0",0]] as const) {
  test(`MU-10 preserves typing and normalizes valid input: ${raw}`, () => {
    assert.equal(resolveTimecodeInput(raw, "change").text, raw);
    const blur = resolveTimecodeInput(raw, "blur");
    assert.equal(blur.seconds, seconds);
    assert.equal(resolveTimecodeInput(blur.text, "save").seconds, seconds);
    assert.equal(resolveTimecodeInput(raw, "save").seconds, seconds);
  });
}
test("MU-11/12 empty memo and duration boundaries", () => {
  const payload = { memo: "메모", tagNames: [], emotion: "none", is_spoiler: false, timestamp_seconds: null as number | null, episodeDurationSeconds: 3600 };
  assert.equal(createPinSchema.safeParse(payload).success, true);
  assert.equal(createPinSchema.safeParse({...payload, memo: null}).success, false);
  assert.equal(createPinSchema.safeParse({...payload, timestamp_seconds: 3600}).success, true);
  assert.equal(createPinSchema.safeParse({...payload, timestamp_seconds: 3601}).success, false);
});
const initial: PinFormDraft = { timecodeDisplay: "", timestamp_seconds: null, memo: "", tags: [], emotion: "none", is_spoiler: false };
test("MU-17 dirty covers every field and pending tag but ignores display-only normalization", () => {
  assert.equal(isPinDraftDirty(initial, initial, ""), false);
  for (const patch of [{ timecodeDisplay: "0" }, { memo: "메모" }, { tags: ["장면"] }, { emotion: "moved" as const }, { is_spoiler: true }]) assert.equal(isPinDraftDirty({...initial,...patch},initial,""),true);
  assert.equal(isPinDraftDirty(initial, initial, "추가 전 태그"), true);
  assert.equal(isPinDraftDirty({...initial, timecodeDisplay:"90"}, {...initial,timecodeDisplay:"01:30"}, ""),false);
});
test("MU-13/15 context distinguishes missing runtime from invalid episode ownership", () => {
  const content = { id: "a", title_primary: "긴 한국어 작품 제목", content_type: "drama" };
  const episode = { id: "e", content_id: "a", episode_number: 3, duration_seconds: 3600, seasons: {season_number: 2} };
  assert.deepEqual(resolvePinContext(content,"e",episode), {title: content.title_primary,label:"시즌 2 · 3화",duration:3600});
  for (const duration_seconds of [null,0,-1]) assert.equal(resolvePinContext(content,"e",{...episode,duration_seconds}).duration,null);
  assert.throws(() => resolvePinContext(content,null,null));
  assert.throws(() => resolvePinContext(content,"e",null));
  assert.throws(() => resolvePinContext(content,"e",{...episode,content_id:"b"}));
  assert.throws(() => resolvePinContext(content,"other",episode));
  assert.equal(resolvePinContext({...content,content_type:"movie"},null,null).label,"영화");
  assert.throws(() => resolvePinContext({...content,content_type:"movie"},"e",episode));
});
test("MU-22 draft change/reset does not mutate committed filters; apply copies all fields together", () => {
  const applied = {...emptySearchFilters, countryFilter:"JP",year:"2026"};
  let draft = createSearchFilterDraft(applied);
  draft.mediaType = "anime";
  assert.equal(applied.mediaType,"all");
  assert.deepEqual(createSearchFilterDraft(applied),applied); // cancel and reopen
  draft = createSearchFilterDraft(emptySearchFilters);
  assert.equal(applied.countryFilter,"JP"); // reset is draft-only
  assert.deepEqual(createSearchFilterDraft(draft),emptySearchFilters);
});
test("MU-26 breakpoint and narrow content fallback", () => {
  for (const width of [767,768,1199,1200]) assert.equal(shouldShowPinDetailPanel(width),width>=768);
  assert.equal(shouldShowPinDetailPanel(768,600),false);
  assert.equal(shouldShowPinDetailPanel(1200,600),false);
});
