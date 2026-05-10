---
name: DB Schema Key Decisions
description: SceneNote DB 스키마 핵심 결정사항 — enum 값, FK 정책, 인덱스 전략, 제약 조건
type: project
---

## Enum 타입 (확정)

- content_type: anime, kdrama, jdrama, movie, other
- watch_status: wishlist, watching, completed, dropped
- external_source: tmdb, anilist, kitsu, tvmaze, manual
- emotion_type: excited, moved, funny, sad, surprised, angry, scared, love, boring, none

## 핵심 FK 정책 (확정)

| 테이블.컬럼 | ON DELETE |
|------------|-----------|
| timeline_pins.user_id | CASCADE |
| timeline_pins.content_id | RESTRICT |
| timeline_pins.episode_id | SET NULL (영화 핀 허용) |
| timeline_pin_tags.pin_id | CASCADE |
| timeline_pin_tags.tag_id | CASCADE |
| user_library_items.user_id | CASCADE |
| user_library_items.content_id | RESTRICT |

## timeline_pins 핵심 결정사항

- timestamp_seconds: INT, NULL 허용(시간 미지정 핀), CHECK >= 0
- episode_id: NULL 허용 (영화 핀 처리 방식)
- 동일 (episode_id, timestamp_seconds, user_id) 복수 핀 허용 — UNIQUE 제약 없음
- DB CHECK: timestamp_seconds IS NOT NULL OR memo IS NOT NULL (둘 다 null 방지)
- 정렬 기본값: ORDER BY timestamp_seconds ASC NULLS LAST, created_at ASC

## 인덱스 우선순위 (P0)

- idx_timeline_pins_user_episode_ts: (user_id, episode_id, timestamp_seconds ASC NULLS LAST)
- idx_timeline_pins_user_content_ts: (user_id, content_id, timestamp_seconds ASC NULLS LAST)
- idx_user_library_items_user_status: (user_id, status)

## UPSERT 전략

- contents: ON CONFLICT (source_api, source_id) — 동일 API의 동일 작품 중복 방지
- content_external_ids: ON CONFLICT (api_source, external_id) DO NOTHING
- seasons: ON CONFLICT (content_id, season_number)
- episodes: ON CONFLICT (season_id, episode_number)
- user_episode_progress: ON CONFLICT (user_id, episode_id)

**Why:** UUID PK 기본값, snake_case 컬럼명, TIMESTAMPTZ 사용이 프로젝트 전반 컨벤션.
**How to apply:** 새 테이블 추가 시 동일 패턴 준수.
