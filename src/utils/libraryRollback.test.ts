import assert from "node:assert/strict";
import { it } from "node:test";

const row = (id: string, progress: number, status = "watching") => ({ library_item_id: id, progress, status });

it("I-L1 rolls back only the failed item and keeps another item's successful status", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const before = [row("A", 2), row("B", 2)];
  const optimistic = [row("A", 7), before[1]!];
  const current = [optimistic[0]!, row("B", 2, "completed")];
  const result = rollbackLibraryItem(current, before, optimistic, "A");
  assert.deepEqual(result.items, [before[0]!, current[1]!]);
  assert.equal(result.items?.[1], current[1]!);
  assert.equal(result.conflicted, false);
  assert.equal(current[0]!.progress, 7);
});

it("I-L2 preserves a later change to another field on the same item", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const before = [{ ...row("A", 2), rating: 5 }];
  const optimistic = [{ ...before[0]!, progress: 7 }];
  const current = [{ ...optimistic[0]!, rating: 9 }];
  assert.deepEqual(rollbackLibraryItem(current, before, optimistic, "A").items, [{ ...before[0]!, rating: 9 }]);
});

it("I-L3 never recreates an item deleted after an optimistic update", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const result = rollbackLibraryItem([], [row("A", 2)], [row("A", 7)], "A");
  assert.deepEqual(result.items, []);
  assert.equal(result.conflicted, true);
});

it("I-L4 restores a failed deletion without reverting other rows", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const before = [row("A", 2), row("B", 2)];
  const current = [row("B", 2, "completed")];
  assert.deepEqual(rollbackLibraryItem(current, before, [before[1]!], "A").items, [before[0]!, current[0]!]);
});

it("I-L5 keeps an item that was recreated after the failed deletion", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const current = [row("A", 8, "completed")];
  const result = rollbackLibraryItem(current, [row("A", 2)], [], "A");
  assert.equal(result.items, current);
  assert.equal(result.conflicted, true);
});

it("I-L6 does not recreate cleared account caches", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  assert.equal(rollbackLibraryItem(undefined, [row("A", 2)], [row("A", 7)], "A").items, undefined);
});

it("I-L7 does not overwrite a field changed after the optimistic update", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const current = [row("A", 9)];
  const result = rollbackLibraryItem(current, [row("A", 2)], [row("A", 7)], "A");
  assert.equal(result.items, current);
  assert.equal(result.conflicted, true);
});

it("I-L8 removes fields introduced only by the failed update", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const before: { library_item_id: string; added?: string }[] = [{ library_item_id: "A" }];
  const optimistic = [{ library_item_id: "A", added: "pending" }];
  const result = rollbackLibraryItem(optimistic, before, optimistic, "A");
  assert.deepEqual(result.items, before);
  assert.equal(Object.hasOwn(result.items![0]!, "added"), false);
});

it("I-L9 leaves queries without the target item unchanged", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const current = [row("B", 3)];
  assert.equal(rollbackLibraryItem(current, current, current, "A").items, current);
});

it("I-L10 restores a failed deletion at its previous position", async () => {
  const { rollbackLibraryItem } = await import("./libraryRollback");
  const before = [row("B", 2), row("A", 2), row("C", 2)];
  assert.deepEqual(rollbackLibraryItem([before[0]!, before[2]!], before, [before[0]!, before[2]!], "A").items, before);
});

it("I-J1 a newer operation on the same item prevents an older rollback", async () => {
  const { createLibraryMutationJournal } = await import("./libraryRollback");
  const journal = createLibraryMutationJournal();
  const first = journal.begin("user", "A");
  const second = journal.begin("user", "A");
  assert.equal(journal.canRollback(first), false);
  assert.equal(journal.canRollback(second), true);
});

it("I-J2 independent items and accounts have independent rollback ownership", async () => {
  const { createLibraryMutationJournal } = await import("./libraryRollback");
  const journal = createLibraryMutationJournal();
  const operations = [journal.begin("one", "A"), journal.begin("one", "B"), journal.begin("two", "A")];
  assert.deepEqual(operations.map(operation => journal.canRollback(operation)), [true, true, true]);
});

it("I-J3 reconciliation waits until all pending writes for that account settle", async () => {
  const { createLibraryMutationJournal } = await import("./libraryRollback");
  const journal = createLibraryMutationJournal();
  const first = journal.begin("user", "A");
  const second = journal.begin("user", "B");
  journal.failed(first);
  assert.equal(journal.settle(first), false);
  assert.equal(journal.settle(second), true);
  assert.equal(journal.settle(second), false);
});

it("I-J4 an earlier failed operation reconciles after a later successful deletion", async () => {
  const { createLibraryMutationJournal } = await import("./libraryRollback");
  const journal = createLibraryMutationJournal();
  const first = journal.begin("user", "A");
  const deletion = journal.begin("user", "A");
  assert.equal(journal.settle(deletion), false);
  assert.equal(journal.canRollback(first), false);
  journal.failed(first);
  assert.equal(journal.settle(first), true);
});

it("I-J5 successful writes do not request an extra active reconciliation", async () => {
  const { createLibraryMutationJournal } = await import("./libraryRollback");
  const journal = createLibraryMutationJournal();
  const operation = journal.begin("user", "A");
  assert.equal(journal.settle(operation), false);
});
