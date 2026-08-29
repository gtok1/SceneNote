# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

프로젝트가 초기화된 후 사용할 명령어:

```bash
npx expo start          # 개발 서버 시작
npx expo start --ios    # iOS 시뮬레이터
npx expo start --android # Android 에뮬레이터
npx tsc --noEmit        # 타입 체크
npx eslint .            # 린트
npx expo export         # 프로덕션 빌드

# Supabase
npx supabase start      # 로컬 Supabase 시작
npx supabase db push    # 마이그레이션 적용
npx supabase functions serve # Edge Functions 로컬 실행
```

## Architecture

### Screen Routes (Expo Router)

```
app/
  (tabs)/
    index       — 홈 / 라이브러리
    search      — 검색
    profile     — 프로필
  content/
    [id]/
      index     — 콘텐츠 상세
      episodes  — 에피소드 목록
      pins      — 콘텐츠별 핀 타임라인
  pins/
    [id]        — 핀 상세 / 편집
  search        — 검색 화면
  profile       — 프로필 화면
```

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

구현 명세서나 작업 지시 문서를 작성할 때는 **항상 두 개를 짝으로** 만든다. 실제 구현은 Codex 에이전트가 수행하므로, 사람이 읽는 명세서만으로는 부족하다.

| 파일 | 대상 | 형식 |
|------|------|------|
| `docs/NN_<기능>_spec.md` | 사람 | 문제 정의, 설계 결정과 기각한 대안, 데이터 모델, 화면 명세, 엣지 케이스, 테스트 표 |
| `docs/NN_codex_prompt_<기능>.md` | Codex | 파일 전체가 그대로 첫 메시지가 되는 자기완결적 지시문 |

**Codex 프롬프트 작성 규칙**

- 맨 위 한 줄: `> 이 파일 **전체를 복사해서 Codex 첫 메시지로 붙여넣으세요.**` 그 아래는 전부 프롬프트다. 사용자용 메타 설명을 중간에 섞지 않는다.
- 반드시 포함: ROLE & GOAL · READ FIRST(문서 경로) · 바꾸면 안 되는 설계 결정 · STEP별 작업 순서 · 검증 명령(`npm test`, `npm run typecheck`, `npm run lint`) · DEFINITION OF DONE · 변경 파일 목록 · 보고 항목 · 금지사항.
- 상세는 명세서를 경로로 참조하되, **프롬프트만 읽고도 잘못 구현할 수 없을 만큼의 계약**(타입 시그니처, 판정 순서, 테스트 표, SQL 전문)은 프롬프트 안에 직접 넣는다.
- 새 명세서·프롬프트를 만들면 `AGENTS.md`의 "작업 지시 문서 — 항상 먼저 읽기" 표에 한 줄 추가한다. Codex는 `AGENTS.md`를 항상 읽으므로 이 표가 상시 로딩 경로다.

## Specialized Agents & Skills

**에이전트** (`.claude/agents/`) — 별도 컨텍스트로 실행되는 전문 서브에이전트:

- **mvp-product-planner**: 화면 정의서, 유저 스토리, MVP 범위 및 엣지 케이스 분석
- **mobile-app-architect**: 아키텍처 결정, ERD 설계, RLS 정책, 데이터 플로우
- **rn-expo-ui-architect**: React Native 컴포넌트 구현 및 리뷰, 화면 아키텍처
- **supabase-backend-architect**: DB 스키마, RLS 정책 SQL, Edge Function 구현, 쿼리 최적화

**스킬** (`.claude/skills/`) — 현재 대화에서 Claude가 직접 수행하는 작업:

- **orchestrate**: 여러 역할(PM, Tech Lead, FE, BE) 산출물을 검토·조율하여 최종 MVP 통합 계획 수렴

새 기능을 시작하거나 설계 결정이 필요할 때는 범용 응답 대신 해당 에이전트를 사용한다. 산출물 통합이 필요할 때는 `/orchestrate` 스킬을 호출한다.
