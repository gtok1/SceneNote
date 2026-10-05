import assert from "node:assert/strict";
import { it } from "node:test";
import type { TimelinePin } from "../types/pins";
function pin(overrides: Partial<TimelinePin> = {}): TimelinePin {
    return { id: "p1", user_id: "u1", content_id: "c1", episode_id: null, content_title: "무빙", content_poster_url: null, genres: [], episode_title: null, episode_number: null, season_number: null, timestamp_seconds: null, display_time_label: null, memo: null, emotion: null, is_spoiler: false, created_at: "2026-10-02T12:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z", tags: [], ...overrides };
}
const filters = { query: "", emotion: "all", genre: "all" } as const;
function tag(name: string) { return { id: name, user_id: "u1", name, created_at: "2026-10-02T12:00:00.000Z" }; }
function option(value: string, label: string, count: number) { return { value, label, count, text: label + " " + count, accessibilityLabel: label + " " + count + "개" }; }
function richPin() { return pin({ episode_number: 7, episode_title: "감정선", timestamp_seconds: 2530, emotion: "moved", memo: "  감정선 최고  ", tags: [tag("눈물")], content_poster_url: "https://image.tmdb.org/t/p/w342/a.jpg" }); }
const expectedCopy = {
    title: "핀",
    subtitle: "감동적인 장면과 기억하고 싶은 대사를 모아보세요.",
    searchLabel: "핀 검색",
    searchPlaceholder: "작품명, 메모, 태그 검색",
    clearSearch: "검색어 지우기",
    sortLabel: "핀 정렬",
    filterButton: "필터",
    filterPanelTitle: "필터",
    filterPanelReset: "초기화",
    genreGroup: "장르",
    tagGroup: "태그",
    noTags: "아직 태그가 없어요. 핀을 남길 때 태그를 붙여 보세요.",
    emotionGroupLabel: "감정 필터",
    allOption: "전체",
    showAll: "전체 보기",
    partialError: "최신 핀을 불러오지 못해 저장된 기록을 보여 드려요.",
    retry: "다시 시도",
    emptyTitle: "아직 저장된 핀이 없어요",
    emptyDescription: "작품 상세에서 기억하고 싶은 장면을 핀으로 남겨 보세요.",
    emptyAction: "라이브러리 보기",
    noResultTitle: "조건에 맞는 핀이 없어요",
    noResultDescription: "검색어나 필터를 바꿔 보세요.",
    spoilerMasked: "스포일러가 포함된 메모예요",
    spoilerReveal: "스포일러 포함 · 보기",
    emptyMemo: "메모 없음",
    untitled: "제목 없음",
    noTime: "시간 미지정",
    memoSection: "메모",
    tagSection: "태그",
    savedAtPrefix: "저장일",
    openDetail: "핀 상세 열기",
    share: "공유",
    previewTitle: "핀 미리보기",
    previewDescription: "목록에서 핀을 고르면 여기에서 바로 볼 수 있어요.",
    selectHint: "오른쪽에 핀 내용을 보여 줘요",
    openHint: "핀 상세를 열어요"
};
it("T-39 opens without a panel", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.getPinCardPressAction(false), "open");
});
it("T-40 selects with a panel", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.getPinCardPressAction(true), "select");
});
it("P-L1 layout at 375", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(375), { "gutter": 16, "contentWidth": 343, "gap": 12, "showDetailPanel": false, "detailPanelWidth": 360, "stackTools": true, "posterWidth": 56, "cardPadding": 12 });
});
it("P-L2 layout at 599", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(599), { "gutter": 16, "contentWidth": 567, "gap": 12, "showDetailPanel": false, "detailPanelWidth": 360, "stackTools": true, "posterWidth": 56, "cardPadding": 12 });
});
it("P-L3 layout at 600", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(600), { "gutter": 24, "contentWidth": 552, "gap": 16, "showDetailPanel": false, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L4 layout at 768", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(768), { "gutter": 24, "contentWidth": 720, "gap": 16, "showDetailPanel": false, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L5 layout at 959", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(959), { "gutter": 24, "contentWidth": 911, "gap": 16, "showDetailPanel": false, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L6 layout at 960", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(960), { "gutter": 24, "contentWidth": 912, "gap": 16, "showDetailPanel": true, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L7 layout at 1440", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(1440), { "gutter": 24, "contentWidth": 1152, "gap": 16, "showDetailPanel": true, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L8 layout at 2000", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinsLayout(2000), { "gutter": 24, "contentWidth": 1152, "gap": 16, "showDetailPanel": true, "detailPanelWidth": 360, "stackTools": false, "posterWidth": 64, "cardPadding": 16 });
});
it("P-L9 invalid widths use mobile default", async () => {
    const m = await import("./pinListUi");
    for (const w of [NaN, 0, -10])
        assert.deepEqual(m.getPinsLayout(w), m.getPinsLayout(375));
});
it("P-D1 dates are explicit and reject invalid values", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.formatPinDate("2026-10-02T12:00:00.000Z"), "2026. 10. 02");
    assert.equal(m.formatPinDate(""), "");
    assert.equal(m.formatPinDate("not-a-date"), "");
});
it("P-T1 time prefers display label then formatted seconds", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual([m.getPinTimeLabel(pin({ display_time_label: "OP 직후", timestamp_seconds: 100 })), m.getPinTimeLabel(pin({ timestamp_seconds: 2530 })), m.getPinTimeLabel(pin({ timestamp_seconds: 3725 })), m.getPinTimeLabel(pin())], ["OP 직후", "42:10", "1:02:05", "시간 미지정"]);
});
it("P-F1 search trims and ignores case", async () => {
    const m = await import("./pinListUi");
    const A = pin({ content_title: "Moving" }), B = pin();
    assert.deepEqual(m.filterPins([A, B], { ...filters, query: "  MOVING " }), [A]);
});
it("P-F2 search matches formatted time", async () => {
    const m = await import("./pinListUi");
    const A = pin({ timestamp_seconds: 2530 }), B = pin({ timestamp_seconds: 60 });
    assert.deepEqual(m.filterPins([A, B], { ...filters, query: "42:10" }), [A]);
});
it("P-F3 search matches episode tags emotion and translated genres", async () => {
    const m = await import("./pinListUi");
    const A = pin({ episode_number: 7 }), B = pin({ tags: [tag("눈물")] }), C = pin({ emotion: "moved" }), D = pin({ genres: ["Drama"] }), E = pin();
    for (const [q, p] of [["7화", A], ["눈물", B], ["감동", C], ["드라마", D]] as const)
        assert.deepEqual(m.filterPins([A, B, C, D, E], { ...filters, query: q }), [p]);
});
it("P-F4 filters combine and return a fresh array", async () => {
    const m = await import("./pinListUi");
    const A = pin({ emotion: "sad", genres: ["드라마"] }), B = pin({ emotion: "sad", genres: ["액션"] }), C = pin({ emotion: "moved", genres: ["드라마"] }), input = [A, B, C];
    assert.deepEqual(m.filterPins(input, { query: "", emotion: "sad", genre: "드라마" }), [A]);
    const all = m.filterPins(input, filters);
    assert.deepEqual(all, input);
    assert.notEqual(all, input);
});
it("P-F5 whitespace query preserves all pins", async () => {
    const m = await import("./pinListUi");
    const input = [pin(), pin(), pin()];
    assert.deepEqual(m.filterPins(input, { ...filters, query: "   " }), input);
});
it("P-E1 emotion counts omit none", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createEmotionFilterOptions(["moved", "moved", "sad", null, "none"].map(emotion => pin({ emotion: emotion as TimelinePin["emotion"] })), "all"), [option("all", "전체", 5), option("moved", "감동", 2), option("sad", "슬픔", 1)]);
});
it("P-E2 emotion ties follow defined order", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createEmotionFilterOptions([pin({ emotion: "sad" }), pin({ emotion: "excited" })], "all"), [option("all", "전체", 2), option("excited", "설렘", 1), option("sad", "슬픔", 1)]);
});
it("P-E3 zero-count selected emotion stays last", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createEmotionFilterOptions([pin({ emotion: "moved" })], "love"), [option("all", "전체", 1), option("moved", "감동", 1), option("love", "사랑", 0)]);
});
it("P-E4 empty emotions keep all zero", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createEmotionFilterOptions([], "all"), [option("all", "전체", 0)]);
});
it("P-G1 genres exclude defaults and retain all", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createPinGenreOptions([pin({ genres: ["드라마", "로맨스"] }), pin({ genres: ["드라마"] }), pin({ genres: undefined })], "all"), ["드라마", "로맨스"]);
});
it("P-G2 genres exclude defaults and retain 스릴러", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createPinGenreOptions([pin({ genres: ["드라마", "로맨스"] }), pin({ genres: ["드라마"] }), pin({ genres: undefined })], "스릴러"), ["드라마", "로맨스", "스릴러"]);
});
it("P-G3 empty pins have no genres", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createPinGenreOptions([], "all"), []);
});
it("P-A1 filter count P-A1", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinFilterSummary({ ...filters, tagId: null, ...{ "query": "  " } }), { "panelCount": 0, "hasActive": false, "buttonLabel": "필터", "buttonAccessibilityLabel": "필터" });
});
it("P-A2 filter count P-A2", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinFilterSummary({ ...filters, tagId: null, ...{ "query": "무빙" } }), { "panelCount": 0, "hasActive": true, "buttonLabel": "필터", "buttonAccessibilityLabel": "필터" });
});
it("P-A3 filter count P-A3", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinFilterSummary({ ...filters, tagId: null, ...{ "emotion": "sad" } }), { "panelCount": 0, "hasActive": true, "buttonLabel": "필터", "buttonAccessibilityLabel": "필터" });
});
it("P-A4 filter count P-A4", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinFilterSummary({ ...filters, genre: "드라마", tagId: "t1" }), { "panelCount": 2, "hasActive": true, "buttonLabel": "필터 2", "buttonAccessibilityLabel": "필터, 2개 적용됨" });
});
it("P-A5 filter count P-A5", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.getPinFilterSummary({ ...filters, tagId: "t1" }), { "panelCount": 1, "hasActive": true, "buttonLabel": "필터 1", "buttonAccessibilityLabel": "필터, 1개 적용됨" });
});
it("P-R1 result summary P-R1", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.pinResultSummary({ "shown": 4, "total": 4, "filtered": false }), "핀 4개");
});
it("P-R2 result summary P-R2", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.pinResultSummary({ "shown": 1, "total": 4, "filtered": true }), "4개 중 1개");
});
it("P-R3 result summary P-R3", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.pinResultSummary({ "shown": 1200, "total": 1234, "filtered": true }), "1,234개 중 1,200개");
});
it("P-R4 result summary P-R4", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.pinResultSummary({ "shown": 0, "total": 4, "filtered": true }), "4개 중 0개");
    assert.equal(m.pinResultSummary({ shown: 3, total: 0, filtered: true }), "3개 중 3개");
});
it("P-R5 result summary P-R5", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.pinResultSummary({ "shown": 0, "total": 0, "filtered": false }), "핀 0개");
});
it("P-C1 card model includes all fields", async () => {
    const m = await import("./pinListUi");
    assert.deepEqual(m.createPinCardModel(richPin(), { spoilerRevealed: false }), { title: "무빙", episodeLabel: "7화 · 감정선", subtitle: "7화 · 감정선 · 2026. 10. 02", dateLabel: "2026. 10. 02", timeLabel: "42:10", emotionLabel: "감동", memo: "감정선 최고", memoHidden: false, memoEmpty: false, tags: ["#눈물"], allTags: ["#눈물"], extraTagCount: 0, posterUrl: "https://image.tmdb.org/t/p/w342/a.jpg", accessibilityLabel: "무빙, 7화 · 감정선, 42:10, 감동, 감정선 최고, 저장일 2026. 10. 02" });
});
it("P-C2 hidden spoilers conceal accessible memo", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel({ ...richPin(), is_spoiler: true }, { spoilerRevealed: false });
    assert.equal(model.memo, "스포일러가 포함된 메모예요");
    assert.equal(model.memoHidden, true);
    assert.ok(model.accessibilityLabel.includes("스포일러 메모 숨김"));
    assert.ok(!model.accessibilityLabel.includes("감정선 최고"));
});
it("P-C3 revealed spoilers show memo", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel({ ...richPin(), is_spoiler: true }, { spoilerRevealed: true });
    assert.equal(model.memo, "감정선 최고");
    assert.equal(model.memoHidden, false);
});
it("P-C4 empty card has safe fallbacks", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel(pin({ content_title: null, emotion: "none", memo: "   " }), { spoilerRevealed: false });
    assert.deepEqual(model, { title: "제목 없음", episodeLabel: null, subtitle: "2026. 10. 02", dateLabel: "2026. 10. 02", timeLabel: "시간 미지정", emotionLabel: null, memo: "메모 없음", memoHidden: false, memoEmpty: true, tags: [], allTags: [], extraTagCount: 0, posterUrl: null, accessibilityLabel: "제목 없음, 시간 미지정, 저장일 2026. 10. 02" });
});
it("P-C4b empty spoiler memo is not masked", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel(pin({ is_spoiler: true }), { spoilerRevealed: false });
    assert.equal(model.memoHidden, false);
    assert.equal(model.memoEmpty, true);
    assert.equal(model.memo, "메모 없음");
});
it("P-C5 card limits tags and panel retains all", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel(pin({ tags: ["a", "b", "c", "d", "e"].map(tag) }), { spoilerRevealed: false });
    assert.deepEqual(model.tags, ["#a", "#b", "#c"]);
    assert.deepEqual(model.allTags, ["#a", "#b", "#c", "#d", "#e"]);
    assert.equal(model.extraTagCount, 2);
});
it("P-C6 blank poster URL becomes null", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.createPinCardModel(pin({ content_poster_url: "  " }), { spoilerRevealed: false }).posterUrl, null);
});
it("P-C7 invalid date is omitted everywhere", async () => {
    const m = await import("./pinListUi");
    const model = m.createPinCardModel(pin({ episode_number: 7, episode_title: "감정선", created_at: "not-a-date" }), { spoilerRevealed: false });
    assert.equal(model.subtitle, "7화 · 감정선");
    assert.equal(model.dateLabel, "");
    assert.ok(!model.accessibilityLabel.includes("저장일"));
});
it("P-C8 card supports season metadata", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.createPinCardModel(pin({ season_number: 2, episode_number: 3 }), { spoilerRevealed: false }).subtitle, "시즌 2 · 3화 · 2026. 10. 02");
});
it("P-K1 constants match specification", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.PIN_DETAIL_PANEL_WIDTH, 360);
    assert.equal(m.PIN_CARD_TAG_LIMIT, 3);
    assert.deepEqual(m.PIN_SORT_OPTIONS, [{ label: "최신순", value: "latest" }, { label: "작품별", value: "timeline" }]);
    assert.deepEqual(m.PINS_SCREEN_COPY, expectedCopy);
});
