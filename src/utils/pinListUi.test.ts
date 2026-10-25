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
    assert.deepEqual(m.createPinCardModel(richPin(), { spoilerRevealed: false, now: NOW }), { title: "무빙", episodeLabel: "7화 · 감정선", relativeDateLabel: "10월 2일", dateLabel: "2026. 10. 02", timeLabel: "42:10", emotionLabel: "감동", memo: "감정선 최고", memoHidden: false, memoEmpty: false, tags: ["#눈물"], allTags: ["#눈물"], extraTagCount: 0, posterUrl: "https://image.tmdb.org/t/p/w342/a.jpg", accessibilityLabel: "무빙, 7화 · 감정선, 42:10, 감동, 감정선 최고, 저장일 2026. 10. 02" });
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
    const model = m.createPinCardModel(pin({ content_title: null, emotion: "none", memo: "   " }), { spoilerRevealed: false, now: NOW });
    assert.deepEqual(model, { title: "제목 없음", episodeLabel: null, relativeDateLabel: "10월 2일", dateLabel: "2026. 10. 02", timeLabel: "시간 미지정", emotionLabel: null, memo: "메모 없음", memoHidden: false, memoEmpty: true, tags: [], allTags: [], extraTagCount: 0, posterUrl: null, accessibilityLabel: "제목 없음, 시간 미지정, 저장일 2026. 10. 02" });
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
    assert.equal(model.episodeLabel, "7화 · 감정선");
    assert.equal(model.relativeDateLabel, "");
    assert.equal(model.dateLabel, "");
    assert.ok(!model.accessibilityLabel.includes("저장일"));
});
it("P-C8 card supports season metadata", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.createPinCardModel(pin({ season_number: 2, episode_number: 3 }), { spoilerRevealed: false }).episodeLabel, "시즌 2 · 3화");
});
it("P-K1 constants match specification", async () => {
    const m = await import("./pinListUi");
    assert.equal(m.PIN_DETAIL_PANEL_WIDTH, 360);
    assert.equal(m.PIN_CARD_TAG_LIMIT, 3);
    assert.deepEqual(m.PIN_SORT_OPTIONS, [{ label: "최신순", value: "latest" }, { label: "작품별", value: "timeline" }]);
    assert.deepEqual(m.PINS_SCREEN_COPY, expectedCopy);
});

const NOW = new Date(2026, 9, 15, 12, 0, 0);

it("R-D1 uses today for the same local calendar day", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 15, 0, 5).toISOString(), NOW), "오늘");
});

it("R-D2 uses yesterday across midnight", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 14, 23, 50).toISOString(), NOW), "어제");
});

it("R-D3 uses two days ago", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 13, 12).toISOString(), NOW), "2일 전");
});

it("R-D4 uses six days ago", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 9, 12).toISOString(), NOW), "6일 전");
});

it("R-D5 uses month and day after a week", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 8, 12).toISOString(), NOW), "10월 8일");
});

it("R-D6 omits leading zeros within the same year", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 0, 3, 12).toISOString(), NOW), "1월 3일");
});

it("R-D7 uses absolute date in another year", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2025, 11, 31, 12).toISOString(), NOW), "2025. 12. 31");
});

it("R-D8 treats a future date as today", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date(2026, 9, 16, 9).toISOString(), NOW), "오늘");
});

it("R-D9 omits invalid and empty dates", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate("not-a-date", NOW), "");
  assert.equal(formatPinRelativeDate("", NOW), "");
});
it("R-D10 defaults now to the current day", async () => {
  const { formatPinRelativeDate } = await import("./pinListUi");
  assert.equal(formatPinRelativeDate(new Date().toISOString()), "오늘");
});
it("P-C9 adds relative date while preserving absolute accessibility date and removing subtitle", async () => {
  const { createPinCardModel } = await import("./pinListUi");
  const model = createPinCardModel(pin({ created_at: new Date(2026, 9, 14, 20).toISOString() }), { spoilerRevealed: false, now: NOW });
  assert.equal(model.relativeDateLabel, "어제");
  assert.equal(model.dateLabel, "2026. 10. 14");
  assert.ok(model.accessibilityLabel.includes("저장일 2026. 10. 14"));
  assert.equal("subtitle" in model, false);
});

function groupPins() {
  const A = pin({ id: "a", content_id: "c1", content_poster_url: " https://x/p.jpg " });
  const B = pin({ id: "b", content_id: "c1" });
  const C = pin({ id: "c", content_id: "c2", content_title: null });
  return { A, B, C };
}
it("G-1 builds ungrouped latest rows without copying pins or mutating input", async () => {
  const { buildPinListRows } = await import("./pinListUi");
  const { A, B, C } = groupPins();
  const input = [A, B, C];
  const rows = buildPinListRows(input, "latest");
  assert.deepEqual(rows, [
    { type: "pin", key: "pin:a", pin: A, grouped: false },
    { type: "pin", key: "pin:b", pin: B, grouped: false },
    { type: "pin", key: "pin:c", pin: C, grouped: false }
  ]);
  assert.notEqual(rows, input);
  rows.forEach((row, index) => {
    assert.equal(row.type, "pin");
    if (row.type === "pin") assert.equal(row.pin, input[index]);
  });
  assert.deepEqual(input, [A, B, C]);
});
it("G-2 builds content headers with counts and grouped pin rows", async () => {
  const { buildPinListRows } = await import("./pinListUi");
  const { A, B, C } = groupPins();
  assert.deepEqual(buildPinListRows([A, B, C], "timeline"), [
    { type: "group", key: "group:c1", contentId: "c1", title: "무빙", posterUrl: "https://x/p.jpg", count: 2, countLabel: "핀 2개", accessibilityLabel: "무빙, 핀 2개" },
    { type: "pin", key: "pin:a", pin: A, grouped: true },
    { type: "pin", key: "pin:b", pin: B, grouped: true },
    { type: "group", key: "group:c2", contentId: "c2", title: "제목 없음", posterUrl: null, count: 1, countLabel: "핀 1개", accessibilityLabel: "제목 없음, 핀 1개" },
    { type: "pin", key: "pin:c", pin: C, grouped: true }
  ]);
});
it("G-3 groups separated pins once with stable unique keys", async () => {
  const { buildPinListRows } = await import("./pinListUi");
  const { A, B, C } = groupPins();
  const keys = buildPinListRows([A, C, B], "timeline").map(row => row.key);
  assert.deepEqual(keys, ["group:c1", "pin:a", "pin:b", "group:c2", "pin:c"]);
  assert.equal(new Set(keys).size, keys.length);
});
it("G-4 returns empty rows in both modes", async () => {
  const { buildPinListRows } = await import("./pinListUi");
  assert.deepEqual(buildPinListRows([], "latest"), []);
  assert.deepEqual(buildPinListRows([], "timeline"), []);
});
it("G-5 finds pin indexes without confusing content headers", async () => {
  const { buildPinListRows, findPinRowIndex } = await import("./pinListUi");
  const { A, B, C } = groupPins();
  const rows = buildPinListRows([A, B, C], "timeline");
  assert.equal(findPinRowIndex(rows, "b"), 2);
  assert.equal(findPinRowIndex(rows, "c"), 4);
  assert.equal(findPinRowIndex(rows, "zzz"), -1);
  assert.equal(findPinRowIndex(rows, "c1"), -1);
});

function timelinePins() {
  const p1 = pin({ id: "p1", episode_number: 3, timestamp_seconds: 60, memo: "셋" });
  const p2 = pin({ id: "p2", episode_number: 1, timestamp_seconds: 20, memo: "하나" });
  const p3 = pin({ id: "p3", episode_number: 2 });
  const x = pin({ id: "x", content_id: "c2", episode_number: 1 });
  return { p1, p2, p3, x };
}
function timelineInput() {
  const { p1, p2, p3, x } = timelinePins();
  return { pins: [p1, x, p2, p3], selectedId: "p2", mode: "latest" as const, filtered: false, revealedIds: new Set<string>() };
}
const expectedTimeline = {
  title: "이 작품의 핀 3개", total: 3,
  items: [
    { id: "p2", label: "1화 · 00:20", memo: "하나", memoHidden: false, memoEmpty: false, current: true, accessibilityLabel: "1화 · 00:20, 하나, 지금 보는 핀" },
    { id: "p3", label: "2화 · 시간 미지정", memo: "메모 없음", memoHidden: false, memoEmpty: true, current: false, accessibilityLabel: "2화 · 시간 미지정" },
    { id: "p1", label: "3화 · 01:00", memo: "셋", memoHidden: false, memoEmpty: false, current: false, accessibilityLabel: "3화 · 01:00, 셋" }
  ]
};
it("TL-1 builds scene-ordered same-content timeline without mutating input", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const input = timelineInput();
  const original = [...input.pins];
  assert.deepEqual(createPinPanelTimeline(input), expectedTimeline);
  assert.deepEqual(input.pins, original);
});
it("TL-2 hides the timeline for a single matching content pin", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const { p1, x } = timelinePins();
  assert.equal(createPinPanelTimeline({ ...timelineInput(), pins: [p1, x], selectedId: "p1" }), null);
});
it("TL-3 hides the timeline in grouped mode", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  assert.equal(createPinPanelTimeline({ ...timelineInput(), mode: "timeline" }), null);
});
it("TL-4 labels timelines built from filtered pins", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  assert.deepEqual(createPinPanelTimeline({ ...timelineInput(), filtered: true }), { ...expectedTimeline, title: "조건에 맞는 핀 3개" });
});
function numberedPins(count: number) {
  return Array.from({ length: count }, (_, index) => pin({ id: `e${index + 1}`, episode_number: index + 1, timestamp_seconds: 0 }));
}
it("TL-5 centers five-row windows and clamps both ends", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const pins = numberedPins(9).reverse();
  for (const [selectedId, expected] of [
    ["e1", ["e1", "e2", "e3", "e4", "e5"]],
    ["e5", ["e3", "e4", "e5", "e6", "e7"]],
    ["e9", ["e5", "e6", "e7", "e8", "e9"]]
  ] as const) {
    const result = createPinPanelTimeline({ ...timelineInput(), pins, selectedId });
    assert.equal(result?.total, 9);
    assert.deepEqual(result?.items.map(item => item.id), expected);
  }
});
it("TL-6 masks spoilers in timeline text and accessibility until revealed", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const { p1, p2, p3 } = timelinePins();
  const input = { ...timelineInput(), pins: [p1, { ...p2, is_spoiler: true }, p3], selectedId: "p1" };
  const hidden = createPinPanelTimeline(input)?.items.find(item => item.id === "p2");
  assert.equal(hidden?.memo, "스포일러가 포함된 메모예요");
  assert.equal(hidden?.memoHidden, true);
  assert.equal(hidden?.accessibilityLabel, "1화 · 00:20, 스포일러 메모 숨김");
  const shown = createPinPanelTimeline({ ...input, revealedIds: new Set(["p2"]) })?.items.find(item => item.id === "p2");
  assert.equal(shown?.memo, "하나");
  assert.equal(shown?.memoHidden, false);
});
it("TL-7 returns null for a missing selected pin", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  assert.equal(createPinPanelTimeline({ ...timelineInput(), selectedId: "nope" }), null);
});
it("TL-8 labels movie scenes with time only and preserves empty memo semantics", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const m1 = pin({ id: "m1", timestamp_seconds: 3725 });
  const m2 = pin({ id: "m2", timestamp_seconds: 600 });
  assert.deepEqual(createPinPanelTimeline({ ...timelineInput(), pins: [m1, m2], selectedId: "m1" })?.items, [
    { id: "m2", label: "10:00", memo: "메모 없음", memoHidden: false, memoEmpty: true, current: false, accessibilityLabel: "10:00" },
    { id: "m1", label: "1:02:05", memo: "메모 없음", memoHidden: false, memoEmpty: true, current: true, accessibilityLabel: "1:02:05, 지금 보는 핀" }
  ]);
});
it("TL-9 orders scenes by season before episode", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  const s1 = pin({ id: "s1", season_number: 1, episode_number: 12, timestamp_seconds: 100 });
  const s2 = pin({ id: "s2", season_number: 2, episode_number: 3, timestamp_seconds: 50 });
  const result = createPinPanelTimeline({ ...timelineInput(), pins: [s2, s1], selectedId: "s2" });
  assert.deepEqual(result?.items.map(item => item.label), ["12화 · 01:40", "시즌 2 · 3화 · 00:50"]);
});
it("TL-10 honors a custom three-row window", async () => {
  const { createPinPanelTimeline } = await import("./pinListUi");
  for (const [selectedId, expected] of [["e3", ["e2", "e3", "e4"]], ["e1", ["e1", "e2", "e3"]]] as const) {
    const result = createPinPanelTimeline({ ...timelineInput(), pins: numberedPins(5), selectedId, limit: 3 });
    assert.deepEqual(result?.items.map(item => item.id), expected);
  }
});
it("AD-1 labels adding a pin to an episode or content", async () => {
  const { getPinAddAccessibilityLabel } = await import("./pinListUi");
  assert.equal(getPinAddAccessibilityLabel({ episode_id: "e1" }), "이 회차에 핀 추가");
  assert.equal(getPinAddAccessibilityLabel({ episode_id: null }), "이 작품에 핀 추가");
});
it("K-2 preserves context constants and exact copy", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.PIN_PANEL_TIMELINE_LIMIT, 5);
  assert.equal(m.PIN_GROUP_POSTER_WIDTH, 40);
  assert.deepEqual(m.PIN_CONTEXT_COPY, {
    today: "오늘", yesterday: "어제", currentPin: "지금 보는 핀", showAllPins: "모두 보기",
    showAllPinsLabel: "이 작품의 핀 모두 보기", openContent: "작품 보기", addPin: "핀 추가",
    addPinToEpisode: "이 회차에 핀 추가", addPinToContent: "이 작품에 핀 추가",
    timelineSelectHint: "이 핀을 미리보기로 보여 줘요", groupHint: "작품 상세를 열어요"
  });
});
it("GL-1 gallery uses two columns at 375", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(375), 2);
});
it("GL-2 gallery uses two columns at 699", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(699), 2);
});
it("GL-3 gallery uses four columns at 700", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(700), 4);
});
it("GL-4 gallery uses four columns at 959", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(959), 4);
});
it("GL-5 gallery uses five columns at 960", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(960), 5);
});
it("GL-6 gallery uses five columns at 1279", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(1279), 5);
});
it("GL-7 gallery uses six columns at 1280", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(1280), 6);
});
it("GL-8 gallery uses six columns at 2000", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinGalleryColumns(2000), 6);
});
it("GL-9 invalid gallery widths use the mobile default", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual([m.getPinGalleryColumns(NaN), m.getPinGalleryColumns(0), m.getPinGalleryColumns(-10)], [2, 2, 2]);
});
it("GL-10 larger font scale reduces gallery columns", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual([m.getPinGalleryColumns(1280, 1.3), m.getPinGalleryColumns(960, 1.3), m.getPinGalleryColumns(700, 1.3)], [5, 4, 2]);
});
it("GL-11 small or invalid font scale never adds gallery columns", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual([m.getPinGalleryColumns(1440, 0.85), m.getPinGalleryColumns(1440, NaN)], [6, 6]);
});
it("VP-1 gallery at 1440 opens cards without a panel", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual(m.getPinViewPresentation({ viewMode: "gallery", width: 1440 }), { gallery: true, showDetailPanel: false, pressAction: "open", numColumns: 6 });
});
it("VP-2 list at 1440 keeps the selection panel", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual(m.getPinViewPresentation({ viewMode: "list", width: 1440 }), { gallery: false, showDetailPanel: true, pressAction: "select", numColumns: 1 });
});
it("VP-3 list at 768 opens cards without a panel", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual(m.getPinViewPresentation({ viewMode: "list", width: 768 }), { gallery: false, showDetailPanel: false, pressAction: "open", numColumns: 1 });
});
it("VP-4 gallery at 375 uses two columns", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual(m.getPinViewPresentation({ viewMode: "gallery", width: 375, fontScale: 1 }), { gallery: true, showDetailPanel: false, pressAction: "open", numColumns: 2 });
});
it("VP-5 gallery font scale reduces presentation columns", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.getPinViewPresentation({ viewMode: "gallery", width: 1280, fontScale: 1.3 }).numColumns, 5);
});
function galleryPin() {
  return pin({ content_title: "원피스", season_number: 3, episode_number: 86, episode_title: "히루루크의 벚꽃과 이어지는 의지!", timestamp_seconds: 959, emotion: "sad", memo: "  벚꽃  ", content_poster_url: "https://p/op.jpg", created_at: new Date(2026, 4, 3, 12).toISOString() });
}
it("GC-1 gallery card model uses a short scene label and list accessibility", async () => {
  const m = await import("./pinListUi");
  assert.deepEqual(m.createPinGalleryCardModel(galleryPin(), { spoilerRevealed: false, now: NOW }), {
    title: "원피스", sceneLabel: "시즌 3 · 86화", timeLabel: "15:59", emotionLabel: "슬픔", memo: "벚꽃",
    memoHidden: false, memoEmpty: false, relativeDateLabel: "5월 3일", posterUrl: "https://p/op.jpg",
    accessibilityLabel: "원피스, 시즌 3 · 86화 · 히루루크의 벚꽃과 이어지는 의지!, 15:59, 슬픔, 벚꽃, 저장일 2026. 05. 03"
  });
});
it("GC-2 gallery card masks hidden spoilers", async () => {
  const m = await import("./pinListUi");
  const model = m.createPinGalleryCardModel({ ...galleryPin(), is_spoiler: true, memo: "  루피의 결심  " }, { spoilerRevealed: false, now: NOW });
  assert.equal(model.memo, "스포일러가 포함된 메모예요");
  assert.equal(model.memoHidden, true);
  assert.ok(model.accessibilityLabel.includes("스포일러 메모 숨김"));
  assert.ok(!model.accessibilityLabel.includes("루피의 결심"));
});
it("GC-3 gallery card keeps an empty scene label for movies", async () => {
  const m = await import("./pinListUi");
  const model = m.createPinGalleryCardModel(pin({ timestamp_seconds: 600 }), { spoilerRevealed: false, now: NOW });
  assert.equal(model.sceneLabel, "");
  assert.equal(model.timeLabel, "10:00");
});
it("GC-4 gallery card has safe fallbacks", async () => {
  const m = await import("./pinListUi");
  const model = m.createPinGalleryCardModel(pin({ content_title: "  ", emotion: "none", memo: null }), { spoilerRevealed: false, now: NOW });
  assert.equal(model.title, "제목 없음");
  assert.equal(model.emotionLabel, null);
  assert.equal(model.memo, "메모 없음");
  assert.equal(model.memoEmpty, true);
  assert.equal(model.posterUrl, null);
});
it("SP-1 group headers span the whole gallery row", async () => {
  const m = await import("./pinListUi");
  const rows = m.buildPinListRows([pin({ id: "a" })], "timeline");
  assert.deepEqual([m.getPinGalleryRowSpan(rows[0]!, 5), m.getPinGalleryRowSpan(rows[1]!, 5), m.getPinGalleryRowSpan(rows[0]!, 0)], [5, 1, 1]);
});
it("K-3 gallery constants match specification", async () => {
  const m = await import("./pinListUi");
  assert.equal(m.PIN_GALLERY_MEMO_LINES, 2);
  assert.equal(m.PIN_SCENE_MEMO_LINES, 4);
  assert.deepEqual(m.PIN_VIEW_COPY, { toggleLabel: "보기 방식", loading: "핀을 불러오는 중이에요" });
  assert.deepEqual(m.PIN_VIEW_OPTIONS, [
    { value: "gallery", label: "갤러리 보기", icon: "grid-outline" },
    { value: "list", label: "목록 보기", icon: "list-outline" }
  ]);
});
