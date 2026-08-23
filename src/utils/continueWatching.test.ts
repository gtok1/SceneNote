import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createContinueWatchingLabel } from "./continueWatching";

const normalCases = [
  {
    name: "unset progress",
    item: { episode_count: 24, progress_source: "none", effective_watched_through: 0, next_episode_number: 1 },
    expected: { text: "시청 위치 설정", action: "open_progress_setting", accessibilityLabel: "시청 위치가 설정되지 않았습니다. 시청 위치를 설정해 주세요." },
  },
  {
    name: "explicit zero without total",
    item: { episode_count: null, progress_source: "manual", effective_watched_through: 0, next_episode_number: 1 },
    expected: { text: "1화부터 시작", action: "open_episodes", accessibilityLabel: "아직 시청한 회차가 없습니다. 1화부터 시작합니다." },
  },
  {
    name: "explicit zero with total",
    item: { episode_count: 24, progress_source: "manual", effective_watched_through: 0, next_episode_number: 1 },
    expected: { text: "1화부터 시작 · 총 24화", action: "open_episodes", accessibilityLabel: "총 24화입니다. 아직 시청한 회차가 없습니다. 1화부터 시작합니다." },
  },
  {
    name: "progress with total",
    item: { episode_count: 24, progress_source: "manual", effective_watched_through: 12, next_episode_number: 13 },
    expected: { text: "다음: 13화 · 12/24화", action: "open_episodes", accessibilityLabel: "24화 중 12화까지 시청했습니다. 다음은 13화입니다." },
  },
  {
    name: "progress without total",
    item: { episode_count: null, progress_source: "episode_progress", effective_watched_through: 12, next_episode_number: 13 },
    expected: { text: "다음: 13화", action: "open_episodes", accessibilityLabel: "12화까지 시청했습니다. 다음은 13화입니다." },
  },
  {
    name: "complete",
    item: { episode_count: 24, progress_source: "manual", effective_watched_through: 24, next_episode_number: null },
    expected: { text: "모든 화 시청", action: "open_episodes", accessibilityLabel: "총 24화를 모두 시청했습니다." },
  },
] as const;

describe("createContinueWatchingLabel", () => {
  for (const testCase of normalCases) {
    const base = {
      content_type: "anime" as const,
      statuses: ["watching" as const],
      watched_episode_count: 0,
      ...testCase.item,
    };

    it(`returns the ${testCase.name} label`, () => {
      assert.deepEqual(createContinueWatchingLabel(base), testCase.expected);
    });

    it(`hides the ${testCase.name} label when not watching`, () => {
      assert.equal(createContinueWatchingLabel({ ...base, statuses: ["wishlist"] }), null);
    });

    it(`hides the ${testCase.name} label for movies`, () => {
      assert.equal(createContinueWatchingLabel({ ...base, content_type: "movie" }), null);
    });
  }
});
