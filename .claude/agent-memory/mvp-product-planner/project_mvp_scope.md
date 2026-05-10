---
name: SceneNote MVP 범위 및 핵심 결정사항
description: MVP 포함/제외 기능, Phase 분류, 핵심 설계 결정사항 요약
type: project
---

SceneNote MVP 범위와 핵심 설계 결정이 2026-05-02 기준으로 확정되었다.

## MVP 포함 기능 (P0/P1)

- 인증: 이메일, Google, Apple 로그인 (Supabase Auth)
- 콘텐츠 검색: TMDB, AniList, Kitsu, TVmaze 통해 Edge Functions 경유
- My Library: 작품 추가 + 감상 상태 (보고 싶음/보는 중/완료/드랍)
- 에피소드 진행률: user_episode_progress 테이블, 시리즈 전용
- 타임라인 핀: timestamp_seconds(정수), 메모, 태그, 감정, is_spoiler
- 핀 목록: timestamp_seconds 오름차순 정렬, 태그 필터링
- 핀 수정/삭제
- My Page: 기본 통계 + 로그아웃

## MVP 제외 기능 (Phase별)

- Phase 2: Highlight Reel, 알림, 오프라인 모드, 다크 모드, 핀 Export, 다국어
- Phase 3: 소셜 공유, 추천 알고리즘, 커뮤니티, 시청 타이머

**Why:** 개인 기록과 핀 경험을 먼저 안정화한 후 소셜/추천 기능 확장.
**How to apply:** 새 기능 제안 시 이 Phase 분류를 기준으로 MVP 포함 여부 판단.
