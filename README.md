# SceneNote

SceneNote는 애니메이션·한국/일본 드라마·영화의 감상 기록을 관리하고, 특정 장면에 시간·메모·태그를 붙이는 Expo/React Native 앱이다. iOS·Android·웹을 위한 코드가 있으며, 핵심 데이터는 Supabase에 저장한다. 핀의 시간은 정수 초 `timestamp_seconds`로 저장하고, 영화 핀은 `episode_id = null`로 처리한다.

처음 작업할 때는 [프로젝트 작업 규칙](AGENTS.md)을 확인한다. 기능별 명세는 [문서 목차](docs/README.md), 검사 선택은 [변경 종류별 검증](#변경-종류별-검증), 실행 결과와 미완료 사항은 [작업 기록](docs/development_next_steps.md)에서 찾는다.

## 현재 코드의 범위

아래는 저장소에서 확인한 구현 현황이다. 기능별 실제 실행·출시 검증 완료를 뜻하지 않는다.

- 이메일 회원가입·로그인·비밀번호 재설정, 세션 유지, 로그아웃·회원 탈퇴.
- TMDB/AniList 콘텐츠 검색, 한국어 시즌 검색, 상세·시즌·에피소드 조회.
- 시즌별 라이브러리 등록, 감상 상태와 진행 위치 관리.
- 핀 생성·조회·편집·삭제, 태그·감정·스포일러 처리, 홈 최근 기록과 프로필 통계.
- 검색 화면의 개인화 추천·유사 작품 탐색. 현재 `SEARCH_RECOMMENDATIONS_ENABLED = true`이며 관련 기준은 [검색 추천 복구 명세](docs/22_search_recommendations_restore_spec.md)와 후속 명세를 따른다.

[기능 플래그](src/constants/features.ts)의 `EXTENDED_FEATURES_ENABLED = false`에 따라 엑셀/사진 가져오기, 취향 리포트 등의 확장 기능은 코드가 있어도 현재 주요 진입에서 숨겨진다. 배우·성우 검색과 좋아하는 인물(인물 탭·상세·작품 출연 섹션)은 `PEOPLE_FEATURES_ENABLED = true`로 별도 노출한다(docs/34). 플래그만으로 모든 확장 경로·서버 기능이 차단되었다고 판단하지 않는다. 예를 들어 평점/리뷰 편집 UI와 공개 공유 경로는 남아 있으므로 [화면 명세](docs/11_screen_implementation_spec.md)의 제외 요구사항과 함께 검토해야 한다.

## 구성과 버전 확인 위치

| 위치 | 역할 |
| --- | --- |
| [package.json](package.json), [package-lock.json](package-lock.json) | 실행 명령·의존성 범위와 실제 잠금 버전. Expo SDK 54, React 19.1, React Native 0.81.5, Expo Router 6 계열 |
| [app.config.ts](app.config.ts) | Expo 앱·플랫폼 설정, `scenenote` 링크 스킴, 웹 정적 출력 |
| [app/_layout.tsx](app/_layout.tsx), [app/](app/) | 앱 진입, 인증 이동, Expo Router 화면 |
| [src/hooks/](src/hooks/), [src/services/](src/services/) | TanStack Query 훅, Supabase CRUD·Edge Function 호출 |
| [src/stores/](src/stores/), [src/atoms/](src/atoms/) | Zustand 전역 상태와 실제 사용 중인 Jotai 핀 폼·스포일러 상태 |
| [src/components/](src/components/), [src/utils/](src/utils/) | UI 컴포넌트, 검증·정렬·시간 처리와 순수 함수 테스트 |
| [supabase/functions/](supabase/functions/) | 외부 API 연동과 서버 쓰기 작업. 공통 구현은 `_shared/` |
| [supabase/migrations/](supabase/migrations/), [src/types/database.ts](src/types/database.ts) | DB 변경 이력과 클라이언트 DB 타입. 원격 적용 여부는 별도 확인 |
| [scripts/](scripts/) | 외부 연동 smoke, 관리용 가져오기·메타데이터 보정 스크립트 |

기능을 수정할 때는 화면 → 해당 훅 → 서비스 → Edge Function/DB 순서로 추적한다. 예를 들어 핀 작성은 [PinComposer](src/components/pins/PinComposer.tsx) → [useTimelinePins](src/hooks/useTimelinePins.ts) → [pins 서비스](src/services/pins.ts)로 연결된다. 명세 선택과 공통 모듈 영향 범위는 [문서 목차](docs/README.md)를 따른다.

## 개발 환경과 최초 실행

명령은 저장소 루트에서 실행한다. 패키지 관리 기준은 npm과 `package-lock.json`이다. 프로젝트 자체의 `engines`, `.nvmrc`, `.node-version`은 없으며, 잠금 의존성의 엔진 조건을 만족하는 Node.js가 필요하다. 확인된 조건은 React Native/Metro의 `>=20.19.4`와 중첩 `eslint-visitor-keys`의 `^20.19.0 || ^22.13.0 || >=24`다. 따라서 20.x에서는 20.19.4 이상, 22.x에서는 22.13.0 이상이 필요하며, 특정 실행 환경에서의 성공 여부는 따로 기록한다.

1. 잠금 파일 기준으로 설치한다.

   ```sh
   npm ci
   ```

2. 사용할 **개발용 Supabase 대상**을 먼저 선택한다.

   - 기존 원격 개발 프로젝트: 해당 대상의 DB 마이그레이션·Edge Functions·서버 secrets·Auth redirect 설정이 준비되어 있어야 한다. 원격 백엔드를 이용하면 로컬 Functions 서버는 필요하지 않다.
   - 로컬 프로젝트: 별도로 설치한 Supabase CLI와 Docker 실행 환경이 필요하다. [supabase/config.toml](supabase/config.toml)은 로컬 API 54321, PostgreSQL 17, Edge Deno 2를 설정한다. DB 준비와 Functions 실행은 앱 실행과 별개이며, [개발·검증 안내](docs/development_next_steps.md)를 확인한다. `npm run backend:serve`만으로 DB 전체가 준비되지는 않는다.

3. Expo가 읽는 `.env`에는 선택한 개발 대상의 다음 두 값만 설정한다. 기존 파일이 있으면 덮어쓰지 않는다.

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=<development-supabase-url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<development-anon-key>
   ```

   앱은 [src/lib/supabase.ts](src/lib/supabase.ts)에서 이 값을 읽는다. 미설정 시 코드의 placeholder가 사용되므로 화면 표시만으로 실제 연결을 확인할 수 없다. 로컬/원격 URL과 키를 섞지 않는다.

4. 웹 개발 서버를 시작한다.

   ```sh
   npm run web -- --port 8081 --localhost --clear
   ```

   Codex/AI 검증용 웹 서버는 **8081만 사용한다**. 사용 중이면 기존 서버와 작업 주체를 확인하고 재사용하거나, 재시작이 허용된 경우 해당 서버를 종료한 뒤 같은 포트로 시작한다. 다른 포트로 우회하지 않는다. iOS·Android 실행에는 해당 시뮬레이터/에뮬레이터 또는 연결 가능한 기기가 추가로 필요하다.

## 환경변수의 경계

[.env.example](.env.example)은 변수 이름을 확인하는 자료다. 현재 앱용·서버용 항목이 함께 있어 전체를 채워 Expo 환경으로 사용하는 예제로 삼지 않는다. 외부 API secret은 서버 환경에서 관리하고 Expo 환경에 넣지 않는다. 특히 `SUPABASE_SERVICE_ROLE_KEY`는 AGENTS에 따라 Edge Function secret으로만 사용한다. 일부 관리 CLI가 이 키를 요구하는 현재 구현은 아래에 현황으로 표시하며, 일반 실행 지침으로 승인하지 않는다.

| 변수 | 사용처·필수 여부 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 앱의 Supabase 연결에 필요. 번들에 공개되는 값 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 서버 연결·인증·관리 쓰기. 서비스 역할 키는 Edge secret 전용 원칙. 일부 관리 CLI도 요구하는 코드가 있으나 원칙과의 차이는 별도 개선 과제이며 앱에 포함 금지 |
| `TMDB_API_KEY` | TMDB Edge Function에 필요. 관리 CLI의 직접 사용 코드는 별도 검토 대상이며 앱에 포함 금지 |
| `ANILIST_API_URL`, `KITSU_API_URL`, `TVMAZE_API_URL` | 서버 제공처 endpoint 선택값. 코드에 기본값 존재 |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | 필요한 원격 CLI 작업에만 제공. 앱 실행에는 불필요 |
| `SCENENOTE_TEST_EMAIL`, `SCENENOTE_TEST_PASSWORD` | 인증 smoke 실행 시 전용 테스트 계정에 필요. 앱 실행에는 불필요 |

코드에는 예시 파일에 없는 선택값도 있다. `ENABLE_PHASE2_SEARCH_SOURCES=true`는 Kitsu/TVmaze 검색 후보를 추가하고, `RECOMMENDATION_DEBUG=true`는 추천 진단 응답을 켠다. `SCENENOTE_DELETE_ACCOUNT_SMOKE=1`은 원격에서도 삭제 smoke를 허용하며, `BULK_IMPORT_USER_ID`/`BULK_IMPORT_USER_EMAIL`은 관리용 가져오기 대상을 지정한다. 모두 서버/CLI 용도이며, 문서 정리 과정에서 활성화하지 않는다.

현재 `backend:serve`와 일부 IDE 배포 구성은 `.env`를 서버 입력으로도 읽는다. [화면 명세](docs/11_screen_implementation_spec.md)의 환경 분리 요구와 어긋나는 설정 과제이며, 이 README는 해당 스크립트를 수정한 것으로 간주하지 않는다.

## 실행·빌드·검증 명령

다음 명령은 [package.json](package.json)에 정의되어 있다. 이 표는 명령의 존재와 역할을 설명하며 최근 실행 성공 기록은 아니다.

| 명령 | 역할·범위 |
| --- | --- |
| `npm run start` | Expo 개발 서버 |
| `npm run ios` / `npm run android` | Expo 서버와 플랫폼 실행 진입 |
| `npm run web -- --port 8081 --localhost --clear` | 8081 웹 개발 서버 |
| `npm run build` | `expo export --platform web`으로 웹 정적 산출물 `dist/` 생성. 네이티브 배포 빌드나 호스팅 배포는 포함하지 않음 |
| `npm run typecheck` | TypeScript 검사. `tsconfig.json`은 `supabase/functions`를 루트 검사 대상에서 제외하므로 Edge 전체 검사로 간주하지 않음 |
| `npm run lint` | ESLint 검사. `eslint.config.js`에서 Edge Functions와 생성 디렉터리 제외 |
| `npm test` | `tsx --test` 기반 `src`, `scripts`, Functions 공통 모듈·검색 어댑터의 지정된 `*.test.ts` 패턴 실행 |

테스트는 `node:test`·`node:assert/strict`를 쓰며 React Native/Supabase 런타임이 필요한 모듈을 직접 import하지 않고 순수 함수를 검증한다. 전체 앱 E2E, DB의 실제 RLS, 외부 API, 플랫폼별 UI 검증을 대신하지 않는다. 검사 선택은 아래 [변경 종류별 검증](#변경-종류별-검증)을 따른다.

AI 작업 중 관련 테스트만 반복하고 완료 시 필요한 전체 검사를 실행하려면 [scenenote-verify](.agents/skills/scenenote-verify/SKILL.md)를 사용한다. 결과는 검사별 한 줄, 전체 로그는 비공개 임시 폴더에 남는다. Git 커밋 전에는 [staged 경로 검사](.githooks/scenenote-staged-guard.py)를 사용할 수 있다. 새 체크아웃에서 `python3 .githooks/install.py`로 설치하고 `python3 .githooks/install.py --check`로 상태를 확인한다. 다른 pre-commit 훅·`core.hooksPath` 설정·hooks 디렉터리 심볼릭 링크가 있으면 설치가 중단된다. 설치한 훅은 linked worktree에도 적용되므로 각 체크아웃에 guard 파일이 필요하다. 커밋할 때 Git의 whitespace·attributes 설정에 따른 staged 공백·충돌 표시와 대표 민감 파일명을 검사한다.

기본 Node가 시작되지 않는 환경에서는 검증 도구에 `--node-bin <Node와 npm이 있는 디렉터리>`를 전달할 수 있다. 해당 실행의 하위 프로세스에만 적용하며 전역 PATH를 변경하지 않는다. 실제 명령·런타임 경로는 검사 로그 폴더의 `summary.json`에서 확인한다.

아래 명령은 별도 대상·권한·부작용 확인이 필요한 작업이다. 일상적인 정적 검사에 묶지 않는다.

| 명령/설정 | 주의할 부작용 |
| --- | --- |
| `npm run backend:serve` | Supabase Functions 로컬 서버. 현재 `.env`를 읽음. 요청을 받으면 외부 API·DB 작업 가능 |
| `supabase db push`, `supabase secrets set`, `supabase db pull` | 대상 프로젝트와 이력을 먼저 확인한다. 원격 스키마·secret 또는 로컬 마이그레이션 파일이 바뀐다. |
| `npm run backend:deploy` | 14개 Edge Function을 대상 프로젝트에 배포. DB 마이그레이션은 적용하지 않음 |
| `npm run smoke:edge -- "Inception" movie` | 테스트 계정 로그인 후 검색·인기 추천 호출. 캐시 쓰기 등 가능. service role이 있으며 대상이 로컬 URL이거나 원격용 `SCENENOTE_DELETE_ACCOUNT_SMOKE=1`을 지정한 경우 테스트 사용자·데이터 생성/삭제까지 수행 |
| `npm run import:netflix -- ...` | 관리용 DB 조회·외부 API 호출·로컬 결과 파일 생성. 기본 dry-run도 오프라인 검사가 아니며 `--commit`은 DB를 변경 |
| [backfill-content-air-date.ts](scripts/backfill-content-air-date.ts) | 외부 메타데이터 조회 후 콘텐츠·시즌·에피소드 쓰기를 수행하는 관리 스크립트. 전용 npm 스크립트 없음 |
| `restart`, `web:restart`, `dev:restart` npm 스크립트 | `pkill -f`로 기존 Expo/Functions 프로세스를 넓게 종료할 수 있음. 공유 작업 중 무심코 실행하지 않음 |

## 변경 종류별 검증

저장소 루트에서 실행한다. 해당 명세의 테스트 표는 모든 행을 자동 또는 수동 검사에 대응시키고, 미실행 항목은 이유를 기록한다.

| 변경 | 실행·점검 방법 | 확인 범위와 한계 |
|------|---------------|------------------|
| Markdown만 변경 | 저장 후 재독, 상대 링크/앵커·실재 경로·`package.json` 명령 대조, `git diff --check`, 최종 diff/상태 | 문서 정합성. 전체 앱 테스트·빌드를 근거 없이 반복하지 않음 |
| AI 스킬·Git 훅 | 바뀐 진입점에서 원본까지 링크를 확인한다. 검증 CLI는 `python3 .agents/skills/scenenote-verify/scripts/test_verify.py`, 커밋 훅은 `python3 .githooks/test_staged_guard.py`로 격리 검사한다 | 임시 환경에서 실행한 도구의 동작 |
| 순수 로직·캐시·서비스 계약 | 회귀 입력을 기존 `.test.ts`에 연결하고 `npm test`, `npm run typecheck`, `npm run lint` | 테스트는 `node:test`+`node:assert/strict`. React Native/Expo/Supabase 런타임 import 없이 순수 함수 검사 |
| 화면·라우팅·입력 | 위 검사 + 해당 명세의 실제 화면 수동 QA. 웹 export 영향이 있으면 `npm run build` | 웹·iOS·Android 결과를 따로 기록. 테스트 글롭은 `app/`와 `.tsx`를 실행하지 않음 |
| Edge Function·외부 응답 | `_shared`·adapter 순수 함수 테스트, 요청/응답 계약과 오류/partial/auth 분기 검토 | `tsconfig.json`과 `eslint.config.js`는 `supabase/functions` 제외. `npm test`의 일부 서버 테스트도 Deno 핸들러·원격 API 동작을 보증하지 않음 |
| DB·RLS | migration·타입·서비스 사용처 대조 후 별도로 준비한 테스트 DB에서 인증 전/소유자/다른 사용자 권한 QA | 새 schema는 새 migration으로. 실제 DB 검증 환경·명령·결과를 남겨야 완료 |

정상 흐름 외에 세션 없음·만료, 빈 데이터/네트워크 실패, 같은 작품의 여러 시즌, 영화의 `episode_id = NULL`, 시간만/메모만/둘 다 빈 핀, 동일 시간 복수 핀, 스포일러, 저장·삭제 뒤 캐시와 이동을 해당 변경 범위에 맞게 확인한다. 수동 세부 항목은 [화면 QA 기준](docs/11_screen_implementation_spec.md)과 [기능별 후속 명세](docs/README.md#요구사항과-설계-문서)를 참고한다.

## 호스팅과 남은 확인

네이티브에서 보낼 공개 공유 링크는 [app.config.ts](app.config.ts)의 `extra.publicWebOrigin`에 정식 HTTPS 웹 origin을 설정한 뒤 클라이언트를 다시 빌드한다. 웹은 현재 origin을 사용한다. 설정이 없는 네이티브에서는 잘못된 상대 URL을 보내는 대신 안내를 표시한다. 현재 값은 미설정(`null`)이며 주소를 추측해 채우지 않는다. 시즌별 공유·핀 원자 저장·TMDB 식별자 분리의 운영 반영 순서는 [73](docs/73_project_integrity_fixes_spec.md)과 [작업 현황](docs/development_next_steps.md)을 따른다.

[vercel.json](vercel.json)은 `npm install` → `npm run build` → `dist/`와 상세/공유 경로 rewrite를 정의한다. 설정 파일의 존재는 실제 배포 성공·운영 연결·정적 동적 경로 정상 동작의 증거가 아니다. `.github/workflows`와 `eas.json`은 현재 저장소에서 확인되지 않았다.

IDE 실행 구성은 [.vscode/tasks.json](.vscode/tasks.json)과 [.run/](.run/)에 있다. JetBrains의 `Backend Functions Deploy.run.xml`은 초기 4개 함수만 배포하지만 `package.json`의 `backend:deploy`는 14개를 나열하므로 두 진입을 동등하게 취급하지 않는다.

현재 원격 마이그레이션·secrets·Auth 설정, 배포 상태, 외부 제공처 정상 응답, iOS/Android/웹의 전체 사용자 흐름은 저장소 정적 검토만으로 확정할 수 없다. 확장 기능 경계와 환경 파일 분리 등 요구사항 대비 남은 문제는 [개발·검증 및 작업 재개](docs/development_next_steps.md)에서 관리한다. [초기 구현 기록](docs/implementation_notes.md)의 과거 실행 결과를 현재 상태의 검증으로 재사용하지 않는다.
