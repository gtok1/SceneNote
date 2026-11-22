export const ERROR_COPY = {
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
} as const;

export type ErrorCopyKey = keyof typeof ERROR_COPY;
