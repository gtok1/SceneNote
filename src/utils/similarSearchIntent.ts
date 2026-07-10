import type { MediaTypeFilter } from "@/types/content";

export type SimilarityFocus = "balanced" | "mood" | "story" | "setting" | "relationship" | "genre" | "character";
export type SimilaritySort = "similarity" | "latest" | "popular";

export interface SimilarityModifier {
  key: "romance" | "comedy" | "violence" | "school" | "completed" | "korean" | "short";
  label: string;
  direction: "include" | "exclude";
}

export type ParsedSearchIntent =
  | { mode: "keyword"; normalizedQuery: string }
  | {
      mode: "similarity";
      normalizedQuery: string;
      anchorText: string;
      targetMediaType: MediaTypeFilter;
      focus: SimilarityFocus;
      sort: SimilaritySort;
      modifiers: SimilarityModifier[];
    };

export const SIMILAR_SEARCH_EXAMPLES = [
  "길티 크라운 같은 결의 애니",
  "태양의 후예 느낌의 드라마",
  "도깨비와 스토리가 비슷한 드라마"
] as const;

const TRIGGER = /(?:와|과|처럼|같은(?:데|\s*작품)?|느낌(?:의|인)?|비슷(?:한|하게)?|닮은)/u;

export function normalizeSearchQuery(query: string): string {
  return query.normalize("NFKC").replace(/[\u0000-\u001f<>]/gu, " ").replace(/\s+/gu, " ").trim();
}

export function parseSearchIntent(rawQuery: string): ParsedSearchIntent {
  const normalizedQuery = normalizeSearchQuery(rawQuery);
  if (!normalizedQuery || !TRIGGER.test(normalizedQuery)) return { mode: "keyword", normalizedQuery };

  const targetMediaType = detectMediaType(normalizedQuery);
  const focus = detectFocus(normalizedQuery);
  const sort: SimilaritySort = /최신/u.test(normalizedQuery) ? "latest" : /인기/u.test(normalizedQuery) ? "popular" : "similarity";
  const modifiers = detectModifiers(normalizedQuery);
  const anchorText = extractAnchorText(normalizedQuery);

  if (anchorText.length < 1) return { mode: "keyword", normalizedQuery };
  return { mode: "similarity", normalizedQuery, anchorText, targetMediaType, focus, sort, modifiers };
}

function extractAnchorText(query: string): string {
  const triggerIndex = query.search(TRIGGER);
  if (triggerIndex <= 0) return "";
  return query.slice(0, triggerIndex).replace(/["'“”‘’]/gu, "").trim();
}

function detectMediaType(query: string): MediaTypeFilter {
  if (/애니|애니메이션/u.test(query)) return "anime";
  if (/영화/u.test(query)) return "movie";
  if (/드라마/u.test(query)) return "drama";
  return "all";
}

function detectFocus(query: string): SimilarityFocus {
  if (/분위기|느낌|결/u.test(query)) return "mood";
  if (/스토리|줄거리|서사/u.test(query)) return "story";
  if (/세계관|배경|설정/u.test(query)) return "setting";
  if (/관계|로맨스|케미/u.test(query)) return "relationship";
  if (/장르/u.test(query)) return "genre";
  if (/캐릭터|주인공/u.test(query)) return "character";
  return "balanced";
}

function detectModifiers(query: string): SimilarityModifier[] {
  const definitions: [RegExp, SimilarityModifier][] = [
    [/로맨스(?:는|가)?\s*(?:적은|없는|제외)/u, { key: "romance", label: "로맨스 적음", direction: "exclude" }],
    [/코미디(?:가|는)?\s*(?:더\s*)?(?:많은|강한)/u, { key: "comedy", label: "코미디 많음", direction: "include" }],
    [/(?:잔인함|고어|폭력)(?:은|는)?\s*(?:적은|없는|제외)/u, { key: "violence", label: "잔인함 제외", direction: "exclude" }],
    [/학원물?(?:은|는)?\s*(?:없는|제외)/u, { key: "school", label: "학원물 제외", direction: "exclude" }],
    [/12\s*화\s*이하/u, { key: "short", label: "12화 이하", direction: "include" }]
  ];
  return definitions.filter(([pattern]) => pattern.test(query)).map(([, modifier]) => modifier);
}
