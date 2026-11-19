import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

import { findJsxOpeningTags } from "./a11yAriaStateGuard";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const source = readFileSync(join(root, "app/settings/excluded-recommendations.tsx"), "utf8");
const buttons = findJsxOpeningTags(source).filter(({ ownText }) =>
  ownText.startsWith("<Pressable") && ownText.includes("removeExclusion(item.key)")
);

it("80 T-7: each exclusion remove button names the title", () => {
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0]!.ownText.includes('accessibilityLabel={`${item.title} 제외 해제`}'));
});

it("80 T-8: exclusion remove button keeps role and handler", () => {
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0]!.ownText.includes('accessibilityRole="button"'));
  assert.ok(buttons[0]!.ownText.includes("onPress={() => removeExclusion(item.key)}"));
});
