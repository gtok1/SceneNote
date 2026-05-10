---
name: External API Integration Strategy
description: TMDB, AniList, Kitsu, TVmaze 특성 및 MVP 통합 전략 결정사항
type: project
---

## MVP 우선 지원 API (확정)

- **TMDB**: 드라마, 영화 1순위. REST API. Bearer Token 인증. language=ko-KR 지원.
- **AniList**: 애니메이션 1순위. GraphQL API. 인증 불필요 (공개 API).

## Phase 2 이후 검토

- **Kitsu**: AniList 보완용 애니메이션 API.
- **TVmaze**: 방영 스케줄 특화 — "새 에피소드 알림" 기능 도입 시.

## 중요 제한사항 (확실하지 않음 — Uncertain)

- TMDB Rate Limit: 40 req/sec — 공식 문서 재확인 필요
- AniList Rate Limit: 90 req/min — 공식 문서 재확인 필요
- AniList는 시즌 개념이 별도 작품(series)으로 분리됨 — 단일 시즌(season_number=1)으로 처리
- TMDB external_id만으로 TV/Movie 구분 불가 — add-to-library Request Body에 media_type 추가 권장
- TMDB의 한국 드라마 vs 일본 드라마 자동 구분: origin_country 필드 활용 가능성 — 미검증

## 검색 타임아웃

- 외부 API 호출 타임아웃: 5초 (AbortController)
- 결정 근거: TBD-009에서 5초 권고

## cross-API 중복 처리

- MVP: 자동 중복 제거 없음. 각 API 출처별 별도 레코드 저장.
- Phase 2: content_external_ids를 허브로 여러 API 출처를 하나의 canonical content로 통합.
- 이유: 자동 매핑의 오탐 위험 (Dragon Ball vs Dragon Ball Z 등)

**Why:** AniList가 애니 데이터 커버리지 및 한국어/일본어 제목 지원이 우수. TMDB가 드라마/영화 포스터 품질 우수.
**How to apply:** media_type=anime 검색 시 AniList를 먼저 표시하도록 UI 정렬 고려.
