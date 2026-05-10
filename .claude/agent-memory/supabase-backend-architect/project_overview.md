---
name: SceneNote Project Overview
description: SceneNote 프로젝트 핵심 아키텍처 원칙 및 확정 결정사항 요약
type: project
---

SceneNote는 애니, 한국 드라마, 일본 드라마, 영화 감상 기록 모바일 앱. 핵심 가치는 타임라인 핀(Pin) 경험.

**Why:** 검색이 아니라 사용자의 감상 기록이 핵심 자산. 외부 API는 보조 도구.
**How to apply:** 스키마, 인덱스, 성능 최적화 모두 timeline_pins 테이블을 중심으로 설계.

## 확정된 비협상 원칙

1. 외부 API 키는 Edge Functions 내에서만 존재. 클라이언트 노출 절대 금지.
2. 콘텐츠 메타데이터(contents, seasons, episodes) 쓰기는 service_role만 가능. 클라이언트는 RLS로 차단.
3. 검색 결과를 bulk 캐싱하지 않음. TTL 캐시(1시간)만 허용.
4. 에피소드는 라이브러리 추가 시 저장하지 않고 사용자가 에피소드 화면 진입 시 lazy load.
5. 단순 사용자 CRUD(핀 생성/수정/삭제, 에피소드 체크)는 Edge Function 없이 클라이언트 직접 SDK 호출.

## 완료된 설계 문서

- `docs/04_architecture.md` — 아키텍처 결정 (확정)
- `docs/05_erd_rls.md` — ERD 및 RLS 정책 (확정)
- `docs/06_backend_schema.sql` — DB 스키마 DDL (확정)
- `docs/07_edge_functions.md` — Edge Function 설계 및 구현 예시 (2026-05-02 작성)
