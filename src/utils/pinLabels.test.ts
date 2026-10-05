import assert from "node:assert/strict";
import { it } from "node:test";
import type { TimelinePin } from "../types/pins";
function pin(overrides: Partial<TimelinePin> = {}): TimelinePin {
    return { id: "p1", user_id: "u1", content_id: "c1", episode_id: null, content_title: "무빙", content_poster_url: null, genres: [], episode_title: null, episode_number: null, season_number: null, timestamp_seconds: null, display_time_label: null, memo: null, emotion: null, is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", tags: [], ...overrides };
}
it("T-11 formats 12화", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ "season_number": null, "episode_number": 12, "episode_title": null })), "12화");
});
it("T-12 formats 12화 · 각성", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ "season_number": 1, "episode_number": 12, "episode_title": "각성" })), "12화 · 각성");
});
it("T-13 formats 시즌 2 · 3화", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ "season_number": 2, "episode_number": 3, "episode_title": null })), "시즌 2 · 3화");
});
it("T-14 formats 특별편 · 1화", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ "season_number": 0, "episode_number": 1, "episode_title": null })), "특별편 · 1화");
});
it("T-15 omits season-only labels", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin()), null);
    assert.equal(m.formatPinEpisodeLabel(pin({ season_number: 2, episode_title: "  " })), null);
});
it("T-16 formats 파일럿", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ "season_number": null, "episode_number": null, "episode_title": "파일럿" })), "파일럿");
});
it("T-16b can omit episode title", async () => {
    const m = await import("./pinLabels");
    assert.equal(m.formatPinEpisodeLabel(pin({ season_number: 2, episode_number: 3, episode_title: "각성" }), { includeTitle: false }), "시즌 2 · 3화");
});
