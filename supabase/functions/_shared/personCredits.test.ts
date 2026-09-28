import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSelfAppearance, selectPersonCastCredits, type TmdbPersonCredit } from "./personCredits.ts";

const c = (id: number, overrides: Partial<TmdbPersonCredit> = {}): TmdbPersonCredit => ({
  id, media_type: "tv", genre_ids: [18], character: "역할", popularity: 1, vote_count: 0, ...overrides
});

describe("person cast credit selection", () => {
  it("C-1 excludes news, reality, and talk genres", () => {
    const selected = selectPersonCastCredits([c(1, { genre_ids: [10767] }), c(2, { genre_ids: [10764] }), c(3, { genre_ids: [10763] }), c(4, { genre_ids: [18] })]);
    assert.deepEqual(selected.map(item => item.id), [4]);
  });
  it("C-2 removes self appearances without removing similar names", () => {
    const characters = ["Self", "Herself - Guest", "Himself", "본인", "Selfie Girl", "Hye-jin", null];
    assert.deepEqual(selectPersonCastCredits(characters.map((character, index) => c(index, { character }))).map(item => item.id), [4, 5, 6]);
  });
  it("C-3 retains only movie and TV credits", () => {
    assert.deepEqual(selectPersonCastCredits([c(1, { media_type: "person" }), c(2, { media_type: undefined }), c(3, { media_type: "movie" })]).map(item => item.id), [3]);
  });
  it("C-4 scores all credits before taking forty", () => {
    const cast = Array.from({ length: 45 }, (_, index) => c(index, { popularity: index === 44 ? 99 : 1 }));
    const selected = selectPersonCastCredits(cast);
    assert.equal(selected.length, 40);
    assert.equal(selected[0]?.id, 44);
  });
  it("C-5 deduplicates the first credit for a media ID", () => {
    const selected = selectPersonCastCredits([c(1, { character: "역할 A" }), c(1, { character: "역할 B" })]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.character, "역할 A");
  });
  it("C-6 breaks score ties by ID", () => {
    assert.deepEqual(selectPersonCastCredits([c(30, { popularity: 5 }), c(10, { popularity: 5 })]).map(item => item.id), [10, 30]);
  });
  it("C-7 honors a smaller limit", () => {
    assert.equal(selectPersonCastCredits(Array.from({ length: 5 }, (_, index) => c(index)), 3).length, 3);
  });
  it("C-8 leaves the input array unchanged", () => {
    const cast = [c(3), c(1), c(2)];
    const original = [...cast];
    selectPersonCastCredits(cast);
    assert.deepEqual(cast, original);
    assert.deepEqual(cast.map(item => item.id), [3, 1, 2]);
  });
  it("C-9 treats absent and empty character names as non-self", () => {
    assert.equal(isSelfAppearance(undefined), false);
    assert.equal(isSelfAppearance(""), false);
  });
});
