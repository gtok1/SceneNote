import assert from "node:assert/strict";
import { it } from "node:test";

it("I-W1: a zero-row library write is not a successful save", async () => {
  const { assertLibraryWriteApplied } = await import("./libraryWrite");
  assert.throws(() => assertLibraryWriteApplied({ data: [], error: null }, "저장 실패"), { message: "저장 실패" });
});

it("I-W2: a missing returned row is not a successful save", async () => {
  const { assertLibraryWriteApplied } = await import("./libraryWrite");
  assert.throws(() => assertLibraryWriteApplied({ data: null, error: null }, "저장 실패"), { message: "저장 실패" });
});

it("I-W3: a database error takes precedence over affected rows", async () => {
  const { assertLibraryWriteApplied } = await import("./libraryWrite");
  assert.throws(() => assertLibraryWriteApplied({ data: [{ id: "item" }], error: { message: "database failure" } }, "저장 실패"), { message: "database failure" });
});

it("I-W4: an applied library row succeeds without changing the result", async () => {
  const { assertLibraryWriteApplied } = await import("./libraryWrite");
  const result = { data: [{ id: "item" }], error: null };
  assert.doesNotThrow(() => assertLibraryWriteApplied(result, "저장 실패"));
  assert.deepEqual(result, { data: [{ id: "item" }], error: null });
});
