import assert from "node:assert/strict";
import { it } from "node:test";
import type { TimelinePin } from "../types/pins";
function pin(overrides: Partial<TimelinePin> = {}): TimelinePin {
    return { id: "p1", user_id: "u1", content_id: "c1", episode_id: null, content_title: "무빙", content_poster_url: null, genres: [], episode_title: null, episode_number: null, season_number: null, timestamp_seconds: null, display_time_label: null, memo: null, emotion: null, is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", tags: [], ...overrides };
}
it("T-1 episode order precedes time", async () => {
    const m = await import("./pinSort");
    const A = pin({ id: "A", episode_number: 1, timestamp_seconds: 1200 }), B = pin({ id: "B", episode_number: 5, timestamp_seconds: 180 });
    assert.deepEqual(m.sortPinsByScene([B, A]), [A, B]);
});
it("T-2 specials precede seasons", async () => {
    const m = await import("./pinSort");
    const A = pin({ season_number: 2, episode_number: 1 }), B = pin({ season_number: 1, episode_number: 12 }), C = pin({ season_number: 0, episode_number: 1 });
    assert.deepEqual(m.sortPinsByScene([A, B, C]), [C, B, A]);
});
it("T-3 time ascends within an episode", async () => {
    const m = await import("./pinSort");
    const A = pin({ episode_number: 3, timestamp_seconds: 900 }), B = pin({ episode_number: 3, timestamp_seconds: 60 }), C = pin({ episode_number: 3, timestamp_seconds: 300 });
    assert.deepEqual(m.sortPinsByScene([A, B, C]), [B, C, A]);
});
it("T-4 unspecified time is last", async () => {
    const m = await import("./pinSort");
    const A = pin({ episode_number: 3 }), B = pin({ episode_number: 3, timestamp_seconds: 60 });
    assert.deepEqual(m.sortPinsByScene([A, B]), [B, A]);
});
it("T-5 creation time breaks scene ties", async () => {
    const m = await import("./pinSort");
    const A = pin({ episode_number: 3, timestamp_seconds: 60, created_at: "2026-09-02" }), B = pin({ episode_number: 3, timestamp_seconds: 60, created_at: "2026-09-01" });
    assert.deepEqual(m.sortPinsByScene([A, B]), [B, A]);
});
it("T-6 episode-free pins precede episodes", async () => {
    const m = await import("./pinSort");
    const A = pin({ timestamp_seconds: 30 }), B = pin({ episode_number: 1, timestamp_seconds: 10 });
    assert.deepEqual(m.sortPinsByScene([B, A]), [A, B]);
});
it("T-7 latest sorts creation descending", async () => {
    const m = await import("./pinSort");
    const A = pin({ created_at: "2026-09-01" }), B = pin({ created_at: "2026-09-03" }), C = pin({ created_at: "2026-09-02" });
    assert.deepEqual(m.sortPins([A, B, C], "latest"), [B, C, A]);
});
it("T-8 timeline sorts titles then scenes", async () => {
    const m = await import("./pinSort");
    const A = pin({ content_title: "진격의 거인", episode_number: 5, timestamp_seconds: 10 }), B = pin({ episode_number: 2, timestamp_seconds: 5 }), C = pin({ episode_number: 1, timestamp_seconds: 999 });
    assert.deepEqual(m.sortPins([A, B, C], "timeline"), [C, B, A]);
});
it("T-9 sorts return copies without mutation", async () => {
    const m = await import("./pinSort");
    const A = pin({ episode_number: 2 }), B = pin({ episode_number: 1 }), input = [A, B];
    assert.notEqual(m.sortPinsByScene(input), input);
    assert.notEqual(m.sortPins(input, "timeline"), input);
    assert.deepEqual(input, [A, B]);
});
it("T-10 same-title contents stay grouped", async () => {
    const m = await import("./pinSort");
    const A = pin({ content_id: "c2", episode_number: 1 }), B = pin({ content_id: "c1", episode_number: 2 }), C = pin({ content_id: "c2", episode_number: 2 }), D = pin({ content_id: "c1", episode_number: 1 });
    assert.deepEqual(m.sortPins([A, B, C, D], "timeline"), [D, B, A, C]);
});
