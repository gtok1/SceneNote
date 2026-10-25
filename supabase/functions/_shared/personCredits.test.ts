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

function categoryCredits(liveCount: number, voiceCount: number): TmdbPersonCredit[] {
  const credits: TmdbPersonCredit[] = [];
  for (let index = 0; index < liveCount; index++) {
    credits.push({ id: index + 1, media_type: "movie", character: "Role", genre_ids: [18] });
  }
  for (let index = 0; index < voiceCount; index++) {
    credits.push({ id: liveCount + index + 1, media_type: "movie", character: "Kray (voice)", genre_ids: [16] });
  }
  return credits;
}

describe("TMDB person category classification", () => {
  it("PC-1 keeps a prolific live-action actor with three voice credits an actor", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    assert.equal(classifyTmdbPersonCategory(categoryCredits(93, 3), "voice_actor"), "actor");
  });

  it("PC-2 classifies predominantly voice and animation credits as voice actor", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    assert.equal(classifyTmdbPersonCategory(categoryCredits(1, 10), "actor"), "voice_actor");
  });

  it("PC-3 includes the one-half boundary and excludes four-tenths", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    assert.equal(classifyTmdbPersonCategory(categoryCredits(5, 5), "actor"), "voice_actor");
    assert.equal(classifyTmdbPersonCategory(categoryCredits(6, 4), "voice_actor"), "actor");
  });

  it("PC-4 excludes narration and self appearances from classification", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    const cast = ["Narrator (voice)", "Self - Narrator (voice)", "Herself", "Role"]
      .map((character, index) => ({ id: index + 1, media_type: "movie", character, genre_ids: [18] }));
    assert.equal(classifyTmdbPersonCategory(cast, "voice_actor"), "actor");
  });

  it("PC-5 counts animation genre without an explicit voice marker", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    const cast = categoryCredits(1, 3).map(credit =>
      credit.genre_ids?.includes(16) ? { ...credit, character: "Tanjiro" } : credit
    );
    assert.equal(classifyTmdbPersonCategory(cast, "actor"), "voice_actor");
  });

  it("PC-6 preserves either fallback when no eligible credits remain", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    for (const fallback of ["actor", "voice_actor"] as const) {
      assert.equal(classifyTmdbPersonCategory([], fallback), fallback);
      assert.equal(classifyTmdbPersonCategory([
        { id: 1, media_type: "movie", character: "Self", genre_ids: [16] }
      ], fallback), fallback);
    }
  });

  it("PC-7 corrects a voice-actor request to actor for live-action credits", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    assert.equal(classifyTmdbPersonCategory(categoryCredits(10, 0), "voice_actor"), "actor");
  });

  it("PC-8 counts duplicate media IDs only once", async () => {
    const { classifyTmdbPersonCategory } = await import("./personCredits.ts");
    const cast: TmdbPersonCredit[] = [];
    for (let index = 0; index < 5; index++) {
      cast.push({ id: 1, media_type: "movie", character: "Kray (voice)", genre_ids: [16] });
    }
    cast.push(
      { id: 2, media_type: "movie", character: "Role", genre_ids: [18] },
      { id: 3, media_type: "movie", character: "Role", genre_ids: [18] }
    );
    assert.equal(classifyTmdbPersonCategory(cast, "voice_actor"), "actor");
  });

  it("PC-9 recognizes English and Korean narration without masking a voice role", async () => {
    const { isNarration } = await import("./personCredits.ts");
    assert.deepEqual(
      ["Narrator (voice)", "내레이션", "Narration", "Tanjiro (voice)"].map(isNarration),
      [true, true, true, false]
    );
  });
});

it("PC-10 returns null for no eligible credits and classifies known actor and voice-actor fixtures", async () => {
  const { classifyTmdbPersonCategoryOrNull } = await import("./personCredits.ts");
  assert.equal(classifyTmdbPersonCategoryOrNull([]), null);
  assert.equal(classifyTmdbPersonCategoryOrNull([
    { id: 1, media_type: "movie", character: "Self", genre_ids: [16] }
  ]), null);
  assert.equal(classifyTmdbPersonCategoryOrNull(categoryCredits(93, 3)), "actor");
  assert.equal(classifyTmdbPersonCategoryOrNull(categoryCredits(1, 10)), "voice_actor");
});
