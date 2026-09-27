export const MAX_SEARCH_HISTORY_ENTRIES = 20;

function normalizeForDedupe(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function addSearchHistoryEntry(history: readonly string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [...history];

  const target = normalizeForDedupe(trimmed);
  const withoutDuplicate = history.filter((entry) => normalizeForDedupe(entry) !== target);
  return [trimmed, ...withoutDuplicate].slice(0, MAX_SEARCH_HISTORY_ENTRIES);
}

export function removeSearchHistoryEntry(history: readonly string[], query: string): string[] {
  const target = normalizeForDedupe(query);
  return history.filter((entry) => normalizeForDedupe(entry) !== target);
}

export interface AccountSearchHistory {
  queriesByUserId: Record<string, string[]>;
  // Old global history has no provable owner. Keep it stored, but never display it as an account's history.
  legacyQueries: string[];
}

export function normalizeAccountSearchHistory(value: unknown): AccountSearchHistory {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const map = raw.queriesByUserId && typeof raw.queriesByUserId === "object" && !Array.isArray(raw.queriesByUserId)
    ? raw.queriesByUserId as Record<string, unknown> : {};
  const normalizeEntries = (entries: unknown) => Array.isArray(entries)
    ? entries.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .reverse().reduce((history, entry) => addSearchHistoryEntry(history, entry), [] as string[]) : [];
  return {
    queriesByUserId: Object.fromEntries(Object.entries(map).map(([id, entries]) => [id, normalizeEntries(entries)])),
    legacyQueries: normalizeEntries(raw.legacyQueries ?? raw.queries)
  };
}

export function getAccountSearchHistory(history: AccountSearchHistory, userId: string | null): string[] {
  return userId && Object.prototype.hasOwnProperty.call(history.queriesByUserId, userId)
    ? [...(history.queriesByUserId[userId] ?? [])] : [];
}

export function updateAccountSearchHistory(
  history: AccountSearchHistory, userId: string | null, update: (queries: string[]) => string[]
): AccountSearchHistory {
  if (!userId) return history;
  return { ...history, queriesByUserId: { ...history.queriesByUserId, [userId]: update(getAccountSearchHistory(history, userId)) } };
}
