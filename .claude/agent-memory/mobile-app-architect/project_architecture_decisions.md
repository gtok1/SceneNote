---
name: SceneNote 아키텍처 핵심 기술 결정 사항
description: 04_architecture.md에서 확정된 기술 결정. 후속 에이전트(BE, FE)가 참조해야 할 방향성.
type: project
---

## 확정된 기술 결정 (2026-05-02)

### 영화 핀 처리
`timeline_pins.episode_id = NULL` 방식 채택. 가상 에피소드 레코드 생성 방식 미채택.

**Why:** 스키마 단순성. 가상 레코드는 의미 없는 데이터 생성 및 유지 비용 발생.
**How to apply:** 핀 조회 쿼리 작성 시 `episode_id IS NULL` 조건 분기 필수. Backend Architect에 전달.

### timestamp_seconds 저장 형식
INT 정수 저장. MM:SS/HH:MM:SS는 UI 전용 표현.

**Why:** 정렬, 비교, 수학 연산이 INT가 압도적으로 단순. 문자열 저장 시 정렬 오류 위험.
**How to apply:** 비협상 결정. 어떤 상황에서도 변경 불가.

### Edge Function 사용 기준
외부 API 호출 + service_role 쓰기 필요 시에만 Edge Function. 사용자 데이터 단순 CRUD는 직접 Supabase 클라이언트.

MVP Edge Functions:
1. `search-content` — 외부 API 검색 집계
2. `get-content-detail` — 콘텐츠 상세 조회
3. `add-to-library` — 라이브러리 추가 + 메타데이터 저장 트랜잭션
4. `fetch-episodes` — 시즌별 에피소드 lazy load

### UI 상태 관리 이원화
- Zustand: 전역 단일 스토어 (authStore, appUIStore)
- Jotai: 화면별 원자 상태 (핀 폼, 필터, 스포일러 해제)

**Why:** 두 라이브러리의 강점을 상황에 맞게 사용. 전역 공유 상태는 Zustand, 화면 독립 상태는 Jotai.

### 외부 API 우선순위
- 애니메이션: AniList 우선 → Kitsu 보완
- 드라마/영화: TMDB 우선 → TVmaze 보완 (드라마 스케줄)

### 동일 작품 중복 처리 (MVP)
자동 중복 제거 미구현. 출처 API 레이블 표시 + 사용자 직접 선택. Phase 2에서 cross-API 매핑 도입.

### Optimistic Update 적용 범위 (MVP)
적용: 에피소드 체크박스 토글, 핀 삭제, 감상 상태 변경.
미적용: 핀 생성(UUID 필요), 라이브러리 추가(EF 경유).
