/** docs/11 MVP: preserve extension code and data, but do not expose or fetch it. */
export const EXTENDED_FEATURES_ENABLED = false;

/**
 * 라이브러리 공유(현재 필터 결과를 링크로 공유)와 받는 사람이 여는 공개 공유 화면(/share).
 * 2026-10-02 사용자 결정: 본 작품을 다른 사람에게 공유하는 것이 앱의 핵심 목적이라 docs/11의 MVP 제외를 이 기능에 한해 대체한다.
 * 핀 이미지·취향 카드 공유는 여전히 EXTENDED_FEATURES_ENABLED를 따른다.
 */
export const SHARE_FEATURES_ENABLED = true;

/** docs/34: 배우·성우 검색, 좋아하는 인물 등록·목록·상세, 작품 상세 출연 섹션. 다른 확장 기능과 분리. */
export const PEOPLE_FEATURES_ENABLED = true;

/** Search discovery is part of MVP; unrelated extended features stay gated. */
export const SEARCH_RECOMMENDATIONS_ENABLED = true;
