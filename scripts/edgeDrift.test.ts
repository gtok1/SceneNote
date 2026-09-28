import assert from "node:assert/strict";
import { it } from "node:test";

import { collectLocalImports, compareEdgeDeployments, hasDrift } from "./edgeDrift";

const local = (lastChangedAt: number | null, uncommitted = false) => [{ slug: "test", lastChangedAt, uncommitted }];
const remote = (updatedAt: number) => [{ slug: "test", version: 2, status: "ACTIVE", updatedAt }];

it("D-1 reports stale when local code is newer", () => {
  assert.equal(compareEdgeDeployments(local(200), remote(100))[0]?.status, "stale");
});
it("D-2 reports ok when deployment is newer", () => {
  assert.equal(compareEdgeDeployments(local(100), remote(200))[0]?.status, "ok");
});
it("D-3 reports not_deployed without a remote function", () => {
  assert.equal(compareEdgeDeployments(local(100), [])[0]?.status, "not_deployed");
});
it("D-4 prioritizes uncommitted even with a recent deployment", () => {
  assert.equal(compareEdgeDeployments(local(100, true), remote(200))[0]?.status, "uncommitted");
});
it("D-5 reports remote_only for a function absent locally", () => {
  assert.equal(compareEdgeDeployments([], remote(200))[0]?.status, "remote_only");
});
it("D-6 sorts rows by slug", () => {
  const rows = compareEdgeDeployments([{ slug: "z", lastChangedAt: 1, uncommitted: false }, { slug: "a", lastChangedAt: 1, uncommitted: false }], []);
  assert.deepEqual(rows.map(row => row.slug), ["a", "z"]);
});
it("D-7 treats unknown commit time as ok when deployed", () => {
  assert.equal(compareEdgeDeployments(local(null), remote(200))[0]?.status, "ok");
});
it("D-8 ignores remote_only but detects stale", () => {
  const ok = compareEdgeDeployments(local(100), remote(200));
  const remoteOnly = compareEdgeDeployments([], [{ slug: "other", version: 1, status: "ACTIVE", updatedAt: 200 }]);
  assert.equal(hasDrift([...ok, ...remoteOnly]), false);
  assert.equal(hasDrift([...ok, ...compareEdgeDeployments(local(200), remote(100))]), true);
});
it("D-9 traverses relative imports and stops at a cycle", () => {
  const files: Record<string, string> = {
    "app/index.ts": 'import { a } from "../_shared/a.ts";',
    "_shared/a.ts": 'export { b } from "./b.ts";',
    "_shared/b.ts": 'export { a } from "./a.ts";'
  };
  assert.deepEqual(collectLocalImports("app/index.ts", path => files[path] ?? null), ["_shared/a.ts", "_shared/b.ts", "app/index.ts"]);
});
it("D-10 excludes URLs, test files, and missing files", () => {
  const files: Record<string, string> = {
    "app/index.ts": 'import x from "https://esm.sh/x"; import t from "./c.test.ts"; import m from "./missing.ts";'
  };
  assert.deepEqual(collectLocalImports("app/index.ts", path => files[path] ?? null), ["app/index.ts"]);
});
