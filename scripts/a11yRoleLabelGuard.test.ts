import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

import { findJsxOpeningTags } from "./a11yAriaStateGuard";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const files = ["app", "src"].flatMap((directory) =>
  readdirSync(join(root, directory), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => `${directory}/${file}`)
).sort();
const tags = files.flatMap((file) =>
  findJsxOpeningTags(readFileSync(join(root, file), "utf8"))
    .map((tag) => ({ ...tag, file }))
);

function roleLabelViolations(ownText: string): ("role" | "label")[] {
  const violations: ("role" | "label")[] = [];
  if (/^<(Pressable|TouchableOpacity|TouchableHighlight)\b/.test(ownText)
    && !/accessibilityRole=|\brole=|accessible=\{false\}/.test(ownText)) {
    violations.push("role");
  }
  if (/^<TextInput\s/.test(ownText)
    && !/accessibilityLabel=|aria-label=|aria-labelledby=|\{\.\.\./.test(ownText)) {
    violations.push("label");
  }
  return violations;
}

it("84 T-1: every pressable has a role or is hidden from accessibility", () => {
  const violations = tags.filter(({ ownText }) => roleLabelViolations(ownText).includes("role"))
    .map(({ file, line }) => `${file}:${line}`);
  assert.deepEqual(violations, []);
});

it("84 T-2: episode progress quick buttons keep their handlers", () => {
  for (const handler of ["onPress={() => changeDraft(0)}", "onPress={() => changeDraft(upperBound)}", "onPress={reset}"]) {
    const buttons = tags.filter(({ file, ownText }) =>
      file === "src/components/content/EpisodeProgressCard.tsx"
      && /^<Pressable\b/.test(ownText) && ownText.includes(handler)
    );
    assert.equal(buttons.length, 1, handler);
    assert.ok(buttons[0]!.ownText.includes('accessibilityRole="button"'), handler);
  }
});

it("84 T-3: personalized recommendation actions keep their labels", () => {
  for (const [label, count] of [
    ['accessibilityLabel={`${result.title_primary} 관심 없음`}', 1],
    ['accessibilityLabel={`${result.title_primary} 비슷한 작품 더 보기`}', 1],
    ['accessibilityLabel={`${result.title_primary} 빠른 보기`}', 2]
  ] as const) {
    const buttons = tags.filter(({ file, ownText }) =>
      file === "src/components/content/PersonalizedRecommendationListItem.tsx"
      && /^<Pressable\b/.test(ownText) && ownText.includes(label)
    );
    assert.equal(buttons.length, count, label);
    for (const button of buttons) {
      assert.ok(button.ownText.includes('accessibilityRole="button"'), label);
    }
  }
});

it("84 T-4: every text input has an accessible name", () => {
  const violations = tags.filter(({ ownText }) => roleLabelViolations(ownText).includes("label"))
    .map(({ file, line }) => `${file}:${line}`);
  assert.deepEqual(violations, []);
});

it("84 T-5: review inputs are named after their visible headings", () => {
  const source = readFileSync(join(root, "src/components/content/ContentReviewEditor.tsx"), "utf8");
  for (const [setter, label] of [["setOneLineReview", "한줄 후기"], ["setBody", "소감"]]) {
    const inputs = findJsxOpeningTags(source).filter(({ ownText }) =>
      /^<TextInput\s/.test(ownText) && ownText.includes(`onChangeText={${setter}}`)
    );
    assert.equal(inputs.length, 1, setter);
    assert.ok(source.includes(`<Text style={styles.label}>${label}</Text>`));
    assert.ok(inputs[0]!.ownText.includes(`accessibilityLabel="${label}"`), label);
  }
});

it("84 T-6: guard ignores type arguments and spread inputs", () => {
  assert.deepEqual(roleLabelViolations("<TextInput>"), []);
  assert.deepEqual(roleLabelViolations("<TextInput {...inputProps} ref={inputRef}>"), []);
  assert.deepEqual(roleLabelViolations('<TextInput placeholder="x">'), ["label"]);
  assert.deepEqual(roleLabelViolations("<Pressable accessible={false} onPress={f}>"), []);
  assert.deepEqual(roleLabelViolations("<Pressable onPress={f}>"), ["role"]);
});
