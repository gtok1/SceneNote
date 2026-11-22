import type { Tag } from "@/types/pins";

export const PIN_TAG_LIMITS = { maxLength: 20, maxCount: 10, maxSuggestions: 8 } as const;
export const PIN_TAG_COPY = {
  empty: "태그를 입력해 주세요.",
  tooLong: "태그는 20자까지 입력할 수 있어요.",
  duplicate: "이미 추가한 태그입니다.",
  tooMany: "태그는 10개까지 추가할 수 있어요.",
  placeholder: "태그 입력 (쉼표로 여러 개)",
  suggestionsLabel: "내 태그"
} as const;

const separator = /[,，\r\n]/;

function tagName(fragment: string): string {
  return fragment.trim().replace(/^#+/, "").trim();
}

export function splitTagInput(raw: string): string[] {
  return [...new Set(raw.split(separator).map(tagName).filter(Boolean))];
}

export function addTagsFromInput(current: readonly string[], raw: string): { tags: string[]; error: string | null } {
  const tags = [...current];
  const names = splitTagInput(raw);
  if (!names.length) return { tags, error: PIN_TAG_COPY.empty };
  const additions = names.filter((name) => !current.includes(name));
  if (!additions.length) return { tags, error: PIN_TAG_COPY.duplicate };
  if (additions.some((name) => name.length > PIN_TAG_LIMITS.maxLength)) return { tags, error: PIN_TAG_COPY.tooLong };
  if (tags.length + additions.length > PIN_TAG_LIMITS.maxCount) return { tags, error: PIN_TAG_COPY.tooMany };
  return { tags: [...tags, ...additions], error: null };
}

export function lastTagFragment(raw: string): string {
  return tagName(raw.split(separator).pop() ?? "");
}

export function removeLastTagFragment(raw: string): string {
  const last = raw.split(separator).pop() ?? "";
  // Keep the delimiter and any spacing the user typed after it.
  return last === raw ? "" : raw.slice(0, raw.length - last.trimStart().length);
}

function newestFirst(a: string, b: string): number {
  if (a === b) return 0;
  const milliseconds = Date.parse(b) - Date.parse(a);
  if (milliseconds) return milliseconds;
  // PostgreSQL timestamps can differ below the millisecond precision of Date.parse.
  return Number(b.match(/\.\d+/)?.[0] ?? 0) - Number(a.match(/\.\d+/)?.[0] ?? 0);
}

export function suggestPinTags(all: readonly Pick<Tag, "name" | "created_at">[], added: readonly string[], raw: string): string[] {
  if (added.length >= PIN_TAG_LIMITS.maxCount) return [];
  const query = lastTagFragment(raw).toLowerCase();
  const candidates = all.filter(({ name }) => !added.includes(name) && name.toLowerCase().includes(query));
  candidates.sort((a, b) => {
    const priority = query
      ? Number(b.name.toLowerCase().startsWith(query)) - Number(a.name.toLowerCase().startsWith(query))
      : newestFirst(a.created_at, b.created_at);
    return priority || a.name.localeCompare(b.name, "ko");
  });
  return candidates.slice(0, PIN_TAG_LIMITS.maxSuggestions).map(({ name }) => name);
}
