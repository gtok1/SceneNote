import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

import { findJsxOpeningTags } from "./a11yAriaStateGuard";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const source = readFileSync(`${root}src/components/content/CastSection.tsx`, "utf8");
const cards = findJsxOpeningTags(source).filter(({ ownText }) =>
  ownText.startsWith("<Pressable") && ownText.includes("인물 상세 보기")
);

it("77 T-1: cast section has exactly one person-detail card opening tag", () => {
  assert.equal(cards.length, 1);
});

it("77 T-2: cast card exposes no selection or toggle state on any platform", () => {
  assert.equal(cards.length, 1);
  for (const state of ["selectionAriaProps", "aria-selected", "aria-pressed", "aria-checked", "accessibilityState"]) {
    assert.equal(cards[0]!.ownText.includes(state), false, `Cast card must not include ${state}`);
  }
  assert.equal(source.includes("selectionAriaProps"), false, "Cast section must not import or call selectionAriaProps");
});

it("77 T-3: cast card keeps its button role, registered label and open handler", () => {
  assert.equal(cards.length, 1);
  assert.ok(cards[0]!.ownText.includes('accessibilityRole="button"'));
  assert.ok(cards[0]!.ownText.includes(", 등록됨"));
  assert.ok(cards[0]!.ownText.includes("onPress={() => onOpen(member)}"));
});
