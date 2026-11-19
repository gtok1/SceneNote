import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

import { findAriaStateViolations, findJsxOpeningTags } from "./a11yAriaStateGuard";

const root = fileURLToPath(new URL("../", import.meta.url).href);

it("75 T-1: finds an opening tag and its first line", () => {
  const source = '<Pressable accessibilityRole="button" onPress={go}>';
  assert.deepEqual(findJsxOpeningTags(source), [{ text: source, ownText: source, line: 1 }]);
});

it("75 T-2: arrow functions and comparisons inside braces do not end a tag", () => {
  const source = '<Pressable style={({ pressed }) => [a, pressed && b]} onPress={() => x > 1}>';
  assert.deepEqual(findJsxOpeningTags(source), [{ text: source, ownText: source, line: 1 }]);
});

it("75 T-3: quoted and template text may contain greater-than characters", () => {
  const source = '<Text label="a > b" title={`c > d`} />';
  assert.deepEqual(findJsxOpeningTags(source), [{ text: source, ownText: source, line: 1 }]);
});

it("75 T-4: skips comparisons and closing tags while keeping multiline start lines", () => {
  const source = 'if (a < b) return;\n</View>\n<View\n  accessibilityRole="tab"\n/>';
  assert.deepEqual(findJsxOpeningTags(source), [{
    text: '<View\n  accessibilityRole="tab"\n/>',
    ownText: '<View\n  accessibilityRole="tab"\n/>',
    line: 3
  }]);
});

it("75 T-5: reports the source line of multiline accessibilityState", () => {
  const source = '<View\n  accessibilityState={{\n    busy: true\n  }}\n/>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 2, rule: "R-1", snippet: "accessibilityState={{" }
  ]);
});

it("75 T-6: finds object keys and comments outside JSX once per source line", () => {
  const source = "const p = { accessibilityState: { selected } };";
  assert.deepEqual(findAriaStateViolations("src/x.ts", source), [
    { file: "src/x.ts", line: 1, rule: "R-1", snippet: source }
  ]);
  const comment = "// accessibilityState accessibilityState";
  assert.deepEqual(findAriaStateViolations("src/x.ts", comment), [
    { file: "src/x.ts", line: 1, rule: "R-1", snippet: comment }
  ]);
});

it("75 T-7: selected buttons need a pressed or current attribute", () => {
  const source = '<Pressable accessibilityRole="button" aria-selected={s}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-8: a selected button with pressed state has no violation (docs/76: R-2 replaced)", () => {
  const source = '<Pressable accessibilityRole="button" aria-selected={s} aria-pressed={s}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-9: conditional spread state names satisfy the button guard (docs/76: R-2 replaced)", () => {
  const source = '<Pressable accessibilityRole="button" {...(c ? { "aria-selected": s, "aria-pressed": s } : {})}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-10: aria-current exempts the selected button from pressed state (docs/76: R-2 replaced)", () => {
  const source = '<Pressable accessibilityRole="button" aria-selected={a} aria-current={a ? "page" : undefined}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-11: selected radios require matching checked state", () => {
  const source = '<Pressable accessibilityRole="radio" aria-selected={s}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
  const checked = '<Pressable accessibilityRole="radio" aria-selected={s} aria-checked={s}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", checked), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: checked }
  ]);
});

it("75 T-12: selected tabs already have the intended web state", () => {
  assert.deepEqual(findAriaStateViolations("app/x.tsx", '<Pressable accessibilityRole="tab" aria-selected={s}>'), []);
});

it("75 T-13: recognizes single-quoted role attributes", () => {
  const source = "<Pressable role='button' aria-selected={s}>";
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-14: dynamic roles are not guessed by the static guard", () => {
  const source = '<Pressable accessibilityRole={role} aria-selected={s}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
  ]);
});

it("75 T-15: diagnostics retain the file and trim snippets to at most 120 characters", () => {
  const source = `\n   <Pressable accessibilityRole="button" aria-selected={s} label="${"x".repeat(180)}">   `;
  const violations = findAriaStateViolations("app/x.tsx", source);
  assert.deepEqual(violations, [{
    file: "app/x.tsx", line: 2, rule: "R-2", snippet: source.split("\n")[1]!.trim().slice(0, 120)
  }]);
  assert.equal(violations[0]!.snippet.length, 120);
});

it("75 T-16: app and src have no obsolete or incomplete ARIA state props", () => {
  const violations = ["app", "src"].flatMap(directory => {
    const absolute = join(root, directory);
    return readdirSync(absolute, { recursive: true, encoding: "utf8" })
      .filter(path => /\.tsx?$/.test(path) && !path.endsWith(".test.ts"))
      .sort()
      .flatMap(path => findAriaStateViolations(
        `${directory}/${path.replaceAll("\\", "/")}`,
        readFileSync(join(absolute, path), "utf8")
      ));
  });
  const details = violations.map(({ file, line, rule, snippet }) => `${file}:${line} ${rule} ${snippet}`).join("\n");
  assert.equal(violations.length, 0, `ARIA state violations: ${violations.length}\n${details}`);
});

it("76 T-9: nested opening tags retain source order and do not leak into parent ownText", () => {
  const source = '<FlashList ListHeaderComponent={<View>\n<Pressable accessibilityRole="button" aria-selected={s}>\n</View>} data={d}>';
  const tags = findJsxOpeningTags(source);
  assert.equal(tags.length, 3);
  assert.deepEqual(tags.map(({ text, line }) => ({ text, line })), [
    { text: source, line: 1 },
    { text: "<View>", line: 1 },
    { text: '<Pressable accessibilityRole="button" aria-selected={s}>', line: 2 }
  ]);
  assert.equal(tags[0]!.ownText.includes("Pressable"), false);
  assert.equal(tags[0]!.ownText.includes("aria-selected"), false);
  assert.equal(tags[1]!.ownText, "<View>");
  assert.equal(tags[2]!.ownText, tags[2]!.text);
});

it("76 T-10: nested tags with arrow functions and object braces keep their exact endpoints", () => {
  const pressable = '<Pressable accessibilityRole="button" aria-selected={s} style={({ pressed }) => [a, pressed && b]}>';
  const source = `<FlashList ListHeaderComponent={<View>\n${pressable}\n</View>} data={d}>`;
  const tags = findJsxOpeningTags(source);
  assert.equal(tags.length, 3);
  assert.deepEqual(tags.map(({ text, line }) => ({ text, line })), [
    { text: source, line: 1 },
    { text: "<View>", line: 1 },
    { text: pressable, line: 2 }
  ]);
  assert.equal(tags[0]!.ownText.includes("Pressable"), false);
  assert.equal(tags[0]!.ownText.includes("aria-selected"), false);
  assert.equal(tags[0]!.ownText.endsWith(" data={d}>"), true);
  assert.equal(tags[2]!.ownText, pressable);
});

it("76 T-11: a nested selected button reports R-2 on its own source line", () => {
  const source = '<FlashList ListHeaderComponent={<View>\n<Pressable accessibilityRole="button" aria-selected={s}>\n</View>} data={d}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
    {
      file: "app/x.tsx",
      line: 2,
      rule: "R-2",
      snippet: '<Pressable accessibilityRole="button" aria-selected={s}>'
    }
  ]);
});

it("76 T-12: a literal tab role may keep direct selected state", () => {
  assert.deepEqual(findAriaStateViolations("app/x.tsx", '<Pressable accessibilityRole="tab" aria-selected={s}>'), []);
});

it("76 T-13: selected state is rejected for buttons, roleless views and dynamic roles", () => {
  const sources = [
    '<Pressable accessibilityRole="button" aria-selected={s} aria-pressed={s}>',
    '<View aria-selected={true}>',
    '<C accessibilityRole={r} aria-selected={s}>'
  ];
  for (const source of sources) {
    assert.deepEqual(findAriaStateViolations("app/x.tsx", source), [
      { file: "app/x.tsx", line: 1, rule: "R-2", snippet: source }
    ]);
  }
});

it("76 T-14: selection helper spreads and existing disabled state have no violation", () => {
  const source = '<Pressable accessibilityRole="button" {...selectionAriaProps("button", s, Platform.OS)} aria-disabled={d}>';
  assert.deepEqual(findAriaStateViolations("app/x.tsx", source), []);
});
