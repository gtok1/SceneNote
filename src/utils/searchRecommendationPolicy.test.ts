import assert from "node:assert/strict";
import test from "node:test";
import { EXTENDED_FEATURES_ENABLED, SEARCH_RECOMMENDATIONS_ENABLED } from "../constants/features";
import { canRunSearchRecommendations, createRecommendationRequestScope, recommendationProviderError, searchSeasonIdentity } from "./searchRecommendationPolicy";
import { getResponsiveRecommendationColumns } from "./recommendationLayout";
import { parseSearchIntent, SIMILAR_SEARCH_EXAMPLES } from "./similarSearchIntent";

const ready = { enabled: SEARCH_RECOMMENDATIONS_ENABLED, signedIn: true, focused: true, online: true, libraryReady: true, query: "", similarityMode: false };
test("REG-P0-037 / SRR-01·02: 빈 검색은 개인화, 한 글자는 추천을 요청하지 않는다 (22번 명세로 기대 변경)", () => {
  for (const query of ["", " ", "\n\t"]) assert.equal(canRunSearchRecommendations({...ready, query}), true);
  for (const query of ["한", "한자와나오키", "도깨비 같은 드라마"]) assert.equal(canRunSearchRecommendations({...ready, query}), false);
});
test("SRR-03·05·06: 제목 내부 와/과를 유사 검색으로 오인하지 않고 예시/최근 질의를 같은 parser로 해석", () => {
  for (const query of ["한자와나오키", "한자와 나오키 시즌 2", "신과 함께", "너와 나"]) assert.equal(parseSearchIntent(query).mode, "keyword");
  for (const query of [...SIMILAR_SEARCH_EXAMPLES, "도깨비 같은 드라마", "한자와 나오키 시즌 2 같은 작품"]) assert.equal(parseSearchIntent(query).mode, "similarity");
  const comparison = parseSearchIntent("도깨비와 같은 드라마");
  assert.equal(comparison.mode === "similarity" && comparison.anchorText, "도깨비");
  const season = parseSearchIntent("한자와 나오키 시즌 2 같은 작품");
  assert.equal(season.mode === "similarity" && season.anchorText, "한자와 나오키 시즌 2");
});
test("SRR-16·17: 인증/라이브러리/연결/화면/모드가 비활성이면 개인화 부수효과도 중단", () => {
  for (const key of ["signedIn", "focused", "online", "libraryReady", "enabled"] as const) assert.equal(canRunSearchRecommendations({...ready,[key]: false}), false);
  assert.equal(canRunSearchRecommendations({...ready,similarityMode:true}), false);
});
test("SRR-17: 이전 활성화의 요청 취소와 다음 계정의 독립 수명", async () => {
  const old = createRecommendationRequestScope();
  const request = old.controller();
  let lateWrites = 0;
  const lateResponse = Promise.resolve().then(() => { if(old.isActive()) lateWrites++; });
  old.close();
  const next = createRecommendationRequestScope();
  await lateResponse;
  assert.equal(request.signal.aborted,true);
  assert.equal(old.controller().signal.aborted,true);
  assert.equal(lateWrites,0);
  assert.equal(next.controller().signal.aborted,false);
  assert.equal(next.isActive(),true);
  next.close();
});
test("SRR-13·15: 공급자 전체 실패와 실제 0건/부분 결과를 구분", () => {
  assert.match(recommendationProviderError(true,0) ?? "", /연결하지 못/);
  assert.equal(recommendationProviderError(false,0),null);
  assert.equal(recommendationProviderError(true,7),null);
});
test("SRR-18: 스마트폰 기본 열 수와 큰 글자 열 축소", () => {
  assert.deepEqual([320,360,390,430].map(width => getResponsiveRecommendationColumns(width)),[1,2,2,2]);
  for(const width of [320,360,390,430]) assert.equal(getResponsiveRecommendationColumns(width,1.5),1);
});
test("SRR-22: 검색 추천만 활성화하고 확장 기능을 켜지 않는다", () => {
  assert.equal(SEARCH_RECOMMENDATIONS_ENABLED,true);
  assert.equal(EXTENDED_FEATURES_ENABLED,false);
});

test("SRR-04·21: 동일 TMDB 작품의 전체/시즌 1/시즌 2 키는 독립적", () => {
  const work = {external_source: "tmdb", external_id: "55925"};
  assert.equal(new Set([searchSeasonIdentity(work), searchSeasonIdentity({...work,season_number:1}), searchSeasonIdentity({...work,season_number:2})]).size,3);
  assert.equal(searchSeasonIdentity({...work,season_number:2}), "tmdb:55925:2");
});
