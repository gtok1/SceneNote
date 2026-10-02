import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FavoritePerson, PersonSearchResult } from "@/types/people";

import {
  PEOPLE_CATEGORY_OPTIONS,
  PERSON_SEARCH_DEBOUNCE_MS,
  PERSON_SEARCH_MIN_LENGTH,
  createPersonCardModel,
  favoriteAddCopy,
  favoriteEmptyCopy,
  favoriteRemoveCopy,
  filterFavoritePeople,
  getFavoriteActionState,
  getPeopleLayout,
  getPeopleSearchState,
  personCategoryLabel,
  personInitial,
  personKey,
  personSearchEmptyCopy,
  shouldShowPersonSearchSkeleton,
  toPersonSearchResult
} from "./peopleScreen";

function person(overrides: Partial<PersonSearchResult> = {}): PersonSearchResult {
  return {
    source: "tmdb",
    external_id: "1",
    category: "actor",
    name: "오구리 슌",
    original_name: null,
    profile_url: null,
    known_for: [],
    ...overrides
  };
}

describe("getPeopleLayout", () => {
  it("L-1 width 375", () => {
    assert.deepEqual(getPeopleLayout(375), { gutter: 16, contentWidth: 343, columns: 1, gap: 12, cardWidth: 343, stackSearchTools: true });
  });
  it("L-2 width 599", () => {
    assert.deepEqual(getPeopleLayout(599), { gutter: 16, contentWidth: 567, columns: 1, gap: 12, cardWidth: 567, stackSearchTools: true });
  });
  it("L-3 width 600", () => {
    assert.deepEqual(getPeopleLayout(600), { gutter: 24, contentWidth: 552, columns: 2, gap: 16, cardWidth: 268, stackSearchTools: false });
  });
  it("L-4 width 768", () => {
    assert.deepEqual(getPeopleLayout(768), { gutter: 24, contentWidth: 720, columns: 2, gap: 16, cardWidth: 352, stackSearchTools: false });
  });
  it("L-5 width 960", () => {
    assert.deepEqual(getPeopleLayout(960), { gutter: 24, contentWidth: 912, columns: 3, gap: 16, cardWidth: 293, stackSearchTools: false });
  });
  it("L-6 width 2000", () => {
    assert.deepEqual(getPeopleLayout(2000), { gutter: 24, contentWidth: 1152, columns: 3, gap: 16, cardWidth: 373, stackSearchTools: false });
  });
  it("L-7 invalid widths fall back to 375", () => {
    const base = getPeopleLayout(375);
    assert.deepEqual(getPeopleLayout(NaN), base);
    assert.deepEqual(getPeopleLayout(0), base);
    assert.deepEqual(getPeopleLayout(-1), base);
  });
});

describe("peopleScreen helpers", () => {
  it("P-1 personKey", () => {
    assert.equal(personKey({ source: "tmdb", external_id: "123" }), "tmdb:123");
    assert.equal(personKey({ source: "anilist", external_id: "95" }), "anilist:95");
  });

  it("P-2 personCategoryLabel", () => {
    assert.equal(personCategoryLabel("actor"), "배우");
    assert.equal(personCategoryLabel("voice_actor"), "성우");
  });

  it("P-3 personInitial", () => {
    assert.equal(personInitial("  박신혜"), "박");
    assert.equal(personInitial("花江夏樹"), "花");
    assert.equal(personInitial("natsuki"), "N");
    assert.equal(personInitial(""), "?");
    assert.equal(personInitial("   "), "?");
    assert.equal(personInitial("😀abc"), "😀");
  });

  it("P-4 createPersonCardModel", () => {
    assert.deepEqual(
      createPersonCardModel({
        source: "anilist",
        external_id: "95",
        category: "voice_actor",
        name: "花江夏樹",
        original_name: "Natsuki Hanae",
        profile_url: null,
        known_for: ["고깔모자의 아틀리에"]
      }),
      {
        key: "anilist:95",
        name: "花江夏樹(하나에 나츠키)",
        secondaryName: null,
        categoryLabel: "성우",
        knownForText: "고깔모자의 아틀리에",
        accessibilityLabel: "花江夏樹(하나에 나츠키), 성우, 대표작 고깔모자의 아틀리에, 상세 보기"
      }
    );
  });

  it("P-5 secondaryName hidden when empty or same as name", () => {
    for (const original of [null, "", "  ", "오구리 슌"]) {
      const model = createPersonCardModel(person({ name: " 오구리 슌 ", original_name: original }));
      assert.equal(model.name, "오구리 슌");
      assert.equal(model.secondaryName, null);
    }
  });

  it("P-6 knownForText trims, dedupes, keeps first 3", () => {
    const model = createPersonCardModel(
      person({ known_for: ["꽃보다 남자", " 꽃보다 남자 ", "", "꽃보다 남자 극장판", "나는 여동생을 사랑한다", "고쿠센"] })
    );
    assert.equal(model.knownForText, "꽃보다 남자 · 꽃보다 남자 극장판 · 나는 여동생을 사랑한다");
  });

  it("P-7 no known_for", () => {
    const model = createPersonCardModel(person({ name: "오구리 슌", category: "actor", known_for: [] }));
    assert.equal(model.knownForText, null);
    assert.equal(model.accessibilityLabel, "오구리 슌, 배우, 상세 보기");
  });

  it("P-8 blank name", () => {
    assert.equal(createPersonCardModel(person({ name: "  " })).name, "이름 없음");
  });

  it("P-9 filterFavoritePeople", () => {
    const a = person({ category: "actor", external_id: "a" });
    const b = person({ category: "voice_actor", external_id: "b" });
    const c = person({ category: "actor", external_id: "c" });
    const input = [a, b, c];
    const all = filterFavoritePeople(input, "all");
    assert.deepEqual(all, [a, b, c]);
    assert.notEqual(all, input);
    assert.deepEqual(filterFavoritePeople(input, "actor"), [a, c]);
    assert.deepEqual(filterFavoritePeople(input, "voice_actor"), [b]);
  });

  it("P-10 getFavoriteActionState", () => {
    assert.equal(getFavoriteActionState("k", new Set(["k"]), new Set(["k"])), "added");
    assert.equal(getFavoriteActionState("k", new Set(), new Set(["k"])), "adding");
    assert.equal(getFavoriteActionState("k", new Set(), new Set()), "add");
  });

  it("P-11 favoriteAddCopy", () => {
    assert.deepEqual(favoriteAddCopy("add", "박신혜"), { label: "추가", accessibilityLabel: "박신혜 좋아하는 인물에 추가", disabled: false });
    assert.deepEqual(favoriteAddCopy("adding", "박신혜"), { label: "추가 중", accessibilityLabel: "박신혜 추가 중", disabled: true });
    assert.deepEqual(favoriteAddCopy("added", "박신혜"), { label: "추가됨", accessibilityLabel: "박신혜 이미 추가됨", disabled: true });
  });

  it("P-12 favoriteRemoveCopy", () => {
    assert.deepEqual(favoriteRemoveCopy("사카이 마사토"), {
      accessibilityLabel: "사카이 마사토 좋아하는 인물에서 빼기",
      toastMessage: "사카이 마사토 님을 좋아하는 인물에서 뺐어요."
    });
  });

  it("P-13 toPersonSearchResult strips favorite fields", () => {
    const input: FavoritePerson = {
      id: "f1",
      user_id: "u1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      source: "tmdb",
      external_id: "1",
      category: "actor",
      name: "박신혜",
      original_name: null,
      profile_url: null,
      known_for: ["피노키오"]
    };
    const result = toPersonSearchResult(input);
    assert.deepEqual(result, {
      source: "tmdb",
      external_id: "1",
      category: "actor",
      name: "박신혜",
      original_name: null,
      profile_url: null,
      known_for: ["피노키오"]
    });
    assert.equal("id" in result, false);
    assert.notEqual(result.known_for, input.known_for);
  });

  it("P-19 toPersonSearchResult keeps name_ko but drops name_ko_checked_at", () => {
    const input: FavoritePerson = {
      id: "f1",
      user_id: "u1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      source: "tmdb",
      external_id: "1",
      category: "actor",
      name: "長瀬智也",
      original_name: null,
      profile_url: null,
      known_for: [],
      name_ko: "나가세 토모야",
      name_ko_source: "romaji",
      name_ko_checked_at: "2026-10-01T00:00:00Z"
    };
    const result = toPersonSearchResult(input);
    assert.deepEqual(result, {
      source: "tmdb",
      external_id: "1",
      category: "actor",
      name: "長瀬智也",
      original_name: null,
      profile_url: null,
      known_for: [],
      name_ko: "나가세 토모야",
      name_ko_source: "romaji"
    });
    assert.equal("name_ko_checked_at" in result, false);
  });

  it("P-14 getPeopleSearchState", () => {
    assert.equal(getPeopleSearchState(""), "idle");
    assert.equal(getPeopleSearchState("   "), "idle");
    assert.equal(getPeopleSearchState("박"), "too_short");
    assert.equal(getPeopleSearchState(" 박 "), "too_short");
    assert.equal(getPeopleSearchState("박신"), "search");
  });

  it("P-15 shouldShowPersonSearchSkeleton", () => {
    assert.equal(shouldShowPersonSearchSkeleton({ isLoading: true, hasData: false, query: "박신혜", debouncedQuery: "박신혜" }), true);
    assert.equal(shouldShowPersonSearchSkeleton({ isLoading: false, hasData: false, query: "박신혜", debouncedQuery: "박신" }), true);
    assert.equal(shouldShowPersonSearchSkeleton({ isLoading: false, hasData: true, query: "박신혜", debouncedQuery: "박신" }), false);
    assert.equal(shouldShowPersonSearchSkeleton({ isLoading: false, hasData: false, query: "박신혜", debouncedQuery: "박신혜" }), false);
    assert.equal(shouldShowPersonSearchSkeleton({ isLoading: true, hasData: false, query: "박", debouncedQuery: "" }), false);
  });

  it("P-16 personSearchEmptyCopy", () => {
    assert.deepEqual(personSearchEmptyCopy("  박신혜 "), {
      title: "\"박신혜\" 검색 결과가 없어요",
      description: "이름 철자를 바꾸거나 원어 이름으로 검색해 보세요."
    });
  });

  it("P-17 favoriteEmptyCopy", () => {
    const general = { title: "아직 좋아하는 인물이 없어요", description: "배우나 성우를 검색해서 추가해 보세요." };
    assert.deepEqual(favoriteEmptyCopy("all", 0), general);
    assert.deepEqual(favoriteEmptyCopy("actor", 0), general);
    assert.deepEqual(favoriteEmptyCopy("voice_actor", 0), general);
    assert.deepEqual(favoriteEmptyCopy("all", 3), general);
    assert.deepEqual(favoriteEmptyCopy("actor", 3), { title: "좋아하는 배우가 없어요", description: "다른 분류를 보거나 배우를 검색해서 추가해 보세요." });
    assert.deepEqual(favoriteEmptyCopy("voice_actor", 3), { title: "좋아하는 성우가 없어요", description: "다른 분류를 보거나 성우를 검색해서 추가해 보세요." });
  });

  it("P-18 constants", () => {
    assert.equal(PERSON_SEARCH_MIN_LENGTH, 2);
    assert.equal(PERSON_SEARCH_DEBOUNCE_MS, 300);
    assert.deepEqual(PEOPLE_CATEGORY_OPTIONS, [
      { label: "전체", value: "all" },
      { label: "배우", value: "actor" },
      { label: "성우", value: "voice_actor" }
    ]);
  });
});
