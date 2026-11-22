# SceneNote 공통 작업 지침

SceneNote는 Expo/React Native 기반 감상 기록 앱이다. 기능을 바꿀 때는 사용자의 시청 기록과 장면 핀이 어떻게 저장되고 다시 표시되는지 확인한다.

## 시작과 명세 선택

1. `pwd`, `git rev-parse --show-toplevel`, `git status --short`로 작업 경로와 기존 변경을 확인한다. 대상 경로의 하위 `AGENTS.md`와 `AGENTS.override.md`를 확인한다. 같은 디렉터리에서는 override가 우선한다. 다른 작업자가 수정한 파일은 다시 읽고 변경이 겹치지 않게 편집한다.
2. 처음 진입하면 [프로젝트 README](README.md)를 확인한다. **기능별 명세는 [문서 목차](docs/README.md#요구사항과-설계-문서)에서 고른다.** 기능명·화면명으로 관련 행을 찾고 선행 명세와 후속 정정을 함께 읽는다. 예를 들어 회차 선택은 `rg -n '회차 선택|진행 위치' docs/README.md`로 찾을 수 있다.
3. 기능 계약은 개별 명세가 우선한다. 후속 명세가 명시적으로 수정한 항목에만 새 결정을 적용한다. 설계 결정(D-N)을 바꿔야 하면 해당 구현을 멈추고 이유를 보고한다. 명세의 테스트 표는 모든 행을 자동 또는 수동 검증에 대응시킨다. 코드와 요구사항이 다르면 미구현·오래된 설명·결정이 필요한 충돌을 구분한다.

| 작업 | 먼저 확인할 자료 |
| --- | --- |
| 화면·컴포넌트·스타일 | [공통 UI 규칙](docs/00_ui_style_rules.md), [화면 구현·QA 기준](docs/11_screen_implementation_spec.md)의 해당 화면, 기능별 명세. 모바일 레이아웃·입력은 [모바일 사용성](docs/19_mobile_usability_spec.md)도 적용한다. |
| 명세·작업 지시 작성 | [명세 작성 패턴](docs/00_codex_doc_pattern.md). 새 명세 파일에 14장 실행 지시를 넣고 응답에 짧은 복붙 프롬프트를 준다. UI 명세·프롬프트의 READ FIRST에는 공통 UI 규칙을 넣는다. 새 명세 링크는 문서 목차에서 관리한다. |
| 라우트·상태·데이터 흐름 | [화면별 코드 진입점](docs/08_frontend_architecture.md#실제-라우트와-탐색-출발점), [시스템 아키텍처](docs/04_architecture.md). 변경한 공통 컴포넌트·테마·Query 키·서비스·서버 공유 함수의 사용처까지 확인한다. |
| 작업 재개·남은 검증 | [작업 기록](docs/development_next_steps.md)에서 명세 번호나 기능명으로 해당 절을 찾는다. 과거 프롬프트와 QA 결과는 기록 시점의 근거로 읽는다. |

## 구현 원칙

- TypeScript strict와 기존 구조·명명·UI 동작을 따른다. 변경 범위를 기능에 맞추고 오류를 숨기는 우회는 피한다. 불확실한 외부 API 동작은 TODO와 명세에 검증 항목으로 남긴다.
- 서버 데이터는 TanStack Query, UI 상태는 Zustand를 쓴다. 기존 Jotai 핀 폼·스포일러 상태는 관련 작업에서만 다룬다. 보러가기 응답은 [공개 메타데이터 캐시 명세](docs/69_persistent_public_metadata_cache_fixes_spec.md)를 따른다.
- 핀 시간 `timestamp_seconds`는 정수 초로 저장한다. 영화 핀은 `episode_id = NULL`이며, 같은 회차·시간에 여러 핀을 허용한다.
- 콘텐츠 메타데이터와 사용자 기록을 분리한다. 콘텐츠·외부 ID·제목·시즌·회차 테이블은 인증 사용자 읽기와 service role 쓰기를 적용한다. 라이브러리·진행·핀·태그·프로필은 본인 소유권을 RLS로 보호한다. 검색 결과를 `contents`에 일괄 저장하지 않는다.
- TMDB·AniList·Kitsu·TVmaze 호출과 외부 API 키는 Edge Functions에서 관리한다. Expo의 공개 환경변수는 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`만 사용한다. service role 키는 Edge Function secret에만 두고, 실제 키를 코드·문서·예제 환경 파일에 쓰지 않는다. `external_search_cache`와 `metadata_sync_logs`는 클라이언트가 직접 접근할 수 없다.
- 다른 작업을 지우는 명령, `git reset`, 대규모 삭제나 강제 덮어쓰기를 피한다. `docs/`와 `.claude/`의 기존 문서·기록을 보존한다.

## 실행·검증·완료

- Expo 웹은 **8081**을 사용한다. 기존 서버부터 확인하고 재기동이 필요하고 요청 범위일 때만 대상 프로세스를 확인한 뒤 `npm run web -- --port 8081 --localhost --clear`로 실행한다. 배포·DB·secret·원격 smoke·import와 광범위한 restart 명령의 조건은 [실행 명령](README.md#실행빌드검증-명령)에 있다.
- 기능 코드의 중간·완료 검증에는 [scenenote-verify](.agents/skills/scenenote-verify/SKILL.md)를 적용한다. 완료 시 `npm test`, `npm run typecheck`, `npm run lint`와 명세별 검사를 실행한다. 순수 테스트는 `node:test`와 `node:assert/strict`를 쓰며 React Native·Supabase 런타임을 import하지 않는다.
- [변경 종류별 검증](README.md#변경-종류별-검증)에 따라 문서·스킬·훅은 관련 경로와 도구를 검사하고, UI는 웹·iOS·Android 결과를 구분한다. 루트 타입·린트는 Edge Functions를 제외한다.
- 변경 이유, 실제 검사 결과, 미실행 항목의 이유와 남은 작업을 보고한다. 계약 변경은 기능 명세에, 경로·데이터 흐름은 04/08에, 실행 환경은 README에, 검증 증거·인수인계는 작업 기록의 해당 절에 남긴다.
