import assert from "node:assert/strict";
import test from "node:test";

import { parseSearchIntent } from "./similarSearchIntent";

test("plain title stays in keyword mode", () => {
  assert.deepEqual(parseSearchIntent("길티 크라운"), { mode: "keyword", normalizedQuery: "길티 크라운" });
});

test("parses mood-oriented anime similarity query", () => {
  const intent = parseSearchIntent("길티크라운 같은 결의 애니");
  assert.equal(intent.mode, "similarity");
  if (intent.mode !== "similarity") return;
  assert.equal(intent.anchorText, "길티크라운");
  assert.equal(intent.targetMediaType, "anime");
  assert.equal(intent.focus, "mood");
  assert.equal(intent.sort, "similarity");
});

test("parses story, latest sort and supported negative modifier", () => {
  const intent = parseSearchIntent("길티 크라운과 스토리가 비슷한 최신 애니, 로맨스는 적은");
  assert.equal(intent.mode, "similarity");
  if (intent.mode !== "similarity") return;
  assert.equal(intent.anchorText, "길티 크라운");
  assert.equal(intent.focus, "story");
  assert.equal(intent.sort, "latest");
  assert.deepEqual(intent.modifiers, [{ key: "romance", label: "로맨스 적음", direction: "exclude" }]);
});

test("handles spacing and feeling syntax", () => {
  const intent = parseSearchIntent("  태양의후예   느낌의   드라마 ");
  assert.equal(intent.mode, "similarity");
  if (intent.mode !== "similarity") return;
  assert.equal(intent.anchorText, "태양의후예");
  assert.equal(intent.targetMediaType, "drama");
  assert.equal(intent.focus, "mood");
});
