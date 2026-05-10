---
name: SceneNote 프로젝트 개요
description: SceneNote 앱의 핵심 목적, 기술 스택, DB 스키마 핵심 사항 — 모든 FE 작업의 기반
type: project
---

## 핵심 목적

타임라인 핀(Timeline Pin) 기록이 앱의 핵심 가치. 검색은 도구. 핀 입력 속도와 신뢰성이 가장 중요.

## 기술 스택 (비협상)

- Expo Router (file-based routing)
- TypeScript strict mode
- TanStack Query v5 (서버 상태)
- Zustand (전역: authStore, appUIStore) + Jotai (화면별 atomic 상태)
- React Hook Form + Zod (폼)
- FlashList (목록 기본, FlatList는 10개 이하 단순 목록에만)
- Supabase JS Client (직접 DB 쿼리)
- expo-image (이미지 로딩 + blurhash)

**Why:** 04_architecture.md에서 확정. 변경 불가.

## DB 핵심 테이블 (FE에서 자주 참조)

- `timeline_pins`: id, user_id, content_id, episode_id(nullable), timestamp_seconds(INT nullable), memo(nullable), emotion(varchar nullable), is_spoiler(bool), created_at, updated_at
- `tags`: id, user_id, name
- `timeline_pin_tags`: pin_id, tag_id (N:M)
- `user_library_items`: id, user_id, content_id, status(watch_status enum)
- `user_episode_progress`: id, user_id, episode_id, content_id, watched_at
- `contents`: id, source_api, source_id, media_type, title_primary, title_original, poster_url, content_type
- `seasons`: id, content_id, season_number, title, episode_count
- `episodes`: id, season_id, content_id, episode_number, title, air_date, duration_seconds

## 핀 핵심 규칙

- timestamp_seconds는 DB에 INT로 저장, UI는 MM:SS / HH:MM:SS 변환
- episode_id = null → 영화 핀 (가상 에피소드 레코드 생성하지 않음)
- 동일 시간대 복수 핀 허용, 경고 없음
- 정렬: timestamp_seconds ASC NULLS LAST, created_at ASC
- timestamp_seconds OR memo 중 하나는 필수 (Zod refine + DB CHECK)

## watch_status enum

'wishlist' | 'watching' | 'completed' | 'dropped'

## 감정(emotion) 값 목록 (10개)

'moved' | 'excited' | 'nervous' | 'surprised' | 'happy' | 'sad' | 'angry' | 'scared' | 'empathy' | 'best'

## Edge Functions (외부 API 호출은 반드시 EF 경유)

- EF-001: search-content (TMDB + AniList 병렬)
- EF-002: get-content-detail
- EF-003: add-to-library (contents/seasons UPSERT)
- EF-004: fetch-episodes (lazy load)

## MVP 개발 기간

4주 (Week 1: 인프라, Week 2: 검색+라이브러리, Week 3: 에피소드+핀, Week 4: 태그+마무리)

**How to apply:** 모든 FE 설계와 구현에서 이 스택과 규칙을 기본값으로 사용. 이탈 시 명시적 이유 필요.
