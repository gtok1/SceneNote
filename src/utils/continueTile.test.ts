import assert from "node:assert/strict";
import { it } from "node:test";

import { createContinueTileModel } from "./continueTile";
import type { ContinueTileSource } from "./continueTile";

const item: ContinueTileSource = {
  title_primary: "도굴왕",
  content_type: "anime",
  episode_count: 12,
  statuses: ["watching"],
  watched_episode_count: 11,
  progress_source: "episode_progress",
  effective_watched_through: 11,
  next_episode_number: 12,
};
const airing = { availableCount: 0, upcomingLabel: null };

it("C-1: creates the full continue tile model from the base item", () => {
  assert.deepEqual(createContinueTileModel(item, airing), {
    title: "도굴왕",
    badge: null,
    progress: 11 / 12,
    caption: "11/12화",
    cta: {
      text: "12화",
      icon: "play",
      action: "open_episodes",
      accessibilityLabel: "12화 중 11화까지 시청했습니다. 다음은 12화입니다.",
    },
  });
});

it("C-2: shows the number of available new episodes", () => {
  assert.deepEqual(createContinueTileModel(item, { ...airing, availableCount: 3 }).badge,
    { tone: "new", text: "새 회차 3" });
});

it("C-3: shortens a scheduled release date", () => {
  assert.deepEqual(createContinueTileModel(item, { ...airing, upcomingLabel: "26.10.01 공개 예정" }).badge,
    { tone: "upcoming", text: "10.01 공개" });
});

it("C-4: preserves a relative upcoming label", () => {
  assert.deepEqual(createContinueTileModel(item, { ...airing, upcomingLabel: "내일" }).badge,
    { tone: "upcoming", text: "내일" });
});

it("C-5: prefers available episodes over an upcoming date", () => {
  assert.deepEqual(createContinueTileModel(item, { availableCount: 2, upcomingLabel: "26.10.01 공개 예정" }).badge,
    { tone: "new", text: "새 회차 2" });
});

it("C-6: asks for the viewing position when the progress source is none", () => {
  const model = createContinueTileModel({ ...item, progress_source: "none" }, airing);
  assert.deepEqual(model.cta, {
    text: "위치 설정", icon: "flag", action: "open_progress_setting",
    accessibilityLabel: "시청 위치가 설정되지 않았습니다. 시청 위치를 설정해 주세요.",
  });
  assert.equal(model.progress, null);
  assert.equal(model.caption, null);
});

it("C-7: starts at episode one with zero progress", () => {
  const model = createContinueTileModel({ ...item, effective_watched_through: 0, next_episode_number: 1 }, airing);
  assert.equal(model.cta?.text, "1화");
  assert.equal(model.cta?.icon, "play");
  assert.equal(model.progress, 0);
  assert.equal(model.caption, "총 12화");
});

it("C-8: shows completion when all twelve episodes have been watched", () => {
  const model = createContinueTileModel({ ...item, effective_watched_through: 12, next_episode_number: null }, airing);
  assert.equal(model.cta?.text, "다 봤어요");
  assert.equal(model.cta?.icon, "check");
  assert.equal(model.progress, 1);
  assert.equal(model.caption, "12/12화");
});

it("C-9: omits the progress fraction when the total episode count is unknown", () => {
  const model = createContinueTileModel({ ...item, episode_count: null, effective_watched_through: 5, next_episode_number: 6 }, airing);
  assert.equal(model.cta?.text, "6화");
  assert.equal(model.progress, null);
  assert.equal(model.caption, "5화까지 봄");
});

it("C-10: gives movies no episode CTA, progress, or caption", () => {
  const model = createContinueTileModel({ ...item, content_type: "movie" }, airing);
  assert.equal(model.cta, null);
  assert.equal(model.progress, null);
  assert.equal(model.caption, null);
});

it("C-11: gives wishlist items no continue CTA, progress, or caption", () => {
  const model = createContinueTileModel({ ...item, statuses: ["wishlist"] }, airing);
  assert.equal(model.cta, null);
  assert.equal(model.progress, null);
  assert.equal(model.caption, null);
});

it("C-12: clamps watched episodes beyond the total to complete", () => {
  const model = createContinueTileModel({ ...item, effective_watched_through: 15 }, airing);
  assert.equal(model.cta?.text, "다 봤어요");
  assert.equal(model.progress, 1);
  assert.equal(model.caption, "12/12화");
});

it("C-13: preserves the season title without appending another season", () => {
  assert.equal(createContinueTileModel({ ...item, title_primary: "진격의 거인 시즌 3" }, airing).title,
    "진격의 거인 시즌 3");
});

it("C-14: omits a whitespace-only upcoming label", () => {
  assert.equal(createContinueTileModel(item, { ...airing, upcomingLabel: "  " }).badge, null);
});
