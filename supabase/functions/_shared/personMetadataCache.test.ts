import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateStoredPersonAge, createPersonMetadataKey, isStoredPersonDetail } from "./personMetadataCache.ts";

const person = {
  source: "tmdb", external_id: "123", category: "actor", name: "배우", original_name: null,
  profile_url: null, birthday: "2000-11-15", deathday: null, age: 20, birthplace: null,
  biography: null, name_ko: null, name_ko_source: null,
  credits: [{ external_source: "tmdb", external_id: "5", title: "작품", original_title: null,
    poster_url: null, content_type: "movie", air_year: 2020, air_date: "2020-01-01", role: null }]
};

describe("persistent person metadata", () => {
  it("PN-1 separates source, person identity and fallback category", () => {
    const key = createPersonMetadataKey("tmdb", "123", "actor");
    assert.equal(key, createPersonMetadataKey("tmdb", "123", "actor"));
    assert.notEqual(key, createPersonMetadataKey("anilist", "123", "actor"));
    assert.notEqual(key, createPersonMetadataKey("tmdb", "124", "actor"));
    assert.notEqual(key, createPersonMetadataKey("tmdb", "123", "voice_actor"));
  });
  it("PN-2 accepts valid empty credits and inferred category without mixing identities", () => {
    assert.equal(isStoredPersonDetail(person, "tmdb", "123"), true);
    assert.equal(isStoredPersonDetail({ ...person, credits: [], category: "voice_actor" }, "tmdb", "123"), true);
    assert.equal(isStoredPersonDetail(person, "anilist", "123"), false);
    assert.equal(isStoredPersonDetail(person, "tmdb", "124"), false);
  });
  it("PN-3 rejects malformed snapshot and nested credits", () => {
    for (const value of [null, {}, { ...person, name: 1 }, { ...person, category: "admin" },
      { ...person, credits: null }, { ...person, credits: [{}] }, { ...person, birthday: 1 },
      { ...person, credits: [{ ...person.credits[0], external_source: "manual" }] }]) {
      assert.equal(isStoredPersonDetail(value, "tmdb", "123"), false);
    }
  });
  it("PN-4 recalculates age from the birthday without fetching on the birthday", () => {
    assert.equal(calculateStoredPersonAge("2000-11-15", null, new Date("2026-11-14T23:59:59Z")), 25);
    assert.equal(calculateStoredPersonAge("2000-11-15", null, new Date("2026-11-15T00:00:00Z")), 26);
    assert.equal(calculateStoredPersonAge("2000-11-15", null, new Date("2027-11-15T00:00:00Z")), 27);
  });
  it("PN-5 keeps deceased age fixed and rejects invalid or future birth dates", () => {
    assert.equal(calculateStoredPersonAge("1950-05-01", "2020-04-30", new Date("2026-11-15T00:00:00Z")), 69);
    for (const birth of [null, "invalid", "2000-02-30", "2027-01-01"]) {
      assert.equal(calculateStoredPersonAge(birth, null, new Date("2026-11-15T00:00:00Z")), null);
    }
    assert.equal(calculateStoredPersonAge("2000-01-01", "invalid"), null);
  });
});
