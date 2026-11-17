interface LibraryRowIdentity {
  library_item_id: string;
}

/** Restore only fields still owned by this failed optimistic update. */
export function rollbackLibraryItem<T extends LibraryRowIdentity>(
  current: T[] | undefined,
  before: T[] | undefined,
  optimistic: T[] | undefined,
  libraryItemId: string
): { items: T[] | undefined; conflicted: boolean } {
  if (!current) return { items: current, conflicted: true };
  const previousIndex = before?.findIndex(item => item.library_item_id === libraryItemId) ?? -1;
  const previous = previousIndex < 0 ? undefined : before?.[previousIndex];
  if (!previous) return { items: current, conflicted: false };

  const next = optimistic?.find(item => item.library_item_id === libraryItemId);
  const currentIndex = current.findIndex(item => item.library_item_id === libraryItemId);
  if (!next) {
    if (currentIndex >= 0) return { items: current, conflicted: true };
    const restored = [...current];
    restored.splice(Math.min(previousIndex, restored.length), 0, previous);
    return { items: restored, conflicted: false };
  }
  if (currentIndex < 0) return { items: current, conflicted: true };

  const existing = current[currentIndex]!;
  const restored = { ...existing };
  const previousFields = previous as unknown as Record<string, unknown>;
  const optimisticFields = next as unknown as Record<string, unknown>;
  const currentFields = existing as unknown as Record<string, unknown>;
  const restoredFields = restored as unknown as Record<string, unknown>;
  let changed = false;
  let conflicted = false;
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const previouslyPresent = Object.hasOwn(previous, key);
    const optimisticallyPresent = Object.hasOwn(next, key);
    if (previouslyPresent === optimisticallyPresent && Object.is(previousFields[key], optimisticFields[key])) continue;
    if (Object.hasOwn(existing, key) !== optimisticallyPresent || !Object.is(currentFields[key], optimisticFields[key])) {
      conflicted = true;
      continue;
    }
    if (previouslyPresent) restoredFields[key] = previousFields[key];
    else delete restoredFields[key];
    changed = true;
  }
  return {
    items: changed ? current.map((item, index) => index === currentIndex ? restored : item) : current,
    conflicted
  };
}

export interface LibraryMutationOperation {
  userId: string;
  libraryItemId: string;
  revision: number;
}

/** Keep failed writes from rolling back a newer operation, including a successful deletion. */
export function createLibraryMutationJournal() {
  let revision = 0;
  const users = new Map<string, { pending: Set<number>; latest: Map<string, number>; reconcile: boolean }>();
  return {
    begin(userId: string, libraryItemId: string): LibraryMutationOperation {
      let user = users.get(userId);
      if (!user) {
        user = { pending: new Set(), latest: new Map(), reconcile: false };
        users.set(userId, user);
      }
      const operation = { userId, libraryItemId, revision: ++revision };
      user.pending.add(operation.revision);
      user.latest.set(libraryItemId, operation.revision);
      return operation;
    },
    canRollback(operation: LibraryMutationOperation): boolean {
      return users.get(operation.userId)?.latest.get(operation.libraryItemId) === operation.revision;
    },
    failed(operation: LibraryMutationOperation): void {
      const user = users.get(operation.userId);
      if (user) user.reconcile = true;
    },
    settle(operation: LibraryMutationOperation): boolean {
      const user = users.get(operation.userId);
      if (!user || !user.pending.delete(operation.revision) || user.pending.size > 0) return false;
      users.delete(operation.userId);
      return user.reconcile;
    }
  };
}
