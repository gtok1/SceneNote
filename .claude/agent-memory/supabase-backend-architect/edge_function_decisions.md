---
name: Edge Function Design Decisions
description: MVP Edge Function 4개의 엔드포인트 계약, 내부 로직, 캐싱 전략 핵심 결정사항
type: project
---

## MVP Edge Functions (4개 확정)

### EF-001: search-content
- POST /functions/v1/search-content
- Body: { query, media_type?, page? }
- 캐시 TTL: 1시간, source별 분리 저장
- 캐시 키: SHA-256(query:source:media_type:page)
- API 우선순위: anime → AniList 우선, drama/movie → TMDB 전용
- 실패 전략: Promise.allSettled, partial=true 플래그, 전체 실패 시 503

### EF-002: get-content-detail
- POST /functions/v1/get-content-detail
- Body: { api_source, external_id }
- DB에 있으면 DB 반환 (from_db: true), 없으면 외부 API 호출
- DB 저장 금지 — 저장은 add-to-library에서만 발생
- 콘텐츠 상세 캐시 TTL: 24시간 (선택적)

### EF-003: add-to-library
- POST /functions/v1/add-to-library
- Body: { api_source, external_id, watch_status? }
- 처리 순서: 중복체크 → 외부API → contents UPSERT → content_external_ids UPSERT → seasons UPSERT → user_library_items INSERT → metadata_sync_logs INSERT
- user_id는 반드시 JWT에서 추출. 클라이언트 전달값 절대 사용 금지.
- 이미 라이브러리에 있으면 409 반환
- 에피소드는 저장하지 않음 (lazy load 원칙)
- 모든 메타데이터 쓰기는 service_role 클라이언트 사용

### EF-004: fetch-episodes
- POST /functions/v1/fetch-episodes
- Body: { content_id, season_id } — 내부 UUID 사용
- DB에 에피소드 있으면 DB 반환, 없으면 외부 API 호출 후 저장
- DB가 캐시 역할. 외부 API 변경 동기화는 Phase 2.

## 공통 패턴

- 모든 Edge Function: JWT 검증 필수 (auth.getUser())
- CORS: OPTIONS preflight 처리 포함
- 타임아웃: 외부 API 호출 5초 (AbortController)
- 환경변수: Deno.env.get('TMDB_API_KEY'), SUPABASE_SERVICE_ROLE_KEY 등

**Why:** 외부 API 키 보호 + service_role 쓰기 권한이 Edge Function 사용의 두 핵심 이유.
**How to apply:** 새 기능에서 "Edge Function이 필요한가?" 판단 기준은 이 두 가지 중 하나 해당 여부.
