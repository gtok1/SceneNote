export const SEARCH_QUERY_DEBOUNCE_MS = 300;

export function hasComposingHangulJamo(value: string): boolean {
  return /[ᄀ-ᇿ㄰-㆏]/.test(value);
}

export function nextSearchRequestQuery(previous: string, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return "";
  return hasComposingHangulJamo(trimmed) ? previous : trimmed;
}
