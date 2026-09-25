import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXCLUDED_THEME_KEYS, hasExcludedTheme, type ExcludedThemeInput } from "./recommendationThemes";

describe("excluded relationship themes", () => {
  const cases: { id: string; input: ExcludedThemeInput; expected: boolean; excludedKeys?: string[] }[] = [
    { id: "T-1", input: { themes: [{ family: "relationship", key: "boys-love" }] }, expected: true },
    { id: "T-2", input: { genres: ["Boys' Love"] }, expected: true },
    { id: "T-3", input: { genres: ["Girls' Love"] }, expected: true },
    { id: "T-4", input: { keywords: ["lgbt"] }, expected: true },
    { id: "T-5", input: { keywords: ["gay"] }, expected: true },
    { id: "T-6", input: { keywords: ["lesbian"] }, expected: true },
    { id: "T-7", input: { source_tags: [{ name: "Yuri", source: "anilist", rank: 80 }] }, expected: true },
    { id: "T-8", input: { source_tags: [{ name: "Shounen Ai", source: "anilist", rank: 12 }] }, expected: true },
    { id: "T-9", input: { keywords: ["동성애"] }, expected: true },
    { id: "T-10", input: { keywords: ["퀴어"] }, expected: true },
    { id: "T-11", input: { keywords: ["gaya"] }, expected: false },
    { id: "T-12", input: { keywords: ["transformation"] }, expected: false },
    { id: "T-13", input: { keywords: ["bromance"] }, expected: false },
    { id: "T-14", input: {}, expected: false },
    { id: "T-15", input: { genres: ["Romance", "Drama"] }, expected: false },
    { id: "T-16", input: { themes: [{ family: "relationship", key: "workplace-romance" }] }, expected: false },
    { id: "T-17", input: { themes: [{ family: "narrative", key: "boys-love" }] }, expected: false },
    { id: "T-18", input: { keywords: ["lgbt"] }, excludedKeys: [], expected: false },
    { id: "T-19", input: { keywords: ["lgbt"] }, excludedKeys: ["girls-love"], expected: false }
  ];

  for (const { id, input, excludedKeys, expected } of cases) {
    it(id, () => assert.equal(hasExcludedTheme(input, excludedKeys ?? EXCLUDED_THEME_KEYS), expected));
  }
});
