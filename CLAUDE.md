# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

공통 개발·보안·검증 규칙은 [AGENTS.md](AGENTS.md)를 먼저 읽고 적용한다. 이 파일은 Claude 도구별 안내를 보완한다. 현재 실행 방법은 [README](README.md), 기능별 문서는 [문서 목차](docs/README.md), 작업 재개와 미검증 상태는 [development_next_steps](docs/development_next_steps.md)를 따른다. 과거 프롬프트와 agent-memory를 현재 작업 지시로 자동 실행하지 않는다.

## Project Overview

**SceneNote** — 애니, 한국 드라마, 일본 드라마, 영화 감상 기록 모바일 앱.

핵심 가치는 검색이 아니라 **사용자의 감상 기록과 타임라인 핀(Pin) 경험**이다. 검색은 지원 도구일 뿐이다.

타임라인 핀 예시:
- 진격의 거인 시즌 3, 12화, 14:32 — "리바이 액션 장면"
- 무빙 7화, 42:10 — "감정선 최고"

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo (Expo Router, file-based routing) |
| Language | TypeScript (strict mode) |
| Backend | Supabase (Auth + PostgreSQL + RLS + Edge Functions / Deno) |
| Server State | TanStack Query v5 |
| UI State | Zustand or Jotai (per use case) |
| Forms | React Hook Form + Zod |
| Lists | FlashList (preferred), FlatList (fallback) |
| External APIs | TMDB, AniList, Kitsu, TVmaze |

## Common Commands

저장소 루트에서 `package.json`에 정의된 명령을 사용한다. 설치·환경 선행조건은 [README](README.md)에 있다.

```bash
npm run web -- --port 8081 --localhost --clear
npm test
npm run typecheck
npm run lint
npm run build
```

웹은 8081만 사용한다. 기존 서버 상태를 확인하고 재시작 여부를 결정한다. `build`는 웹 export이며, 타입/린트는 Edge Functions를 제외한다. 배포·DB 적용·smoke·import는 부작용이 있으므로 [검증 가이드](docs/development_next_steps.md)에서 목적과 조건을 먼저 확인한다.

## Architecture

### Screen Routes (Expo Router)

실제 라우트와 상태 소유권은 [08. 프론트엔드 아키텍처](docs/08_frontend_architecture.md)의 현재 구현 안내를 기준으로 찾는다.

- 앱 진입: `app/_layout.tsx` → `src/providers/AppProviders.tsx`.
- 탭: `app/(tabs)/_layout.tsx`; 검색 구현 본체는 `app/search.tsx`.
- 작품 상세: `app/content/[id].tsx`; 회차/핀 목록은 같은 경로의 `episodes.tsx`, `pins.tsx`.
- 핀 생성: `app/pins/new.tsx`; 조회/편집: `app/pins/[id].tsx`; 공통 폼: `src/components/pins/PinComposer.tsx`.
- 기능 노출은 `src/constants/features.ts`도 확인한다. 파일 존재만으로 현재 노출·검증 완료를 뜻하지 않는다.

### Data Architecture — 핵심 분리 원칙

콘텐츠 메타데이터(외부 API)와 사용자 기록 데이터를 반드시 분리한다.

**콘텐츠 테이블** (외부 API 메타데이터, service_role만 쓰기 가능):
- `contents`, `content_external_ids`, `seasons`, `episodes`
- 사용자가 라이브러리에 추가하거나 핀을 생성할 때만 저장 (bulk 캐싱 금지)

**사용자 기록 테이블** (RLS로 보호, 본인 데이터만 접근):
- `user_library_items` — 감상 상태 (보고 싶음 / 보는 중 / 완료)
- `user_episode_progress` — 에피소드별 진행률
- `timeline_pins` — 핀 (timestamp_seconds, memo, tags, emotion, is_spoiler)
- `timeline_pin_tags`, `tags`

**캐시 테이블**:
- `external_search_cache` — 외부 API 검색 결과 TTL 캐싱

### Data Flow

```
Expo App
  → Supabase Auth (인증)
  → Supabase DB / RLS (사용자 데이터 CRUD)
  → Supabase Edge Functions (외부 API 호출, 메타데이터 쓰기)
      → TMDB / AniList / Kitsu / TVmaze
      → external_search_cache
```

**외부 API 키는 절대 클라이언트에 노출하지 않는다.** 모든 외부 API 호출은 Edge Functions를 통한다.

### State Management 분리

- **TanStack Query**: 서버 데이터 (핀 목록, 라이브러리, 검색 결과, 콘텐츠 상세)
- **Zustand / Jotai**: 로컬 UI 상태 (핀 작성 폼, 필터, 탭 선택 등)

## Design Principles

1. **RLS-first**: 모든 사용자 데이터 테이블은 RLS 필수. 앱 레벨 보안만으로는 부족하다.
2. **타임라인 핀 데이터가 핵심 자산**: DB 스키마와 조회 성능은 핀을 중심으로 설계한다.
3. **MVP에서는 작고 빠르게**: 복잡한 마이크로서비스 금지. Supabase + Edge Functions가 백엔드 복잡도의 상한선이다.
4. **불확실한 외부 API 동작은 "확실하지 않음"으로 명시**하고 검증 단계를 별도로 둔다.
5. **추후 확장 가능한 스키마**: 커뮤니티, 추천, 소셜 기능을 나중에 추가할 수 있도록 스키마를 설계한다.

## 문서 작성 규칙 — Codex 복붙 프롬프트 필수

작성 방식의 단일 기준은 [docs/00_codex_doc_pattern.md](docs/00_codex_doc_pattern.md)다. 구현 명세·작업 지시를 쓰기 전에 읽고 마지막 체크리스트까지 적용한다.

UI(화면·컴포넌트·스타일) 작업과 UI 명세·프롬프트는 [docs/00_ui_style_rules.md](docs/00_ui_style_rules.md)를 따른다. 웹과 iOS·Android 앱을 모두 고려하며, 명세·프롬프트에는 이 문서를 READ FIRST로 넣고 규칙을 반복하지 않는다.

- 사람용 명세 파일과 Codex 실행 프롬프트를 짝으로 만든다. 새 프롬프트는 파일 대신 **응답 본문에 4중 백틱 펜스**로 제공한다.
- 기존 `codex_prompt_*.md`는 보존하며 후속 명세·현재 코드와 대조한 뒤 사용한다.
- 새 명세는 `AGENTS.md`의 해당 작업 표와 [문서 목차](docs/README.md)에 연결한다.
- 설계 결정(D-N), 테스트 표 전체, 보안 조건을 임의로 줄이지 않는다. 계약·근거가 충돌하면 그 부분은 판단 보류로 보고한다.

## Specialized Agents & Skills

**에이전트** (`.claude/agents/`) — 별도 컨텍스트로 실행되는 전문 서브에이전트:

- **mvp-product-planner**: 화면 정의서, 유저 스토리, MVP 범위 및 엣지 케이스 분석
- **mobile-app-architect**: 아키텍처 결정, ERD 설계, RLS 정책, 데이터 플로우
- **rn-expo-ui-architect**: React Native 컴포넌트 구현 및 리뷰, 화면 아키텍처
- **supabase-backend-architect**: DB 스키마, RLS 정책 SQL, Edge Function 구현, 쿼리 최적화

**스킬** (`.claude/skills/`) — 현재 대화에서 Claude가 직접 수행하는 작업:

- **orchestrate**: 여러 역할(PM, Tech Lead, FE, BE) 산출물을 검토·조율하여 최종 MVP 통합 계획 수렴

새 기능을 시작하거나 설계 결정이 필요할 때는 해당 에이전트를 사용한다. 역할 산출물 통합이 필요할 때만 `/orchestrate` 스킬을 호출한다. Codex 진입점은 `.agents/skills/orchestrate/SKILL.md`이며 공통 절차는 `.claude/skills/orchestrate/SKILL.md`에 있다.

`.claude/agent-memory/`는 이전 작업의 참고 기록이다. 현재 코드·후속 명세·사용자 요청과 대조하며, 거기에 적힌 미구현/검증 완료 상태나 과거 범위가 현재 상태를 덮어쓰지 않는다. 에이전트 frontmatter의 모델 별칭은 Claude 전용 설정으로, 저장소 공통 모델 선택 규칙이 아니다.
