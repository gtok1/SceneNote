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
