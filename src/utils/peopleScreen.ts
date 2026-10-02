import type { PersonCategory, PersonSearchResult } from "@/types/people";
import { getHomeLayout } from "@/utils/homeLayout";
import { formatPersonName } from "@/utils/japaneseName";

export const PERSON_SEARCH_MIN_LENGTH = 2;
export const PERSON_SEARCH_DEBOUNCE_MS = 300;
export const PEOPLE_CATEGORY_OPTIONS: readonly { label: string; value: PersonCategory | "all" }[] = [
  { label: "전체", value: "all" },
  { label: "배우", value: "actor" },
  { label: "성우", value: "voice_actor" }
];

export interface PeopleLayout {
  gutter: number;
  contentWidth: number;
  columns: number;
  gap: number;
  cardWidth: number;
  stackSearchTools: boolean;
}

export function getPeopleLayout(width: number): PeopleLayout {
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const home = getHomeLayout(w);

  return {
    gutter: home.gutter,
    contentWidth: home.contentWidth,
    columns: home.pinColumns,
    gap: home.posterGap,
    cardWidth: home.pinWidth,
    stackSearchTools: w < 600
  };
}

export function personKey(person: Pick<PersonSearchResult, "source" | "external_id">): string {
  return `${person.source}:${person.external_id}`;
}

export function personCategoryLabel(category: PersonCategory): "배우" | "성우" {
  return category === "voice_actor" ? "성우" : "배우";
}

export function personInitial(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
}

export interface PersonCardModel {
  key: string;
  name: string;
  secondaryName: string | null;
  categoryLabel: "배우" | "성우";
  knownForText: string | null;
  accessibilityLabel: string;
}

export function createPersonCardModel(person: PersonSearchResult): PersonCardModel {
  const formatted = formatPersonName(person);
  const name = formatted.name || "이름 없음";
  const secondaryName = formatted.secondaryName;
  const categoryLabel = personCategoryLabel(person.category);
  const titles = person.known_for.map((title) => title.trim()).filter(Boolean);
  const knownFor = titles.filter((title, index) => titles.indexOf(title) === index).slice(0, 3);
  const knownForText = knownFor.length > 0 ? knownFor.join(" · ") : null;

  return {
    key: personKey(person),
    name,
    secondaryName,
    categoryLabel,
    knownForText,
    accessibilityLabel: `${name}, ${categoryLabel}${knownForText ? `, 대표작 ${knownForText}` : ""}, 상세 보기`
  };
}

export function filterFavoritePeople<T extends Pick<PersonSearchResult, "category">>(
  people: readonly T[],
  category: PersonCategory | "all"
): T[] {
  return category === "all" ? [...people] : people.filter((person) => person.category === category);
}

export type FavoriteActionState = "add" | "adding" | "added";

export function getFavoriteActionState(
  key: string,
  favoriteKeys: ReadonlySet<string>,
  pendingKeys: ReadonlySet<string>
): FavoriteActionState {
  if (favoriteKeys.has(key)) return "added";
  if (pendingKeys.has(key)) return "adding";
  return "add";
}

export function favoriteAddCopy(
  state: FavoriteActionState,
  name: string
): { label: string; accessibilityLabel: string; disabled: boolean } {
  if (state === "adding") return { label: "추가 중", accessibilityLabel: `${name} 추가 중`, disabled: true };
  if (state === "added") return { label: "추가됨", accessibilityLabel: `${name} 이미 추가됨`, disabled: true };
  return { label: "추가", accessibilityLabel: `${name} 좋아하는 인물에 추가`, disabled: false };
}

export function favoriteRemoveCopy(name: string): { accessibilityLabel: string; toastMessage: string } {
  return {
    accessibilityLabel: `${name} 좋아하는 인물에서 빼기`,
    toastMessage: `${name} 님을 좋아하는 인물에서 뺐어요.`
  };
}

export function toPersonSearchResult(person: PersonSearchResult): PersonSearchResult {
  return {
    source: person.source,
    external_id: person.external_id,
    category: person.category,
    name: person.name,
    original_name: person.original_name,
    profile_url: person.profile_url,
    known_for: [...person.known_for],
    ...(person.name_ko !== undefined ? { name_ko: person.name_ko, name_ko_source: person.name_ko_source ?? null } : {})
  };
}

export type PeopleSearchState = "idle" | "too_short" | "search";

export function getPeopleSearchState(query: string): PeopleSearchState {
  const length = query.trim().length;
  if (length === 0) return "idle";
  return length < PERSON_SEARCH_MIN_LENGTH ? "too_short" : "search";
}

export function shouldShowPersonSearchSkeleton(input: {
  isLoading: boolean;
  hasData: boolean;
  query: string;
  debouncedQuery: string;
}): boolean {
  if (getPeopleSearchState(input.query) !== "search") return false;
  if (input.isLoading) return true;
  return !input.hasData && input.query.trim() !== input.debouncedQuery.trim();
}

export function personSearchEmptyCopy(query: string): { title: string; description: string } {
  return {
    title: `"${query.trim()}" 검색 결과가 없어요`,
    description: "이름 철자를 바꾸거나 원어 이름으로 검색해 보세요."
  };
}

export function favoriteEmptyCopy(
  category: PersonCategory | "all",
  totalCount: number
): { title: string; description: string } {
  if (totalCount === 0 || category === "all") {
    return { title: "아직 좋아하는 인물이 없어요", description: "배우나 성우를 검색해서 추가해 보세요." };
  }
  const label = personCategoryLabel(category);
  return {
    title: `좋아하는 ${label}가 없어요`,
    description: `다른 분류를 보거나 ${label}를 검색해서 추가해 보세요.`
  };
}
