import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anilistKoreanNameInput, tmdbKoreanNameInput } from "./personNames.ts";

describe("tmdbKoreanNameInput", () => {
  it("N-1 takes native name from the ja translation and romaji from en", () => {
    assert.deepEqual(
      tmdbKoreanNameInput({
        name: "長瀬智也",
        also_known_as: [],
        translations: {
          translations: [
            { iso_639_1: "en", iso_3166_1: "US", data: { name: "Tomoya Nagase" } },
            { iso_639_1: "ja", iso_3166_1: "JP", data: { name: "長瀬智也" } }
          ]
        }
      }),
      {
        nativeName: "長瀬智也",
        localizedName: "長瀬智也",
        aliases: [],
        romaji: { text: "Tomoya Nagase", order: "given-family" }
      }
    );
  });

  it("N-2 falls back to a CJK alias for the native name and trims aliases", () => {
    assert.deepEqual(
      tmdbKoreanNameInput({
        name: "사카이 마사토",
        also_known_as: ["Сакаи Масато", "さかい まさと", "堺 雅人", " "],
        translations: { translations: [] }
      }),
      {
        nativeName: "堺 雅人",
        localizedName: "사카이 마사토",
        aliases: ["Сакаи Масато", "さかい まさと", "堺 雅人"],
        romaji: null
      }
    );
  });

  it("N-5 tolerates missing fields", () => {
    assert.deepEqual(tmdbKoreanNameInput({ name: null }), {
      nativeName: null,
      localizedName: null,
      aliases: [],
      romaji: null
    });
    assert.deepEqual(tmdbKoreanNameInput({ name: "長瀬智也", also_known_as: null, translations: null }), {
      nativeName: "長瀬智也",
      localizedName: "長瀬智也",
      aliases: [],
      romaji: null
    });
  });
});

describe("anilistKoreanNameInput", () => {
  it("N-3 builds family-given romaji from first/last", () => {
    assert.deepEqual(
      anilistKoreanNameInput({
        first: "Natsuki",
        last: "Hanae",
        full: "Natsuki Hanae",
        native: "花江夏樹",
        alternative: ["Hana-chan", null, "하나에 나츠키"]
      }),
      {
        nativeName: "花江夏樹",
        localizedName: null,
        aliases: ["Hana-chan", "하나에 나츠키"],
        romaji: { text: "Hanae Natsuki", order: "family-given" }
      }
    );
  });

  it("N-4 falls back to full name, and handles null", () => {
    assert.deepEqual(anilistKoreanNameInput({ full: "Nana Mizuki", native: "水樹奈々" }), {
      nativeName: "水樹奈々",
      localizedName: null,
      aliases: [],
      romaji: { text: "Nana Mizuki", order: "given-family" }
    });
    assert.deepEqual(anilistKoreanNameInput(null), {
      nativeName: null,
      localizedName: null,
      aliases: [],
      romaji: null
    });
  });
});
