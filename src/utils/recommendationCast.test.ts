import assert from "node:assert/strict";
import { it } from "node:test";
import type { CastMember } from "../types/content";
import { recommendationCastLabel, recommendationCastNames, recommendationCastMediaType } from "./recommendationCast";

const member = (id: number, name: string, order: number, source: CastMember["source"] = "tmdb"): CastMember => ({
  id, name, order, source, original_name: null, character: null, profile_url: null
});
it("labels anime voice actors and Korean/Japanese/overseas drama actors", () => {
  assert.equal(recommendationCastLabel("anime"), "성우");
  for (const type of ["kdrama", "jdrama", "other"] as const) assert.equal(recommendationCastLabel(type), "출연배우");
  assert.equal(recommendationCastLabel("movie"), "출연배우");
});
it("takes two people in API billing order without changing the source array", () => {
  const cast = [member(3, "세 번째", 2), member(1, " 첫 번째 ", 0), member(2, "두 번째", 1)];
  assert.deepEqual(recommendationCastNames(cast), ["첫 번째", "두 번째"]);
  assert.equal(cast[0]?.id, 3);
});
it("skips blank names and duplicate voice actors across characters", () => {
  assert.deepEqual(recommendationCastNames([member(1, " ", 0), member(2, "성우 A", 1, "anilist"), member(2, "성우 A", 2, "anilist"), member(3, "성우 B", 3, "anilist")]), ["성우 A", "성우 B"]);
});
it("preserves provider identity and never invents missing cast", () => {
  assert.deepEqual(recommendationCastNames([]), []);
  assert.deepEqual(recommendationCastNames([member(1, "한 명", 0)]), ["한 명"]);
  assert.deepEqual(recommendationCastNames([member(1, "A", 0, "anilist"), member(1, "B", 1, "tmdb")]), ["A", "B"]);
});
it("shows Korean readings for AniList voice actors instead of kanji", () => {
  assert.deepEqual(recommendationCastNames([
    { ...member(1, "伊藤美来", 0, "anilist"), original_name: "Miku Itou" },
    { ...member(2, "石橋陽彩", 1, "anilist"), original_name: "Hiiro Ishibashi" }
  ]), ["이토 미쿠", "이시바시 히이로"]);
});
it("keeps Korean API names ahead of other name fields", () => {
  assert.deepEqual(recommendationCastNames([
    { ...member(1, "하나에 나츠키", 0, "anilist"), original_name: "花江夏樹" },
    { ...member(2, "수지", 1), original_name: "Bae Suzy" }
  ]), ["하나에 나츠키", "수지"]);
});
it("preserves the API name when no safe Korean reading is available", () => {
  assert.deepEqual(recommendationCastNames([
    member(1, "長瀬智也", 0, "anilist"),
    { ...member(2, "花江夏樹", 1, "anilist"), original_name: "Xyz Qw" }
  ]), ["長瀬智也", "花江夏樹"]);
});

it("uses content source for older cast responses without person source", () => {
  const cast = [{ ...member(1, "伊藤美来", 0), original_name: "Miku Itou" }];
  delete cast[0]!.source;
  assert.deepEqual(recommendationCastNames(cast, "anilist"), ["이토 미쿠"]);
  assert.deepEqual(recommendationCastNames(cast, "tmdb"), ["伊藤美来"]);
});

it("loads movie credits from movie detail and other works from TV detail", () => {
  assert.equal(recommendationCastMediaType("movie"), "movie");
  for (const type of ["anime", "kdrama", "jdrama", "other"] as const) {
    assert.equal(recommendationCastMediaType(type), "tv");
  }
});
it("labels animated movie cast as voice actors using Korean or provider genre names", () => {
  for (const genre of ["애니메이션", "Animation", "anime", " animation "]) {
    assert.equal(recommendationCastLabel("movie", ["가족", genre]), "성우");
  }
  assert.equal(recommendationCastLabel("movie", ["드라마", "다큐멘터리"]), "출연배우");
  assert.equal(recommendationCastLabel("movie", []), "출연배우");
});
