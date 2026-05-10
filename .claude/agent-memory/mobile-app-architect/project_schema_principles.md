---
name: SceneNote 스키마 설계 원칙 및 RLS 방향
description: 테이블 분류(메타데이터/사용자 기록/캐시), RLS 정책 원칙, timeline_pins 중심 설계 핵심 요약
type: project
---

## 테이블 분류 (2026-05-02 확정)

### 콘텐츠 메타데이터 테이블 (service_role write only, authenticated read)
- contents, content_external_ids, seasons, episodes

### 사용자 기록 테이블 (RLS 필수, 본인만 접근)
- profiles, user_library_items, user_episode_progress, timeline_pins, tags, timeline_pin_tags

### 시스템 캐시 (service_role only)
- external_search_cache

## RLS 핵심 원칙

사용자 기록 테이블 모든 정책: `auth.uid() = user_id`
timeline_pin_tags는 user_id 없으므로 EXISTS 서브쿼리로 pin 소유자 검증.
콘텐츠 메타데이터: INSERT/UPDATE/DELETE는 service_role만. SELECT는 authenticated.
캐시 테이블: service_role만 모든 접근.

## timeline_pins 핵심 설계

- episode_id nullable (영화 핀은 NULL)
- timestamp_seconds INT nullable (타임스탬프 없는 핀 허용)
- 동일 (user_id, episode_id, timestamp_seconds) 복수 핀 허용 — UNIQUE 제약 없음
- 기본 정렬: timestamp_seconds ASC NULLS LAST, created_at ASC

## 핵심 인덱스 (MVP 필수)

1. timeline_pins (user_id, episode_id, timestamp_seconds)
2. timeline_pins (user_id, content_id, timestamp_seconds)
3. timeline_pin_tags (tag_id)
4. user_episode_progress (user_id, content_id)
5. user_library_items (user_id, status)

## 콘텐츠 저장 시점 (비협상)

사용자가 라이브러리 추가 또는 핀 생성 시에만 contents 테이블에 저장.
검색 결과 bulk 캐싱 절대 금지. external_search_cache는 검색 API 응답만 임시 캐싱.

## 에피소드 Lazy Load 전략

라이브러리 추가 시: seasons만 저장 (episodes는 저장 안 함).
사용자가 에피소드 화면 진입 시: fetch-episodes EF 호출 → episodes UPSERT → 반환.
DB가 에피소드 캐시 역할. 한 번 저장된 에피소드는 재조회 안 함 (동기화는 Phase 2).
