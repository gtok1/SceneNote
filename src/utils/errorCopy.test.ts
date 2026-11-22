import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ERROR_COPY } from "./errorCopy";
import { userFacingErrorMessage } from "./profileDashboard";

describe("screen error copy", () => {
  it("T-15 matches all specified keys and their exact Korean messages", () => {
    assert.equal(Object.keys(ERROR_COPY).length, 21);
    assert.deepEqual(ERROR_COPY, {
      offlineSave: "인터넷 연결 후 다시 저장해 주세요.",
      searchFilterSave: "검색 조건을 저장하지 못했어요. 다시 시도해 주세요.",
      anchorResolve: "기준 작품을 찾지 못했어요. 잠시 후 다시 시도해 주세요.",
      personAdd: "등록하지 못했어요. 잠시 후 다시 시도해 주세요.",
      recommendationExclusionSave: "추천 제외 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      recommendationFeedbackSave: "피드백을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      searchFilterLoad: "검색 조건을 불러오지 못했어요. 다시 시도해 주세요.",
      searchLoad: "검색하지 못했어요. 잠시 후 다시 시도해 주세요.",
      recommendationExclusionLoad: "추천 제외 설정을 불러오지 못했어요. 다시 시도해 주세요.",
      recommendationLoad: "추천을 불러오지 못했어요. 다시 시도해 주세요.",
      pinLoad: "핀을 불러오지 못했어요. 다시 시도해 주세요.",
      shareCreate: "공유 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
      contentLoad: "작품 정보를 불러오지 못했어요. 다시 시도해 주세요.",
      watchCountSave: "본 횟수를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      peopleSearch: "인물을 검색하지 못했어요. 잠시 후 다시 시도해 주세요.",
      favoritePeopleLoad: "좋아하는 인물을 불러오지 못했어요. 다시 시도해 주세요.",
      seasonsLoad: "시즌 정보를 불러오지 못했어요. 다시 시도해 주세요.",
      episodesLoad: "회차 목록을 불러오지 못했어요. 다시 시도해 주세요.",
      personLoad: "인물 정보를 불러오지 못했어요. 다시 시도해 주세요.",
      reviewLoad: "감상 기록을 불러오지 못했어요. 다시 시도해 주세요.",
      shareOpen: "공유 링크가 만료되었거나 존재하지 않습니다."
    });
    for (const [key, message] of Object.entries(ERROR_COPY)) {
      assert.match(message, /[가-힣]/);
      if (key !== "shareOpen") assert.ok(message.endsWith("주세요."));
    }
  });

  it("T-16 replaces an English Edge Function error with the screen fallback", () => {
    assert.equal(
      userFacingErrorMessage(new Error("Edge Function returned a non-2xx status code"), ERROR_COPY.searchLoad),
      ERROR_COPY.searchLoad
    );
  });

  it("T-17 preserves an existing Korean service error", () => {
    assert.equal(
      userFacingErrorMessage(new Error("검색 시간이 초과됐어요."), ERROR_COPY.searchLoad),
      "검색 시간이 초과됐어요."
    );
  });
});
