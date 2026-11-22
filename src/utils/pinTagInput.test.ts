import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const composerPath = "src/components/pins/PinComposer.tsx";

it("94 T-1: tag input splits commas and strips hashes", async () => {
  const { splitTagInput } = await import("./pinTagInput");
  assert.deepEqual(splitTagInput("#액션"), ["액션"]);
  assert.deepEqual(splitTagInput("액션, 감동，여운"), ["액션", "감동", "여운"]);
  assert.deepEqual(splitTagInput("  ##감정선 "), ["감정선"]);
  assert.deepEqual(splitTagInput("a,\nb"), ["a", "b"]);
  assert.deepEqual(splitTagInput(",,#, "), []);
  assert.deepEqual(splitTagInput("액션,액션"), ["액션"]);
  assert.deepEqual(splitTagInput("Action,action"), ["Action", "action"]);
});

it("94 T-2: adding tags follows the existing limits and copy", async () => {
  const { addTagsFromInput, PIN_TAG_COPY, PIN_TAG_LIMITS } = await import("./pinTagInput");
  assert.deepEqual(PIN_TAG_COPY, {
    empty: "태그를 입력해 주세요.", tooLong: "태그는 20자까지 입력할 수 있어요.",
    duplicate: "이미 추가한 태그입니다.", tooMany: "태그는 10개까지 추가할 수 있어요.",
    placeholder: "태그 입력 (쉼표로 여러 개)", suggestionsLabel: "내 태그"
  });
  assert.deepEqual(PIN_TAG_LIMITS, { maxLength: 20, maxCount: 10, maxSuggestions: 8 });
  assert.deepEqual(addTagsFromInput([], "액션"), { tags: ["액션"], error: null });
  assert.deepEqual(addTagsFromInput(["액션"], "액션, 감동"), { tags: ["액션", "감동"], error: null });
  assert.deepEqual(addTagsFromInput(["액션"], "액션"), { tags: ["액션"], error: PIN_TAG_COPY.duplicate });
  assert.deepEqual(addTagsFromInput([], ",,"), { tags: [], error: PIN_TAG_COPY.empty });
  const nine = Object.freeze(Array.from({ length: 9 }, (_, i) => String(i)));
  assert.deepEqual(addTagsFromInput(nine, "a, b"), { tags: nine, error: PIN_TAG_COPY.tooMany });
  assert.deepEqual(addTagsFromInput(nine, "가".repeat(20)), { tags: [...nine, "가".repeat(20)], error: null });
  for (const raw of ["가".repeat(21), "a, " + "가".repeat(21)]) {
    assert.deepEqual(addTagsFromInput([], raw), { tags: [], error: PIN_TAG_COPY.tooLong });
  }
  assert.deepEqual(addTagsFromInput(["#기존", "옛,태그"], "#새"), { tags: ["#기존", "옛,태그", "새"], error: null });
});

it("94 T-3: suggestions prefer recent tags, then matches", async () => {
  const { suggestPinTags } = await import("./pinTagInput");
  const names = ["감정선", "직감", "감동", "공감", "음악", "대사", "결말", "배경", "표정", "액션"];
  const all = Object.freeze(names.map((name, i) => ({ name, created_at: new Date(2026, 0, i + 1).toISOString() })));
  assert.deepEqual(suggestPinTags(all, ["표정"], ""), ["액션", "배경", "결말", "대사", "음악", "공감", "감동", "직감"]);
  for (const input of ["감", "#감", "액션, 감"]) {
    assert.deepEqual(suggestPinTags(all, [], input), ["감동", "감정선", "공감", "직감"]);
  }
  assert.deepEqual(suggestPinTags(all, names, "감"), []);
  assert.deepEqual(suggestPinTags([], [], ""), []);
  const ties = ["Scene", "Action"].map((name) => ({ name, created_at: all[0]!.created_at }));
  assert.deepEqual(suggestPinTags(ties, [], ""), ["Action", "Scene"]);
  assert.deepEqual(suggestPinTags(ties, [], "ACT"), ["Action"]);
  const instants = [
    { name: "감동", created_at: "2026-01-01T09:00:00.000001+09:00" },
    { name: "여운", created_at: "2026-01-01T00:00:00.000002Z" }
  ];
  assert.deepEqual(suggestPinTags(instants, [], ""), ["여운", "감동"]);
});

it("94 T-4: picking a suggestion clears only the last fragment", async () => {
  const { lastTagFragment, removeLastTagFragment } = await import("./pinTagInput");
  assert.equal(lastTagFragment("액션, #감"), "감");
  assert.equal(removeLastTagFragment("액션, 감"), "액션, ");
  assert.equal(removeLastTagFragment("감"), "");
  assert.equal(removeLastTagFragment("a\nb"), "a\n");
  assert.equal(removeLastTagFragment("a，  #b"), "a，  ");
});

it("94 T-5: the tag field keeps the keyboard and uses the shared parser", () => {
  const composer = readFileSync(composerPath, "utf8");
  for (const marker of ["addTagsFromInput(", "suggestPinTags(", "useTags("]) {
    assert.ok(composer.includes(marker), `missing ${marker}`);
  }
  const inputs = composer.match(/<TextInput\b[\s\S]*?\/>/g) ?? [];
  const tag = inputs.find((input) => input.includes('accessibilityLabel="새 태그"'));
  const memo = inputs.find((input) => input.includes('accessibilityLabel="메모"'));
  assert.ok(tag && memo);
  for (const marker of ['submitBehavior="submit"', "blurOnSubmit={false}", 'autoCapitalize="none"',
    "autoCorrect={false}", 'returnKeyType="done"', "PIN_TAG_COPY.placeholder", "editable={!isSaving}"]) {
    assert.ok(tag.includes(marker), marker);
  }
  for (const input of [memo, tag]) assert.ok(input.includes("placeholderTextColor={colors.textSubtle}"));
  assert.ok(!composer.includes("태그 입력 후 Enter"));
  assert.ok(!composer.includes('.replace(/,$/, "")'));
  assert.match(composer, /<Text\b[^>]*accessibilityLiveRegion="polite"[^>]*>\{error\}<\/Text>/);
  const suggestion = (composer.match(/<TagChip\b[\s\S]*?\/>/g) ?? []).find((chip) => chip.includes("onPress="));
  assert.ok(suggestion?.includes("disabled={isSaving}"));
  const group = composer.match(/<View\b[^>]*accessibilityLabel="내 태그 후보"[^>]*>/)?.[0];
  assert.ok(group?.includes('role="group"') && group.includes("aria-disabled={isSaving}"));
});

it("94 T-6: save merges a pending tag before validation", () => {
  const composer = readFileSync(composerPath, "utf8");
  const save = composer.slice(composer.indexOf("const save = async"), composer.indexOf("const remove ="));
  const offline = save.indexOf("isNetworkOffline(");
  const merge = save.indexOf("addTagsFromInput(draft.tags, tagInput)");
  const time = save.indexOf("resolveTimecodeInput(");
  assert.ok(offline >= 0 && offline < merge && merge < time, "expected tag merge between offline and time checks");
  const validation = save.match(/createPinSchema\.safeParse\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  assert.match(validation, /tagNames:\s*(?!draft\b)\w+\s*,|\btagNames\s*,/);
  assert.ok(save.includes("tagNames: result.data.tagNames"));
});
