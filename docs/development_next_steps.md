# SceneNote Development Next Steps

## 프로젝트 정합성 보완 (docs/73, 2026-11-16)

- 상태: **결함 11건 코드 보완·자동 검사 완료. 사용자 승인 후 운영 migration 3개·함수 7개 반영 완료, 실제 웹/iOS/Android 화면 미확인.** 사용자의 “문제점 보완해줘”에 따라 [73](73_project_integrity_fixes_spec.md)을 구현했다. 브라우저·시청 앱·Expo 서버를 열거나 조작하지 않았고 실제 계정의 감상/핀/공유 기록도 검증용으로 쓰지 않았다. 기존 docs/71·72 변경을 보존했으며 커밋/푸시는 하지 않았다.
- 시작 경로/root는 `/Users/youngilkim/SceneNote`. `git status`와 소스 snapshot을 `/tmp/scenenote-integrity-start-status.txt`, `scenenote-integrity-start.json`에 보관했다. 시작 전체 검사는 **1690개 중1689 통과·1 실패**로 기존 공급자 timeout 테스트의 20ms 경계가 병렬 부하에서 실패했다. 해당 기존 파일은 격리 **54/54** 통과했고 단언/시간 제한을 바꾸지 않았다. 최종 전체 검사는 **1769/1769, 신규79개**, 실패/skip0이다.

| 결함 | 보완 |
|------|------|
| F-1 외부 ID 충돌 | TMDB movie/tv namespace를 DB unique·조회·upsert·일괄 등록 CLI/Edge에 적용. 종류 미상 숫자 ID만으로 기존 작품을 골라 상태를 바꾸지 않는다. 원시 ID·기존 UUID·감상 기록을 보존하고 반대 종류의 상세로 폴백하지 않는다. |
| F-2 인증 복원 | Zustand의 예전 session/user/loading 저장값은 무시하고 SDK의 최신 인증 이벤트/초기 조회를 따른다. |
| F-3 부분 회차 캐시 | 알려진 총 화수의 1..N 누락을 검사해 보충한다. 미정은 실제 공개 번호 배열+전체 동기화 시각을 30분 재사용한다. 기존 episode ID와 숨은 미래/레거시 행을 보존한다. |
| F-4 저장 0행 | 상태·직접 진행·시청일과 구스키마 폴백이 적용 id를 반환받아 0행이면 실패 처리한다. |
| F-5 동시 변경 복구 | 실패한 항목/필드와 작업 세대를 확인해 복구하고, 같은 항목의 더 최신 변경·다른 항목 성공·성공한 삭제를 보존한다. 오류 계정의 대기 쓰기가 끝난 뒤 활성 DB 조회로 재조정한다. |
| F-6 회차/체크 잘림 | 안정 정렬 pagination으로 끝까지 읽고 중간 오류/안전 상한은 부분 성공으로 반환하지 않는다. |
| F-7 추천 입력 잘림 | 서버의 라이브러리·피드백 입력을 페이지 단위로 끝까지 읽는다. |
| F-8 시즌 공유 | 선택한 library_item_ids의 순서·시즌·상태·화수를 보존하며 타인 등록은 거절한다. 기존 링크도 결정적으로 해석하고 삭제된 선택을 다른 시즌으로 대체하지 않는다. |
| F-9 네이티브 공유 | 공개 HTTPS origin+RN Share를 사용하고 취소는 정상 처리한다. 주소가 없으면 상대 URL 대신 안내 오류를 표시한다. |
| F-10 핀 상세 이동 | 편집 저장은 상세에 머물고 낙관적 삭제 중 폼을 유지해 삭제 성공 후 목록으로 이동한다. 이미 없는 핀도 목록 이동을 제공한다. |
| F-11 핀/태그 부분 저장 | SECURITY INVOKER RPC 한 트랜잭션으로 저장한다. 폼의 안정 UUID를 재사용해 중복 생성을 막고 같은 ID/다른 입력은 충돌로 거절한다. 실패 시 본문·태그 모두 rollback한다. |

- 선행 실패: 인증/복구16개, 공유15개, 핀14개, 공용 서버/핸들러 회귀와 UPDATE0행4개를 실제 red로 확인했다. 대표 출력은 `delayed storage must not replace the latest SDK account`（actual `old-account` / expected `new-account`）, `Cannot find module '…/libraryRollback'`, `selectSharedLibraryRows is not a function`, `Cannot find module '…/libraryWrite'`이다. 최종 경계 검토에서 추가한 일괄 등록6개도 actual `movie-123` / expected `tv-123`로 전부 실패한 뒤 수정했으며, 실제 Edge의 media_hint=tv가 movie를 선택하는 재현도 red→green으로 확인했다. 로그는 `/tmp/scenenote-integrity-{auth-rollback,share,write,server,import-id,bulk-handler-id}-red.log`와 핀 전용 red 기록에 보관했다. helper 미존재로 실패한 순수 테스트와 실제 기존 코드에서 재현한 서비스/핸들러 오류는 구분한다.
- 최종 검사: `npm test` **1769/1769**, `npm run typecheck`, `npm run lint` 모두 exit0. 웹 `npm run build` export 성공(exit0, 기존 Expo 종료 안내 있음). Edge 진입점 **16개 Deno strict/cached-only 검사 exit0**, 외부 네트워크 없이 확인했다. `/tmp/scenenote-integrity-final-{tests,typecheck,lint}.log`, `scenenote-integrity-build.log`, `scenenote-integrity-deno-all16.log`. 사용 Node24는 명령 PATH에만 지정했고 프로젝트 의존성/환경 파일은 바꾸지 않았다.
- 실제 코드 격리 검증: 라이브러리 서비스(0행/구스키마/1500행/부분·완전·미정 회차/중간 오류/상한), 인증 hydration, 메타데이터/추천 핸들러를 테스트 러너에서 실행했다. 별도 fixture는 실제 useLibrary/QueryCore mutation **20개**, 공유 handler/service **55개**, 핀 service **23개**·detail **12개** 검증 통과. 모의 경계의 외부 요청은0이며 실제 운영 요청 감소량이나 실기기 동작 확인은 아니다. `/tmp/scenenote-integrity-{library-mutation,share}-report.json`, `scenenote-pin-{atomic-service,detail}-report.json`의 소스 해시와 최종 파일이 일치한다.
- SQL: 프로젝트 의존성에 추가하지 않은 임시 **PGlite0.5.16 PostgreSQL**에서 기존 migration0001~0024+신규3개 **48개** 검증 통과. 읽기 전용 운영 목록 확인 결과는0001~0022라서 **0001~0022+신규3개** 조합도 별도로 **48개** 검증 통과했다. 0023·0024는 그 검증에서 명시적으로 제외했다. 기존 FK/UUID, 동번호 movie/tv 공존·변경 차단, RPC ACL/RLS·누락 로그인/타인·멱등성/충돌·태그 트리거 실패 원자 rollback, 새 공유 타인/빈 배열 거절·기존 링크 호환을 실제 SQL로 실행했다. 이는 hosted Supabase/PostgREST 검증을 대체하지 않는다. `/tmp/scenenote-integrity-sql/{report.json,report-base22.json,validate.mjs,validate-base22.mjs}`.
- UI 정적 검사: 이번에 추가한 화면/컴포넌트 코드에는 새 `Alert.alert`·색상/간격 토큰 위반을 추가하지 않았다. 기존 파일 전체의 과거 위반을 이번에 해결한 것으로 보고하지 않는다. docs/71·72의 D-1~D-9/D-1~D-5 동작 변경 없음. 새73의 D-1~D-8도 유지한다.

| 수동 확인 | 플랫폼 | 상태·이유 |
|-----------|--------|-----------|
| M-1 | 웹1440·375 | **미실행.** 사용자 시청을 방해하지 않도록 브라우저를 열지 않았다. 실제 로그인·동시 저장·시즌 공유·핀 이동은 미확인. |
| M-2 | iOS 세로 | **미실행.** 실기기/시뮬레이터를 실행하지 않았다. 공개 웹 origin 설정과 OS 공유 시트·취소·저장/삭제 확인 필요. |
| M-3 | Android | **미실행.** 에뮬레이터/기기를 실행하지 않았다. 공개 웹 origin 설정과 OS 공유 시트·취소·저장/삭제 확인 필요. |

### 운영 반영 완료와 남은 설정

사용자가 **“위 DB 3개·함수 7개 운영 반영”**을 승인한 뒤 2026-11-16 21:47~21:48 KST에 연결 프로젝트 `pstkeooflscvtaxxrwdf`에 반영했다. 적용 직전 후보 소스 해시·프로젝트·운영 함수 버전/번들 해시와 migration0001~0022를 다시 비교해 변경 없음을 확인했다. 승인된 DB→함수 순서로 실행했으며 secret·다른 함수·무관한 0023/0024는 변경하지 않았다.

| DB migration | 운영 이력 버전 | 원본 준비 파일 버전 |
|--------------|----------------|-------------------|
| metadata_identity_scope | 20261116124736 | 20261116114112 |
| atomic_pin_save | 20261116124742 | 20261116114134 |
| season_scoped_library_shares | 20261116124751 | 20261116114158 |

- Supabase 플러그인이 운영 적용 시 생성한 이력 버전에 맞춰 **이번에 새로 만든 로컬 SQL 3개의 파일명만 정렬**했다. 운영 `schema_migrations.statements`와 승인 SQL 전문이 일치하고 SHA256도 변하지 않았다. 향후 중복 적용을 막기 위한 정렬이며 기존0001~0024 파일은 고치지 않았다. 현재 로컬 파일은 `20261116124736_metadata_identity_scope.sql`, `20261116124742_atomic_pin_save.sql`, `20261116124751_season_scoped_library_shares.sql`이다.
- 다음 **7개만** 배포했으며 전부 **ACTIVE·verify_jwt=true**다. 다른 함수8개의 버전/번들 해시/JWT는 불변이다. 내려받은 실행 소스 **80개(함수별 중복 포함)**가 후보 전문과 정확히 일치했다. 타입 전용 `types.ts` 및 그 타입 의존 `contentCrew.ts` 7개만 번들에서 제거됐다.

| 함수 | 운영 버전 변경 |
|------|----------------|
| get-content-detail | 17 → 18 |
| add-to-library | 20 → 21 |
| fetch-episodes | 11 → 12 |
| bulk-register-netflix | 5 → 6 |
| personalized-recommendations | 25 → 26 |
| create-library-share | 3 → 4 |
| get-library-share | 3 → 4 |

- 운영 catalog 읽기 전용 검증 **34/34 통과**: 새 컬럼5·unique2·CHECK4·함수2·트리거1·RLS5·정책15. RPC/트리거 본문 MD5·인수/반환 타입·SECURITY INVOKER·빈 search_path가 승인 SQL과 일치한다. `save_timeline_pin`은 PUBLIC/anon 실행 불가, authenticated 실행 가능이다. 실제 사용자 행을 읽거나 쓰지 않았다.
- 최초 사후 probe는 trigger helper에도 anon 실행 불가를 요구해 **33/34**였다. 승인 SQL은 trigger helper의 PUBLIC 권한만 거두고, Supabase 기본 권한은 anon/authenticated에도 EXECUTE를 부여했다. 이 함수는 `RETURNS trigger`이고 직접 RPC로 호출하는 함수가 아니므로, 최종 probe는 SQL 계약에 맞춰 반환 타입·연결 트리거·INVOKER·본문·PUBLIC 권한을 검사하고 anon 금지 단언은 호출 가능한 핀 RPC에 유지했다. 구현·기존 회귀 단언을 바꾸거나 추가 운영 DDL을 실행하지 않았다. 최초/최종 결과를 모두 보관했다.
- 보안 advisor는 적용 전후 **동일**했다. 기존 service-role 전용 캐시2개의 정책 없음은 [RLS 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), 기존3함수의 [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), `pg_trgm`의 [public 확장](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), `get_genre_stats`/`handle_new_user`의 [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)·[authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) DEFINER 실행, [유출 비밀번호 보호 미설정](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)이다. 이번 승인 범위의 새 finding은 없다. 기존 항목은 이번에 설정을 변경하지 않았다.
- 증거: `/tmp/scenenote-integrity-deployment-report.json`(버전/소스/SQL 비교), `scenenote-integrity-{catalog-initial,catalog-final,migrations,functions-before,functions-after,advisors-before,advisors-after}.json`, `scenenote-integrity-postdeploy-readonly.sql`·`scenenote-integrity-postdeploy-readonly-meta.json`. 배포 전 원본7개는 `scenenote-integrity-backup-<name>.json`, 후보·의존성·SHA는 `scenenote-integrity-candidate-<name>.json`·`scenenote-integrity-candidates-manifest.json`에 보관했다.
- 새 클라이언트는 준비된 DB/서버를 사용한다. 이번 승인에는 프런트엔드 호스팅 배포·네이티브 빌드가 포함되지 않아 수행하지 않았다. 브라우저/실기기·실제 로그인 HTTP와 사용자 기록 저장 검증도 하지 않았다. 위 수동 M-1~M-3은 그대로 남는다.
- `app.config.ts.extra.publicWebOrigin`은 **null**이다. 정식 공개 웹 주소 답변 전까지 임의 도메인·localhost를 설정하지 않는다. 이 설정 전 네이티브 공유는 사용 불가 안내를 표시한다.
- 과거 TMDB 충돌로 이미 잘못 저장됐을 가능성이 있는 데이터는 추정 복구하지 않았다. 별도 읽기 전용 진단과 사용자 확인이 필요하다.

## 라이브러리 1000행 잘림·중복 조회 (docs/72, 2026-11-16)

- 상태: **앱 구현·자동 검사 통과, 실제 화면 미확인.** [72](72_library_row_limit_and_redundant_reads_fixes_spec.md) 14장 순서대로 STEP 0→실패 테스트→구현→검사를 진행했다. 시작 `pwd`·git root는 `/Users/youngilkim/SceneNote`, 기준선 **1668/1668**. `git status`와 기존 작업 파일 SHA를 `/tmp/scenenote-72-start-{status.txt,sha.json}`에 보관해 docs/71과 사용자의 명세·문서 변경을 보존했다. 명세 허용 파일 외에는 사용자 추가 승인을 받은 `scripts/libraryProgressIntegration.test.ts`의 가짜 React export 한 줄만 고쳤다. 브라우저·앱·서버를 열지 않았고 실제 계정 기록·DB·RLS·Edge·전역 Query 설정·secret·배포·마이그레이션·커밋/푸시 변경 없음.
- STEP 0: `normalizeWatchStatuses`는 `wishlist`, `watching`, `completed`, `recommended`, `not_recommended`, `dropped` 6종을 각각 그대로 보존한다(폐기 상태 배열 비어 있음, 실제 순수 함수 실행 확인). `0001_initial_schema.sql:353~359`의 연결 칼럼은 **`pin_id`**, 복합 PK `(pin_id, tag_id)`이며 후속 이름 변경은 없다. 전제 불일치 없음. `/tmp/scenenote-72-step0.log`.
- 구현: `readAllRows`가 1000행씩 끝까지 읽고 원시 페이지 길이로 종료를 판정하며 첫 id를 보존한다. 오류·50쪽 안전 상한에서는 부분 목록을 성공으로 반환하지 않는다. 라이브러리는 `updated_at desc,id asc`, 전체 핀은 `created_at desc,id asc`, 태그 핀은 `pin_id asc`로 안정 정렬한다. 선택 칼럼이 없는 구 스키마는 본 조회의 행을 버리고 폴백을 0쪽부터 다시 읽는다. 저장7곳은 `getSessionUserId`를 공유해 로컬 세션을 읽고 기존 로그인 문구·조용한 인물 보정 반환·공유의 오류 우선·소유자 필드를 유지한다. 회차 방영일은 명세의 빈 날짜 조건에 해당하는 콘텐츠만 조회하며 docs/71의 AniList 종료일 null 보존을 유지했다.
- D-1~D-5 변경 또는 변경 필요사항 없음. D-4의 즉시 빠짐은 명세에 명시된 의도된 변경이다. `useLibrary`만 계정별 전체 캐시+`useCallback` select로 바꾸었으며 mutation·snapshot·무효화 코드는 시작 SHA와 동일하다. 실제 QueryCore fixture로 즉시 빠짐·완료 탭 표시·실패 복구·계정 격리를 확인했다. 서버 필터를 쓰는 `getLibraryItems(status)` 및 공유의 `getLibraryItems("all")` 호출도 보존했다.
- STEP 1 실제 red: **1690개 중1669 통과·21 실패**, 정확히 신규 **T-1~T-21 전부 실패**, **T-22만 처음부터 통과**했다. 실제 출력: `TypeError [Error]: batchedQuery.readAllRows is not a function`, `TypeError [Error]: libraryFilters.filterLibraryItemsByStatus is not a function`, `Cannot find module '…/src/utils/sessionUser'`, `Cannot find module '…/src/utils/libraryAirDates'`. `/tmp/scenenote-72-red.log`, `scenenote-72-red-coverage.json`. 원래 `batchedQuery.test.ts`·`libraryFilters.test.ts`의 모든 줄·단언을 보존했다.
- 최종 검사: **1668/1668 →1690/1690**(신규22), 이어 `npm run typecheck`, `npm run lint` exit0. 기존 Node24.22.2를 명령에만 지정했으며 tsx 로컬 IPC가 sandbox에서 막히는 환경은 이전 작업과 같은 허용된 검사 권한으로 실행했다. 첫 구현 검사에서 기존 통합 테스트의 가짜 React에 `useCallback`이 없어 번들 실패했고, 사용자 승인 후 export 한 줄만 추가했다(기존 단언·시나리오·테스트 수 불변). 연결 select 문자열의 SDK 추론 타입은 서비스의 기존 raw-row 경계에서 명시해 타입 오류도 정정한 뒤 전체 검사를 순서대로 다시 실행했다. `/tmp/scenenote-72-{baseline,red,tests,typecheck,lint}.log`.
- 추가 검사3줄: `auth.getUser` **0줄**, 훅의 `getLibraryItems("all")` **1줄**. 보호 경로 `git status --short supabase src/lib app src/components`는 시작부터 있던 docs/71의 화면·컴포넌트8파일을 그대로 출력하므로 빈 출력이라고 보고하지 않는다. **232개 보호 파일의 시작 SHA 대비 변경0·신규0**을 확인했다(`/tmp/scenenote-72-protected-check.json`). `git diff --check` 통과. `readBatchedRows`·`QueryPage` 및 범위 밖 핀 조회2종도 원형 유지.
- 실제 코드 격리 실행: 라이브러리 서비스61개(0/1000/2500행·중복·구스키마 재시작·중간 오류·50쪽 상한·방영일 대상 및 표시·회차 저장), 실제 핀 서비스+설치 PostgREST builder33개, 실제 훅/QueryCore와 기존 mutation50개, 세션7caller+설치 AuthClient54개 검증 통과. 유효 세션은 fetch0, 만료 세션은 모의 refresh1·`/user`0, 상태6종 전환 추가 조회0, 실패 복구를 확인했다. SDK `.range`의 실제 요청은 Range 헤더 대신 **`offset`/`limit`**이며 0부터 양 끝 포함 범위다. 모든 fetch는 메모리 응답 또는 차단이며 외부 요청0, 실제 운영 감소량/저장 성공의 증거가 아니다. `/tmp/scenenote-72-library-service-report.json`, `/tmp/scenenote-72-pins-fixture/report.json`, `/tmp/scenenote-72-library-cache-report.json`, `/tmp/scenenote-72-sessions-GklNmB/report.json`.

| 수동 ID | 플랫폼 | 확인 상태·사유 |
|---------|--------|----------------|
| M-1 | 웹1440 | **코드 검사 통과, 화면 미확인.** 사용자의 시청을 방해하지 않도록 브라우저를 열지 않았다. 실제 계정 목록 수·순서·Network는 미측정. 모의 서비스의2500행·페이지별 정렬/범위는 확인. |
| M-2 | 웹1440 | **코드 검사 통과, 화면 미확인.** 실제 탭 조작 없음. QueryCore의 단일 캐시·6종 상태 전환 추가 조회0은 격리 확인. |
| M-3 | 웹1440 | **코드 검사 통과, 화면 미확인.** 사용자 계정의 상태를 임의로 바꾸지 않았다. 실제 mutation callback의 즉시 빠짐·실패 snapshot 복구는 격리 확인. |
| M-4 | 웹1440 | **코드 검사 통과, 화면 미확인.** 실제 회차/핀/감상/태그/인물을 저장하지 않았다. 서비스7곳의 소유자 필드·로그인 없음·로컬 세션/갱신은 격리 확인. |
| M-5 | 웹1440 | **코드 검사 통과, 화면 미확인.** 실제 요청·응답 행 수 미측정. 빈 날짜 대상만 조회·대상0이면 episodes0·AniList 종료일 보존은 실제 서비스 fixture 확인. |
| M-6 | 웹375 | **코드 검사 통과, 화면 미확인.** 전체·태그 핀 pagination과 null join은 실제 PostgREST/서비스 fixture 확인, 실제 계정·375화면은 미실행. |
| M-7 | 앱iOS 세로 | **코드 검사 통과, 화면 미확인.** 실기기/시뮬레이터를 실행하지 않았으며 실제 저장·당김 동작 미확인. Android도 실제 화면 미확인. |
| M-8 | 웹1440 | **코드 검사 통과, 화면 미확인.** 실제 로그아웃·다른 탭 저장을 실행하지 않았다. 세션 없음/빈 id/오류의 기존 한국어 안내 및 조용한 반환은 격리 확인. |

- 후속 작업은 실제 계정에서 M-1~M-8의 목록·Network·저장·다중 탭·네이티브 동작 확인이다. **이번 작업의 배포는 없다.**

<details>
<summary>추가 테스트 ID와 실제 이름(22개)</summary>

| ID | 파일 | 이름(`72 T-N:` 뒤) |
|----|------|-------------------|
| T-1 | batchedQuery | reads an empty result once using the default inclusive range |
| T-2 | batchedQuery | reads an empty terminal page after exactly one thousand rows |
| T-3 | batchedQuery | reads all two thousand five hundred rows in input order |
| T-4 | batchedQuery | discards earlier rows when the second page fails |
| T-5 | batchedQuery | keeps the first row per id while paginating by raw page size |
| T-6 | batchedQuery | preserves every row whose key is null, undefined, or empty |
| T-7 | batchedQuery | returns an error instead of a truncated list at the page ceiling |
| T-8 | batchedQuery | rejects invalid page sizes and maximum page counts |
| T-9 | sessionUser | missing sessions, users, or user ids do not identify a user |
| T-10 | sessionUser | a stored session returns its nonempty user id |
| T-11 | libraryFilters | all-status selection preserves the original array reference |
| T-12 | libraryFilters | status selection includes an item with multiple matching statuses |
| T-13 | libraryFilters | all six status filters preserve matching items and their original order |
| T-14 | libraryFilters | status selection returns an empty array for empty or unmatched lists |
| T-15 | libraryAirDates | a TMDB work without an air date needs episode air dates |
| T-16 | libraryAirDates | a TMDB work without an end date needs episode air dates |
| T-17 | libraryAirDates | a TMDB work with both dates skips episode air dates |
| T-18 | libraryAirDates | an AniList work with an air date never infers its missing end date |
| T-19 | libraryAirDates | an AniList work without an air date needs episode air dates |
| T-20 | libraryAirDates | episode air-date targets deduplicate season registrations in first-seen order |
| T-21 | libraryAirDates | complete-date and empty lists have no episode air-date targets |
| T-22 | batchedQuery | preserves the empty-id batch fast path without making a query |

</details>

- docs/71 재검증(2026-11-16): `npm test` 1668/1668, `typecheck`, `lint` 통과, 변경분이 D-1~D-9와 일치. 로그인 뒤 화면은 확인하지 못했다(M-2~M-4, M-7·M-8 미확인 그대로).

## 의미 없는 API 호출 차단·편의성 (docs/71, 2026-11-16)

- 상태: **앱 구현·자동 검사 통과, 수동 확인 일부 남음.** [71](71_meaningless_api_calls_and_usability_fixes_spec.md) 14장 순서대로 테스트를 먼저 썼다. D-1~D-9는 변경하지 않았다. 최종 교차 점검에서 D-3의 데이터 전제 위반을 발견해 보고했고, 사용자가 `src/services/library.ts` 한 파일을 추가 허용한 뒤 보정했다. Edge·DB·전역 Query 기본값은 그대로이며 배포·마이그레이션·커밋/푸시 없음. 시작 시 `pwd`·git root는 `/Users/youngilkim/SceneNote`; 기존 변경은 `AGENTS.md`, `docs/README.md`, `docs/development_next_steps.md`와 미추적 명세71이었다. 해당 변경을 보존하고 명세 허용 파일과 추가 승인 파일만 수정했다.
- 구현: `needsReleasedEpisodeLookup`에 1~200화 판정을 모아 상세의 불필요한 공개 회차 조회를 막는다. 카드 조회는 Kitsu 제외·완결 AniList만 앱 확정·나머지 서버 조회로 나누며, 총 화수 미정 작품은 30분 갱신을 유지한다. 전 회차 공개가 확인된 시즌만 주기 재조회를 멈춘다. 지정 7개 Edge 조회의 자동 재시도·창 복귀·재연결 재조회를 끄고 기존 `MANUAL_METADATA_QUERY_OPTIONS`를 보존했다. 홈·라이브러리·핀의 네이티브 당겨서 새로고침은 DB 조회만 실행하며 중복 당김·실패·언마운트를 처리한다. 라이브러리 최초 실패 시 오류와 빈 상태가 동시에 나타나지 않게 했다.
- 화면: 지정된 개발 용어 5곳을 교체하고, 총 화수 미정 단일 시즌은 실제 공개 회차를 분모로 진행 막대를 표시한다. 저장9/공개7은 요약9·막대7, 다중 시즌은 누적 단위를 보존한다. 숫자 입력 중 공개 목록이 도착해도 NaN을 표시하지 않는다. RN-web이 `accessibilityValue`를 DOM으로 전달하지 않는 것을 실제 화면에서 확인해 표준 `aria-valuemin/max/now`도 함께 지정했다.
- 추가 승인 보정: 기존 `enrichLibraryMetadata`는 종료일이 null이면 최근 회차의 방영일로 채웠다. 새 완결 판정에 이 값을 넣으면 총12화가 알려진 방영 중 AniList가 공개7화만 있어도 `local released12`로 고정된다. 실제 서비스→조회 계획 경로로 red를 먼저 재현한 뒤, AniList만 원본 종료일(null 포함)을 보존하도록 한 곳을 고쳤다. 진행 AniList는 remote, 실제 완결일이 있는 AniList는 local12, TMDB·TVmaze는 기존 날짜 보완 유지의4분기를 실제 변경 소스로 확인했다(외부 요청0). `/tmp/scenenote-docs71-anilist-enddate-{before-after,actual-after}.json`. 명세 D-2~D-4를 바꾼 것이 아니라 입력값의 출처 전제를 보장한 보정이다.
- STEP 1 실제 red: 전체 1668개 중 1633 통과·35 실패. 신규 **T-1~T-33 전부 실패**, **T-34만 처음부터 통과**했고, 지정 문구를 바꾼 기존 테스트 2개도 실패했다(변경 단언 3개). 실제 출력은 `TypeError [Error]: choiceContract.needsReleasedEpisodeLookup is not a function`, `actual: 'API 공개 회차 3개 · 최근 3화 · 총 화수 미정' / expected: '공개된 회차 3개 · 최근 3화 · 총 화수 미정'`, T-33 `actual: undefined / expected: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }`. `/tmp/scenenote-71-{red,focused-red}.log`, `scenenote-71-red-coverage.json`에 기록했다.
- 최종 검사: 시작 **1634/1634** → 최종 **1668/1668**(신규34, 기존 개수·보존 단언 유지), 이어서 `npm run typecheck`, `npm run lint`, `npm run build` 모두 exit0. 기본 Node의 dylib 문제를 피해 기존 Node24.22.2를 명령에만 지정했고, `npm test`의 tsx IPC가 sandbox EPERM으로 막힌 뒤 허용된 검사 권한으로 실제 명령을 실행했다. 웹 export는 `dist` 생성 후 Expo의 종료 지연 안내가 있었지만 exit0이었다. `/tmp/scenenote-71-{baseline,tests,typecheck,lint,build}.log`.
- 추가 검사 4줄: `EDGE_LIST_QUERY_OPTIONS` 13줄(정의1+import6+사용6), 대상 3파일의 API는 기존 주석1줄만/사용자 문구0, 검색의 `외부 API` 0줄, `git status --short supabase` 빈 출력. `src/lib/query.ts` diff와 공백 오류도 없음. **수정한 UI 줄의 원문 색·숫자 폰트·Alert 호출은0**이다. 파일 전체 검사에는 HEAD부터 존재하던100줄(라이브러리25·핀2·검색37·진행카드16·공유20)이 남아 있어 전체0이라고 보고하지 않는다. 신규 일치0을 HEAD와 대조했으며, 이번 명세의 무관한 스타일/Alert 정리 금지에 따라 보존했다(`/tmp/scenenote-71-ui-token-check.json`).
- 격리 실행: 실제 훅+QueryObserver 공개 회차49개, 실제 목록 훅+QueryCore/pull72개, 실제3탭 TSX/pull92개, 진행 카드 React82개와 실제 RN-web DOM18개 검증 통과. 알려진 화수 조회 비활성·미정 공개7→8 갱신 시 저장선택7 유지·자동 저장0·settled 주기 중단·검색3쪽 focus/reconnect0·수동 재조회·실패1회·스피너/동시잠금·DB만 갱신·오류 시 기존 목록 보존을 확인했다. 이 fixture는 원격 호출·실기기 제스처의 증거가 아니다. `/tmp/scenenote-docs71-airing-observer-FR06hB/report.json`, `/tmp/scenenote-docs71-{hooks,screens}-report.json`, `/tmp/scenenote-71-progress-qa/result.json`, `/tmp/scenenote-71-progress-rnweb-qa/result.json`.

| 수동 ID | 플랫폼 | 실제 확인 / 미확인 사유 |
|---------|--------|------------------------|
| M-1 | 웹1440 | 기존 로그인 세션의 템빨(총12화) 상세 진입·새로고침 후 공개 회차 queryFn 추가 실행0, 1~12화 버튼·저장7 유지 확인. 임시 DEV 관측으로 호출 진입을 확인했으며 raw Network 건수는 별도 미수집. 관측 코드는 제거하고 원본 SHA 일치 확인. |
| M-2 | 웹1440 | **코드 검사 통과, 화면 미확인.** 완결 AniList 조건을 확정한 계정 카드로 실측하지 않았다. local 경로·남은7 표시·서버/시즌 조회 비활성은 실제 훅 fixture로 확인. |
| M-3 | 웹1440 | 검색 `사랑` 1·2·3쪽 호출까지 확인. **코드 검사 통과, 6분 후 창 복귀 화면 미확인.** 사용자가 넷플릭스 시청 중 검증 창 종료를 요청해 대기 검증을 중단하고 탭을 닫았다. 가상 시간 QueryCore의 stale3쪽 focus/reconnect 추가0·기존 데이터 보존은 별도 확인. |
| M-4 | 웹1440 | **코드 검사 통과, 차단 후 실제 화면 미확인.** 브라우저 요청 차단은 실행하지 않았다. 실제 QueryObserver fixture의 실패1회·수동 재시도는 확인. |
| M-5 | 웹375 | 전생 귀족3기: 실제 공개1~8화, `7 / 공개 8화`, `공개된 회차 8개 · 최근 8화 · 총 화수 미정`, 저장된7화 파란 선택·저장 비활성 유지. 막대88%, DOM ARIA min0/max8/now7. 문서폭375=화면폭375, API 문구 없음. `/tmp/scenenote-71-web-qa/progress-375.jpg`. |
| M-6 | 웹375 | 검색 실제 부분 실패의 지정 안내 문구 확인. 인물 탭 부분 실패·에피소드 빈 상태는 **코드 검사 통과, 화면 미확인**(해당 상태를 실제 계정에서 만들지 않음). |
| M-7 | 앱iOS 세로 | **코드 검사 통과, 화면 미확인.** `xcrun simctl` 실행 도구 없음. 네이티브 props·중복/실패/언마운트·태그 핀 분기·기존 데이터 유지는 React 격리 실행으로 확인했으며 실기기 당김 동작은 별도 확인 필요. Android도 실제 화면 미확인. |
| M-8 | 앱iOS 세로 | **코드 검사 통과, 화면 미확인.** 실기기/시뮬레이터 환경 부재로 글자1.3배·안전 영역·실제 폰트 잘림을 확인하지 못함. |

- 브라우저 QA는 대신 로그인하지 않고 기존 Chrome 세션을 사용했으며 감상·상태·등록·진행 저장 버튼은 누르지 않았다. 새 회차가 늘어도 저장된7화가 그대로임을 확인했다. viewport 복원 후 검증용3탭을 모두 닫았고, 이번 검증을 위해 시작한8081 Expo 프로세스(PID3369, 실행 명령 확인)만 종료했다. Safari·넷플릭스 탭은 직접 조작하지 않았지만 사용자가 시청 화면 꺼짐을 보고해 브라우저 검증을 종료했고 이후 재접속하지 않았다. Safari 실동작은 미확인이다. 원시 관측은 `/tmp/scenenote-71-web-qa/manual-results.json`이며 임시 관측 로그는 제품 코드에 남기지 않았다.
- 후속 작업: M-2~M-4, M-6 남은 상태, 실제 iOS/Android M-7~M-8만 확인한다. 기존 UI 토큰/Alert100줄의 전체 정리는 별도 범위다. **이번 작업의 배포는 없다.**

<details>
<summary>추가한 테스트 ID와 실제 이름(34개)</summary>

| ID | 파일 | 실제 테스트 이름 |
|----|------|------------------|
| T-1 | contentDetailView | known season and total counts do not need a released-episode lookup |
| T-2 | contentDetailView | unknown season and total counts need a released-episode lookup |
| T-3 | contentDetailView | counts above the choice limit still need released episodes |
| T-4 | contentDetailView | zero, fractional and negative counts need released episodes |
| T-5 | contentDetailView | the nullish fallback and the one-to-two-hundred boundaries avoid lookup |
| T-6 | contentDetailView | the lookup predicate and count choice mode always use the same eligibility |
| T-7 | contentDetailView | unknown-total released copy uses user-facing wording |
| T-8 | contentDetailView | released copy with a known large total omits the unknown-total hint |
| T-9 | contentDetailView | manual-entry copy explains the missing count without developer terminology |
| T-10 | contentDetailView | a known total keeps the existing progress summary and denominator |
| T-11 | contentDetailView | a single unknown-total season uses its latest published episode |
| T-12 | contentDetailView | no watched episodes produces an empty published-episode bar |
| T-13 | contentDetailView | multi-season cumulative progress does not use a season-local denominator |
| T-14 | contentDetailView | manual mode without published episodes keeps its unbounded summary |
| T-15 | contentDetailView | saved progress beyond the published frontier does not overflow the bar |
| T-16 | airingAvailability | skips completed works, movies, and unset progress |
| T-17 | airingAvailability | skips Kitsu availability requests |
| T-18 | airingAvailability | resolves completed AniList seasons locally with all episodes released |
| T-19 | airingAvailability | treats the AniList completion date as local on the same KST day |
| T-20 | airingAvailability | remotely checks AniList seasons with a future completion date |
| T-21 | airingAvailability | remotely checks ongoing AniList seasons without a completion date |
| T-22 | airingAvailability | remotely checks completed AniList seasons whose episode count is unknown |
| T-23 | airingAvailability | remotely checks AniList seasons with a malformed completion date |
| T-24 | airingAvailability | never infers TMDB or TVmaze completion from a past end date |
| T-25 | airingAvailability | remotely checks legacy items without a source API |
| T-26 | airingAvailability | shows seven unwatched released episodes from the local completed-season result |
| T-27 | airingAvailability | settles a known season when every episode is released and no next date remains |
| T-28 | airingAvailability | keeps refreshing when a known season still has unreleased episodes |
| T-29 | airingAvailability | never settles a season with an unknown final episode count |
| T-30 | airingAvailability | keeps refreshing when a next airing date remains |
| T-31 | airingAvailability | does not settle without an availability response or a released episode number |
| T-32 | airingAvailability | uses the KST calendar date across the UTC midnight boundary |
| T-33 | metadataQuery | Edge 목록 조회는 자동 재시도·창 복귀·재연결 재조회를 하지 않는다 |
| T-34 | metadataQuery | 보존: 공개 메타데이터의 기존 수동 갱신 정책을 유지한다 |

</details>

## 작품 상세 출연진 확인 후 등록 (2026-11-15)

- 사용자 요청으로 `CastSection`은 모든 배우·성우를 누르면 인물 상세로만 이동한다. 작품 상세의 직접 등록 callback/mutation과 전체 카드 pending 잠금을 제거하고 안내·접근성 라벨을 수정했다. 인물 상세 이름 옆에 `좋아하는 인물에 등록` 버튼을 추가했다. 서버 상세의 분류·이름·한글 표기·출연작을 기존 등록 훅에 전달하며, 등록 여부 조회·실패·기등록·진행 중 차단과 동기 중복 잠금을 적용했다. 조회 실패 시 재확인, 등록 실패 시 한국어 토스트로 재시도 가능하다. 검색 칩·인물 탭 등록 동작은 유지한다.
- Node 기본 실행기가 simdjson dylib 누락으로 시작되지 않아 기존 설치 Node 24.22.2를 명령에만 지정했다. typecheck·lint·diff 검사 통과. `npm test`는 sandbox의 tsx IPC listen EPERM으로 시작하지 못해 동일 파일 범위를 `node --import tsx --test`로 실행했다. 전체 1633/1634 통과, 추천 제공처 deadline 20ms 타이밍 테스트 1개 실패(변경 영역 밖); 해당 파일 독립 재실행 통과. 관련 peopleScreen/personCredits/personKoreanName/contentDetailView 테스트 88/88 통과. 새 순수 로직 없이 기존 상세 이동·등록 훅을 연결한 UI 변경으로 테스트 파일을 추가하지 않았다.
- 기존 8081 서버·로그인 세션에서 실제 작품 `보스의 노골적 취향`: 미등록 성훈을 눌러 프로필·소개·출연작·활성 등록 버튼 표시, 뒤로 돌아와 성훈은 여전히 미등록임을 확인했다. 기존 등록 오세영은 상세에서 `등록됨` 비활성 버튼 확인. 웹 375/768/1440에서 가로 넘침 없고 375에서 버튼·프로필 확인. viewport 복원. 증빙 `/tmp/scenenote-person-preview.jpg`.
- 사용자 좋아하는 인물 기록을 임의로 추가하지 않아 신규 버튼의 실제 DB 저장·실패·연속 누르기 및 성우 실사례는 미검증(기존 훅·출처/분류 순수 회귀로 정적/자동 확인). iOS/Android 실기기·글자 1.3배·스크린리더는 환경 부재로 미검증이다. Supabase 스키마·Edge 변경/배포·커밋/푸시 없음. 기존 다른 세션 변경은 보존했다.

## 웹 갤러리 6개 비교·작품 정보 확대 (2026-11-15)

- 앞선 12개 동시 보기 후 포스터와 정보가 작다는 사용자 피드백으로 넓은 웹을3열·2행 비교 구성으로 바꿨다. `getSearchGalleryLayout`이 공용960구간과 글자 배율로 정보형 표시를 정하고, 이전 열 함수는 좁은 웹·앱에서 그대로 사용한다. 추천/제목 검색 포스터96×144(기존 대비 면적2.25배), 출연진2명·줄거리·장르를 표시하고 추천에는 OTT·추천 이유도 표시한다. 추천 버튼은 한44pt 행으로 묶고, 실제 정보가 없는 항목은 기존 상태 안내를 유지한다. 조회·보충의12개 묶음은 유지한다. 표시 계약은 [28 후속 요청](28_recommendation_scroll_pagination_fixes_spec.md#웹-정보형-갤러리-후속-요청-2026-11-15).
- 실제 Chrome8081 기본1496×759에서 첫6개가3열·2행으로 표시된다. 카드373×255px, 첫 행164~419, 둘째 행427~682로 하단 탭690px 위에 전부 보인다. 포스터96×144, 카드 내44pt 미달 행동0건. 웹960도3열·카드293px·가로 넘침0·44pt 미달0,375는 기존2열·문서 폭375px을 확인했다. 제목 검색 “진격의 거인”의 큰 포스터·성우·줄거리·장르도 확인했다. QA 검색어와 viewport를 원래 상태로 복원한다. 증빙 `/tmp/scenenote-search-gallery-six-info-desktop.jpg`.
- 기존1630개에 반응형 회귀4개를 추가해 최종1634/1634, typecheck·lint·diff 검사 통과. 새 함수 테스트4개는 구현 전 missing function으로 실패했고, 기존 열 함수 테스트는 유지했다. 웹/앱 분리,960/1280구간,1.3배 글자·잘못된 폭/배율을 검사한다. 카드·스켈레톤의 원문 색/폰트 숫자/Alert 검사0줄. iOS/Android 실기기·네이티브1.3배 글자 수동 검증은 실행 환경이 없어 미실행이다.

## 검색 갤러리 12개 동시 보기 (2026-11-15)

- 사용자 요청으로 검색 갤러리의 검색 제목·입력, 보기 전환·필터 요약, 추천 제목·행동을 압축하고 최근 검색어·예시는 기본 접힘으로 바꿨다. 추천/제목 검색 카드에 64×96 포스터와 메타데이터를 나란히 두고 배우·성우 최대 2명, 44pt 행동 버튼을 유지한다. 추천 줄거리·장르·이유는 기존 빠른 보기에서 확인한다. 배치 수집·등록·identity 잠금에는 변경이 없다. [28 후속 변경](28_recommendation_scroll_pagination_fixes_spec.md#갤러리-밀도-후속-변경-2026-11-15), [08 화면 구성](08_frontend_architecture.md#검색-갤러리-밀도-2026-11-15).
- 실제 Chrome 8081, 기본 화면 1496×759에서 6열·2행의 카드 12개가 추가·완료 버튼까지 보인다. 카드 높이243px, 첫 행 y168~411, 둘째 행 y427~670, 하단 탭 시작 y690(홈 버튼 y697). 1440×900도 12개 전체 노출을 확인했다. 375·768에서는 각각2·3열이며 문서 폭과 화면 폭이 같고, 375의 추천 행동 버튼 높이는 전부44px 이상이었다. 최근·예시 펼침/접힘, 실제 “진격의 거인” 제목 검색 갤러리의 성우·출처·행동 표시와 빠른 보기의 줄거리·장르·추천 이유 노출을 확인했다. 입력값은 빈 검색으로, 임시 viewport는 원래 크기로 복원했다. 증빙 `/tmp/scenenote-search-gallery-12-desktop.jpg`, `/tmp/scenenote-search-gallery-mobile.jpg`.
- 기준선·수정 후 `npm test`1630/1630, 전체 typecheck·lint·diff 검사 통과. 카드·공용 스켈레톤의 원문 색/폰트 숫자/Alert 검사0줄. 레이아웃/표시만 변경해 새 순수 함수 테스트는 추가하지 않았다. tsx IPC 소켓이 sandbox에서 EPERM으로 막혀 허용된 테스트 실행으로 검증했다. 기존8081 서버를 재사용했다. 실기기 iOS/Android·1.3배 글자 검증은 환경이 없어 미실행이며 `xcrun simctl`도 없다. 운영 배포·서버/DB 변경은 이번 작업에 포함하지 않았다.

## 최신 추천 수집 순서·546 CPU 오류 (2026-11-15)

- 사용자 신고: 빈 검색·국가 JP/KR에서 24개 안에 1981년 작품이 나오고 다음 요청 HTTP546. [70 명세](70_latest_recommendation_catalog_and_cpu_fixes_spec.md)에 최신 수집 계약과 보존/대체 범위를 기록했다. 기존 전체 표시 정렬만으로는 최근 월이 남았는데 전 기간 인기 취향 보충을 하는 서버 정책을 고치지 못했다. 실제 v23의 17:58~17:59 KST 546 세 건은 CPUTime 종료(2092/2260/2098ms)였다. 증거 `/tmp/scenenote-latest-feed-production-cpu-before.json`.
- 서버: 명시적 `discovery_mode:latest`에서만 인기 취향 보충/선조회 0회. 현재 공개일부터 월별 공급자·내부 native/keyword/genre 질의를 실제 공개일 순으로 병합하고, 각 page/raw offset과 미반환 후보를 `lc1`에 보존한다. 계정·조건 scope와 페이지 fingerprint로 구커서/조건 변경/검사 중인 페이지 변경은409로 구별한다. 키워드 미확인 head와 공급자 실패는 건너뛰거나 소진 처리하지 않는다. 공급자 base page의 OR lane은 10분 DB 캐시·진행 중 요청을 공유한다. 이미 넘긴 과거 페이지/월 전체를 재조회하지 않는 snapshot 한계는 명세13장에 적었다. 기존 mixed 모드와 등록/국내 OTT/테마 제외는 유지한다.
- CPU: 라이브러리 context를 요청당 한 번 준비하고 프로필·여러 scan round·순위·이유가 재사용한다. 후보 신호도 한 번 계산한다. 원본과 무작위120조합의 프로필/순위/묶음 **360개 깊은 비교 일치**, 로컬 Deno 100후보/660라이브러리 전체계산 **460.859→28.981ms**, 5000개 **8406.693→180.796ms**. 운영 지연 보장이 아닌 로컬 비교다. context 회귀는 660개/3round의 feature읽기가 준비 후4620회 그대로 유지됨을 확인했다(원본23100회). 증거 `scenenote-recommendation-cpu-audit-6aoakzfn/comparison-report.json`, `scenenote-catalog-context-regression-clpmvbw9/report.json`(시스템 임시 폴더 아래).
- 앱: latest 요청/응답 확인과 `latest-catalog-v1` Query namespace. 구 정책 응답은 자동 반복을 막고, invalid cursor는 null cursor의 “처음부터 다시 찾기”로 복구한다. 정상 새 추천12개는 기존 다음 묶음 동작이다. 실패 시 기존 카드/추가됨 snapshot을 보존하고 오류와 “모두 확인” 문구의 동시 노출을 막았다. 546은 고정 한국어 처리 오류로 표시한다. 시간/키워드 확인 보류는 테마 확인 안내로 표시하며 `failed_sources`가 있을 때만 제공처 실패 문구를 표시한다.
- 검사: 기존 dirty 상태·pwd·git root와 **1580/1580** 기준선(`/tmp/scenenote-recent-feed-baseline.log`) → 최종 **1630/1630**(신규50), 타입·린트·웹 export·Edge16개 Deno check·추가 UI 줄의 Alert/색상원문0·diff 공백 검사 통과. 신규 최신 catalog25·provider4·CPU4·legacy context1·앱 정책/복구/완료16행을 추가했고 핵심 회귀 선행red 기록을 보존했다. `/tmp/scenenote-latest-{tests,typecheck,lint,build}.log`, `scenenote-latest-deno.json`. 실제 앱 서비스/Query fixture42개는 12→24→36·실패기존36보존·재시작성공교체·구정책자동반복0·계정/필터 격리를 원격0회로 확인했다(`/tmp/scenenote-latest-client-harness-report.json`).
- 실제 핸들러 fixture **99개 검증**: 실제 Deno handler/인증 requireUser/최신 catalog/엔진을 실행하고 DB·provider 경계만 fixture로 대체했다. 인증401·JP/KR OR·12→24→36 전체 날짜순·tastefill/선조회0·660행 context요청당1회·구cursor/계정/조건409·유형/장르 OR6조합·partial/keyword보류 재개·노출기록 소유자/12상한/실패 경계를 확인했다. 최종 v25 후보의 JSONB 중첩 키 재배열·구 fingerprint 정책 거절까지 포함했고 소스 SHA4개 일치를 확인했다. 실제 네트워크0회이며 운영 성공 검증과 구분한다. `/tmp/scenenote-latest-handler-x5f43V/report.json`. 별도 실제 provider/module의 메모리 cold 재개도 fixture DB 캐시를 읽어 HTTP0회를 확인했다(`scenenote-latest-cold-cache-review-i49fsom9/report.json`).
- 웹375 사전 검증: 기존 로그인 화면에서 구정책 오류와 보존 snapshot2개가 있어도 완료 문구가 나타나지 않으며 문서 폭375px=화면 폭375px. 실측41.5px였던 공용 ErrorState 재시도 버튼을44px로 고치고 확인했다. `/tmp/scenenote-latest-before-deploy-mobile.jpg`. 실기기 iOS/Android·큰글자·스크린리더는 환경이 없어 미실행이다.
- 운영 반영: 앱 URL/CLI 연결 프로젝트 `pstkeooflscvtaxxrwdf` 일치 확인, 사용자 단일 함수 승인 후 `personalized-recommendations`만 **v23→v24→v25 ACTIVE·verify_jwt=true**로 반영했다. 원본/함수 목록 `/tmp/scenenote-latest-personalized-production-before.json`, 최종 후보22파일(runtime20)/SHA `/tmp/scenenote-latest-deploy-{candidate,sha}.json`. 내려받은 runtime20개 실행 코드가 후보와 모두 같고 다른 운영 함수14개 버전/상태/JWT 불변·무인증 POST401을 확인했다. `/tmp/scenenote-latest-{deployment-verification,deployed-source-verification}.json`. DB 스키마·RLS·secret·등록/감상/진행/핀 기록은 바꾸지 않았으며 정상 추천 조회의 공개 캐시·노출 기록 저장은 기존대로 실행됐다.
- 운영 중 추가 결함 정정: v24의 첫12개 뒤84초 후 추가 요청에서409를 실제 재현했다. PostgreSQL JSONB가 `external_ids`/themes의 중첩 객체 키 순서를 바꾸는 것을 페이지 변경으로 오인했다. v24 원본20소스+키 순서를 재배열하는 DB fixture에서 red를 재현한 뒤, 객체 키만 재귀 정렬한 canonical JSON 해시로 고쳤다(배열 순서/값 변경은 여전히409). `fingerprintPolicy:jsonb-canonical-v1`을 추가해 v24 cursor는 명시 재시작하고 공급자 캐시 버전은 유지해 외부 재조회 비용을 늘리지 않았다. 신규3회귀 red→green, 전체1630 재검증·변경 핸들러 Deno 재검증 통과. `/tmp/scenenote-latest-jsonb-{red,policy-red,green,deno}.log`, `scenenote-latest-cold-cache-review-i49fsom9/report-jsonb-{v24-red,fixed-green}.json`, 운영 DB 키 순서 증거 `/tmp/scenenote-latest-jsonb-proof.json`.
- 운영 웹 최종 확인: 기존 로그인 계정·JP/KR·제외3개로 별도 검증 탭에서 v25 **12→24→36**. 가상화된 행을 위치 순서로 따라 읽어36개 전체 **2026.11→2026.07 내림차순**을 확인했다(`/tmp/scenenote-latest-ui-observations.json`). 첫 묶음은7+5, 후속은11+1·3+9개를 bounded continuation으로 채웠으며 각 응답의 tastefill/선조회0·등록작품 숨김·기존 DB cache hit를 확인했다. 요청마다 즉시12개 응답을 보장한 것은 아니다. 기존 사용자 화면도 새 추천 행동으로 이전 정책 오류가 사라지고2026.11 작품7개와 아래 스크롤 이어 찾기 안내로 복구됐다. 등록/완료 버튼은 누르지 않았다.
- 운영 로그/플랫폼: 18:48~18:55 KST 관측에서 v25 CPU34~243ms·종료원인EarlyDrop,546/409없음(`/tmp/scenenote-latest-v25-production-logs.json`); 브라우저 실제응답 `/tmp/scenenote-latest-v25-browser-responses.json`. 네트워크/공급자 상황에 따라 응답은 수 초 걸릴 수 있으며 로컬 CPU 비교나 이 관측이 모든 향후 요청의 지연 보장은 아니다. 웹375/768/1440에서 문서 폭=화면 폭·44px 갱신 버튼·날짜 순서를 확인했다. `/tmp/scenenote-latest-deployed-{desktop,tablet,mobile}.jpg`는36개 QA 화면, 최종 안내 정리 후 실제 사용자 화면 `/tmp/scenenote-latest-user-recovered-desktop.jpg`. QA 탭/viewport는 정리했고 기존 로그인·검색/필터를 보존했다. iOS/Android 실기기·큰 글자·스크린리더 검증은 환경이 없어 남는다. 커밋/푸시는 요청하지 않아 수행하지 않았다.

## 공개 메타데이터 DB 재사용·수동 갱신 (2026-11-15)

- 사용자 요청: 보러가기와 “한 번 저장해두면 계속 사용 가능한” 전체 API 결과를 점검해 DB 재사용하도록 보완. [69 명세](69_persistent_public_metadata_cache_fixes_spec.md)에 16개 Edge 경로·DB CRUD/Auth 분류와 후속 계약을 기록했다. docs/54의 1시간/Jotai 정책·docs/11의 상세 10분은 이 공개 메타데이터 범위에서 대체하며 시즌 정확성·동적 공개 회차·사용자 기록 갱신은 보존한다.
- 저장: `persistentMetadataCache`가 기존 service-role 전용 `external_search_cache`를 namespace/version별로 읽고 정상 결과를 `expires_at:'infinity'`로 저장한다. OTT·작품 상세(cast/crew/줄거리/시즌)·인물 상세가 대상이다. 정상 empty/미확인도 재사용한다. DB read 실패를 외부 호출로 우회하지 않고, 외부/저장 실패와 잘못된 응답은 정상 empty로 저장하지 않는다. 명시 `force_refresh:true`에서만 갱신한다. 같은 isolate의 진행 중 호출만 공유하며 글로벌 최초 1회 보장은 아니다.
- 공유: 작품 상세·추천 출연진·빠른 보기·핀 현지화 직접 서비스가 같은 앱 Query를 사용하고 신규 등록/bulk도 직전 상세 snapshot을 재사용한다. 등록된 작품의 필수 contents mirror가 성공한 뒤 공유 cache를 저장하며 cache hit 때 메타데이터 쓰기·회차 선조회는 0회다. 인물은 분류/이름 해석/검색 보정/상세가 같은 TMDB raw 프로필을 공유하고, AniList 단건 이름도 저장한다. 자동 이름/분류/검색 보정의 프로필은 30일 뒤 필요할 때 재확인한다.
- 앱: Jotai 보러가기 캐시를 TanStack Query로 이관, 공개 상세 캐시 Infinity stale/24시간 GC. 데이터/오류가 있으면 자동 query를 비활성화해 mount/focus/reconnect/넓은 invalidate도 재요청하지 않는다. 정상 제공처에도 44px 다시 불러오기·마지막 확인 시각, 갱신 중/실패에는 기존 데이터 유지. 작품/인물 정보에도 수동 갱신을 제공한다. 메모리 hit는 Edge 0회, 앱 재시작/GC 뒤 첫 호출은 인증된 Edge→DB 1회·외부 0회다. 기기 영속 저장이나 전체 카탈로그 사전 수집을 구현한 것은 아니다.
- 교차 검토 보완: 미등록 때 받은 content_id 없는 앱 캐시도 최신 라이브러리 source/ID·영화/TV·시즌으로 등록/삭제를 반영한다(MCACHE-1~2). 인물 첫 실패의 재시도도 force로 복구한다. TMDB 직접 OTT cache의 tmdb_id/season 불일치는 거절하며 AniList의 검증된 다른 시즌 번호 매핑은 유지한다. AniList 필수 출연작 페이지의 GraphQL 오류/누락은 부분 성공으로 영구 저장하지 않는다. 나이는 저장 생일/사망일에서 계산하고, 저장 raw 프로필이 갱신되면 인물 상세 cache hit도 분류/한글 이름만 DB peek로 다시 계산한다(외부 0회).
- 기준선/검사: 작업 시작 pwd·git root·기존 dirty 상태 확인, `npm test` **1529/1529** → 최종 **1580/1580**(신규 51개). 공용 helper 15·콘텐츠 9·공유 인물 프로필 15·인물 snapshot/나이 5·watch 정책 5·등록 반영 2개다. 캐시/강제 갱신·중첩 검증·30일 경계·오류 보존·등록 반영은 선행 red를 확인했고 DB adapter 부가 2개는 구현 후 검증이다. 기존 TTL 기대 2개만 사용자 수동 갱신 계약에 맞게 변경했고 시즌/공개 회차 회귀는 보존했다. 타입·린트·웹 export·Edge **16개 Deno check**·추가 UI 줄 토큰/Alert 0줄·diff 검사 통과. Node 24.22.2 사용. 로그 `/tmp/scenenote-api-cache-{baseline,tests,typecheck,lint,build}.log`, `scenenote-api-cache-deno.json`, `scenenote-api-cache-final-deno.log`.
- 실제 코드 fixture(네트워크 0회): watch handler **18개 시나리오**, content handler **31개 검증**, person handler **18개 시나리오**, 공유 profile 4개 handler **15개 시나리오**. 실제 Query/서비스 경계는 watch **39개**, person **35개**, content service **17개**·hook **13개** 검증. fixture DB/API만 대체했으며 실제 운영 성공 검증과 구분한다. 증거: `/tmp/scenenote-{watch,person}-client-harness-report.json`, 임시 폴더 `scenenote-watch-persistent-handler-vr3pwoy7/report.json`, `scenenote-content-cache-handler-18me00mz/{report,service-report,hook-report}.json`, `scenenote-person-cache-handler-t6awv9st/report.json`, `scenenote-person-provider-handler-0mwbh7va/report.json`(모두 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/` 아래). 각 red/green 로그는 해당 이름의 `/tmp/scenenote-*` 파일에 보존했다.
- 웹 M-1/M-2: 기존 Expo 8081 재사용, 실제 WatchProviderList에 고정 공개 fixture만 넣은 격리 화면에서 375/768/1440px의 갱신 중·실패 후 기존 제공처 유지, 시즌 표기·마지막 확인 시각·44px 버튼·진행 중 비활성·가로 넘침 없음을 확인했다. 증빙 `/tmp/scenenote-metadata-cache-{refreshing-mobile,failed-mobile,failed-desktop}.jpg`. 임시 QA route·탭·viewport는 제거/원복했다. 운영 DB 재사용을 브라우저에서 확인한 증거는 아니다. M-3 iOS/Android 실기기·큰 글자·스크린리더와 실제 계정의 강제 갱신은 미실행이다.
- 원격 읽기 전용 확인: 연결 프로젝트 `pstkeooflscvtaxxrwdf` 일치, 기존 cache unique key·RLS enabled·클라이언트 read policy 없음·infinity timestamp 지원을 실제 SQL로 확인했다. 스키마/RLS/secret/감상·진행·핀 기록은 변경하지 않았다. 기존 crew/name_ko 컬럼 미적용 상태도 확인했으며 기존 best-effort/미적용 fallback은 보존한다. 이번 공개 snapshot 저장에는 이 컬럼들이 필요하지 않다.
- **운영 반영 완료(사용자 8개 함수 승인 후)**: `get-watch-providers` v5→v6, `get-content-detail` v16→v17, `get-person-detail` v11→v12, `add-to-library` v19→v20, `bulk-register-netflix` v4→v5, `classify-people` v1→v2, `resolve-person-names` 신규 v1, `search-person-content` v7→v8이며 모두 ACTIVE·verify_jwt=true다. 나머지 운영 함수 7개 버전/상태/JWT는 불변이다. 배포 후 내려받은 8개 함수의 실행 의존 소스 74개(함수 간 중복 포함)는 검증한 후보와 실행 코드 SHA가 모두 같고 타입 전용 의존 13개는 정상 제거됐다. 무인증 POST는 대상 8개 모두401이다. 증거 `/tmp/scenenote-metadata-{deployment-verification,deployed-source-verification,unauthenticated}.json`. 대상 8개는 `get-watch-providers`, `get-content-detail`, `get-person-detail`, `add-to-library`, `bulk-register-netflix`, `classify-people`, `resolve-person-names`, `search-person-content`다. 기존 버전은 각각 v5/v16/v11/v19/v4/v1/미배포/v7이며, `resolve-person-names`는 기존 앱 호출 경로가 있지만 운영에 없어 신규 배포 대상이다. 운영 함수 7개 소스 백업과 미존재 결과 `/tmp/scenenote-metadata-deploy-backups.json`, 검증한 후보와 파일 SHA `/tmp/scenenote-metadata-deploy-{candidate,sha}.json`을 준비했다. 사용자 승인에 따라 위 8개만 적용했으며 다른 함수·DB schema·secret은 포함하지 않았다. 각 함수는 해당 공용 의존 소스를 함께 묶으므로 기존 미배포된 제작진/오류 정제 등 의존 코드도 검토 대상이다.


- 운영 실제 로그인 웹 확인: 사용자가 신고한 메리 베리 러브(TMDB305551)를 별도 QA 탭에서 열어 작품 상세/OTT `from_cache:false`와 DB 영속 행 생성, 완전히 새로운 탭에서 두 응답 모두 `from_cache:true`·같은 마지막 확인 시각을 확인했다. 에피소드 화면→상세 복귀에도 추가 metadata 요청은 없었다. 시청 정보 다시 불러오기를 한 번 누르면 기존 디즈니+를 유지한 채 요청1회가 완료되고 `from_cache:false`·새 확인 시각으로 바뀌었다. 지창욱(TMDB1253391) 인물 상세도 최초 저장 후 새 탭에서 `from_cache:true`, 58개 출연작·저장 생일로 계산한39세를 표시했다. 실제 DB의 OTT/작품/raw인물/인물상세4행 모두infinity다. 증거 `/tmp/scenenote-metadata-live-{cache-proof,db-proof}.json`, 화면 `/tmp/scenenote-metadata-deployed-{desktop,person-mobile}.jpg`.
- 운영 검증 범위: 실제 로그인 상세의 데스크톱·인물375px(44px갱신·가로넘침없음)을 확인했다. 앱 내 기존 감상·진행·핀/좋아하는 인물 등록 버튼은 누르지 않았고 실제 등록/bulk쓰기검증은 하지 않았다. 공개metadata cache/contents mirror는 정상조회에서 갱신됐다. 임시 앱 진단 로그·QA 탭·viewport는 제거/원복했다. iOS/Android 실기기·큰 글자·스크린리더 및 실제 장애 주입은 미실행이며 실패/재시도는 위 격리 검증으로 구분한다.

## 검색 초기 추천 전체 공개일 최신순 정정 (2026-11-15)

- 사용자 캡처는 검색어가 빈 “내 취향 최신 추천”이다. 최신 카탈로그·전 기간 취향 보충·후속 응답을 합치는 표시 단계가 날짜를 정렬하지 않아 실제 12개가 `2025.01 → … → 1992.03 → 2026.10` 순으로 나왔다. 기존 위치 보존/뒤에 붙이기 계약을 설명하고 사용자가 **“전체 최신순으로 변경”**을 승인했다. [28 §10](28_recommendation_scroll_pagination_fixes_spec.md#10-2026-11-15-사용자-승인--추천-전체-공개일-최신순)·[43 §6](43_recommendation_add_misclick_fixes_spec.md#6-2026-11-15-전체-최신순-승인-후-표시-위치)에 한정 대체 결정을 기록했다.
- 구현: 최종 `activeRecommendations`에서 필터·추가됨 스냅샷을 합친 뒤 현재까지 받은 후보 전체에 `sortRecommendationsByRelease`를 적용한다. 첫 응답·다음 12개·보충·복원에 공개일 내림차순을 공통 적용하며, 유효한 연도로 폴백하고 미상은 마지막이다. 동률은 기존 순서, 배열·작품 identity·추가됨 비활성·누르기 identity 검증·동기 잠금은 보존한다. 새로 받은 최신작이 앞에 들어오면 기존 카드 위치는 바뀔 수 있다. 안내 문구도 공개일 최신순임을 명시했다. 일반 제목 검색과 유사 작품의 정렬은 별개다.
- 기준선/검사: 시작 경로·`git status --short`와 기존 변경을 확인했고 전체 테스트 **1517/1517**을 기록했다(`/tmp/scenenote-feed-order-baseline.log`). 신규 정렬 회귀 12개를 먼저 실패시킨 뒤 구현했고 최종 **1529/1529**, 기존 추가 안전장치와 결합한 관련 검사 **44/44**, 타입·린트·웹 export·diff 공백 검사 통과. 로그 `/tmp/scenenote-feed-order-{tests,typecheck,lint,build}.log`. 기존 Node 26 의존성 문제로 설치된 Node 24.22.2를 사용했다. 기존 테스트는 변경하지 않았다.
- 실제 로그인 Chrome 웹 8081: 같은 캐시 12개에서 뒤쪽 2026.10 작품들이 앞으로 이동해 `2026.10 → 2025.01 → … → 1992.03`이 됐다. 별도 QA 탭의 정상 추천 요청 후 하단 스크롤 **12→24**를 실행하고 DOM 원본 순서 대신 카드 좌표순으로 24개 전체의 날짜 내림차순을 확인했다(`2026.11 → 2026.10 → 2019.10 → … → 1981.04`). 375/768/1440px에서 가로 넘침이 없고 375px의 2열 격자에서도 최신순을 확인했다. 증빙 `/tmp/scenenote-feed-order-{desktop,mobile}.jpg`. 임시 진단 로그·QA 탭·viewport 설정을 정리했다.
- 서버/제한: 배포된 `personalized-recommendations` v23의 관련 소스 19개가 로컬과 일치함을 읽기 전용으로 대조했다. 이번 변경은 앱 표시 단계여서 서버 배포·DB 스키마·secret 변경이 없다. 정상 추천 조회에 따른 기존 노출 기록 저장은 실행됐고 감상·진행·핀 기록은 변경하지 않았다. 전체 외부 카탈로그가 아닌 현재까지 받은 후보의 정렬이다. iOS/Android 실기기·큰 글자·스크린리더·실제 작품 추가 성공/실패 행동은 이번에 실행하지 않았다. 추가 위치 변경에 따른 identity/잠금은 순수 회귀로 검증했다.

## 유사도 우선 고정·등록 작품 제외 후속 정정 (2026-11-15)

- 사용자 정정: 유사도는 필수이며 최신/인기는 함께 선택 가능해야 한다. 선택 질문에 “더 비슷한 작품 우선, 비슷한 정도가 같으면 최신순”으로 답했다. [22 §10](22_search_recommendations_restore_spec.md#10-2026-11-15-사용자-정정--유사도-1차-고정등록-작품-제외)이 아래 v4 작업의 독립 정렬 계약을 대체한다. 유사도 1차 고정·같은 유사도의 최신/인기 2차 선택, 고정 배지·분리된 초점 UI를 적용했다.
- 등록 제외: `similarityLibrary`가 외부 ID·제목 별칭/종류·연도·시즌을 대조한다. 서버는 사용자 JWT/RLS·명시적 owner 조건으로 라이브러리를 행 상한과 관계없이 끝까지 읽고, 등록 제외 뒤 페이지/총개수를 계산한다. 목록 실패는 명시적 오류다. 앱은 계정·등록 identity별 캐시 분리, 목록 준비 전 차단, 같은 순수 함수의 캐시 재검사, 등록 성공 후 즉시 목록 재조회를 적용한다. 일반 검색/개인화 추천의 기존 동작은 보존했다.
- 공개 스냅샷은 제외 전 후보만 저장하고 개인별 제외는 요청 메모리에서 적용한다. 사용자·등록 서명을 응답 cursor에 묶어 다른 계정/등록 변경의 재사용을 409로 막는다. 내부 v2와 구 앱의 v1 응답 호환을 함께 제공하며 기존 sc1은 재시작 가능한 오류다. DB 스키마·secret·사용자 기록 변경 없음.
- TDD/검사: 직전 작업 최종은 1488/1488이었다. 이번 시작 전체 검사 실행은 병렬로 추가한 신규 helper의 미구현 테스트와 겹쳐 1490/1491(신규 모듈 없음)이었고, 새 parser/UI 기대도 수정 전 실패를 확인했다. 최종 **1517/1517**(신규 29개), 타입·린트·웹 export·Deno 실제 핸들러·diff 검사 통과. Node 24.22.2 사용. 로그 `/tmp/scenenote-similar-followup-{baseline,client-red,client-tests,tests,typecheck,lint,build,deno}.log`. 훅/서비스·실제 QueryClient/InfiniteQueryObserver **124개 확인·14개 시나리오·네트워크 0회**(`/tmp/scenenote-similar-followup-hook-hqLGlR/report.md`), 실제 핸들러+경계 fixture **102개 확인**(`/tmp/scenenote-similar-followup-handler-o0Fatb/report.json`): 계정/등록 변경 취소·대규모 목록·출처 별칭·라이브러리 실패·개인별 총개수·공개 캐시 보존·구 앱 호환.
- 운영에서 발견한 CPU 제한과 정정: 중간 v5는 실제 계정 호출에서 HTTP 546이 났고 로그에 `Shutdown / CPUTime`이 확인됐다. 최초 매처가 후보×등록 목록을 반복 정규화했다. ID/제목 색인을 한 번 구성하는 방식으로 교체해 대규모 회귀의 identity 읽기 752,400→8,000을 확인했다. 공개 후보 125개·합성 목록 1,000/5,000건의 로컬 CPU 비교는 5,395→13.9ms / 26,767→81.8ms였다(`/tmp/scenenote-similar-cpu-bench-{cafxlc,p2GC0D}/report.json`). 운영 응답 시간 보장이 아닌 원인 분리 측정이다. 임시 앱 진단 로그는 제거했다.
- 배포: 앞서 승인한 `similar-content` 한 함수의 후속 수정으로 **v4→v5→v6**, 최종 **v6 ACTIVE·verify_jwt=true**. 다른 운영 함수 13개의 버전·상태·JWT 불변, 내려받은 7개 의존 소스의 실행 코드 SHA가 후보와 모두 일치했다. 백업은 `/tmp/scenenote-similar-deployed-v4`, 최종 후보/SHA `/tmp/scenenote-similar-followup-{candidate,sha}.json`, 최종 배포 증거 `/tmp/scenenote-similar-followup-deploy-verification.json`.
- v6 실제 로그인 웹: 길티 크라운의 공개 후보 **142개 → 현재 계정 미등록 136개**. 신고된 등록 코드 기아스 카드가 사라졌고, 최신 보조 정렬에서 **12→24→…→132→136** 마지막 페이지·더 보기 제거·종료 안내까지 실행했다. 인기 보조 정렬도 12/136으로 계정 제외가 유지됐다. 공개 스냅샷의 142개를 읽기 전용 집계해 두 정렬 모두 유사도 1차, 동률에만 날짜/인기 내림차순인 것을 확인했다. 공개 캐시에 사용자 ID가 없고 136개 개인 결과를 저장하지 않았음도 대조했다. 웹 375/768/1440은 가로 넘침 없음·두 정렬 버튼 44px·선택 상태 전달을 확인했다. 증빙 `/tmp/scenenote-similar-followup-{latest-desktop,popular-desktop,mobile}.jpg`. QA 탭·viewport를 정리했고, 사용자가 이동한 기존 작품 상세 탭은 조작하지 않았다.
- 마무리: `search:golden` **29/29**, v6 무인증 POST **401**을 확인했다(`/tmp/scenenote-similar-followup-golden.log`, `scenenote-similar-followup-final-unauthorized.json`). `edge:drift`는 미커밋 파일·다른 함수의 기존 오래된 배포 때문에 종료 1이며 v6는 위 실행 코드 SHA 대조로 일치를 확인했다(`/tmp/scenenote-similar-followup-drift.log`).
- 미검증: iOS/Android 실기기·큰 글자·스크린리더·실제 등록/삭제 성공 행동은 이번에 변경/실행하지 않았다. 등록 변경/실패/취소는 격리 Query/핸들러로 확인했다. 다른 함수의 기존 drift는 이번 범위 밖이며 배포하지 않는다. 아래 v4의 전역 최신순/142개 검증은 당시 기록으로 보존하며 현재 정렬 의미·계정별 총개수와 구분한다.

## 유사 작품 12개 종료·정렬 보완 (2026-11-15)

- 신고: “길티 크라운 같은 결의 애니”의 유사 검색이 12개에서 끝남. 서버가 정렬 결과를 12개로 자르고 `has_more:false`로 고정했고 앱의 단일 Query·목록에도 이어 찾기가 없었다. 캡처의 유사도순 선택은 기존 parser 기본값과 같으며 최신순 버튼은 별도 요청을 정상 보냈다. 기본 정렬은 임의 변경하지 않았다.
- 구현: [22 §9](22_search_recommendations_restore_spec.md#9-2026-11-15-후속-보완--유사-작품-이어-찾기와-정렬)의 공개 결과 스냅샷과 12개 cursor 페이지, 제한된 인기·최근 공개 후보 병렬 수집, 공급자 부분 실패 처리를 추가했다. 전체 후보를 먼저 정렬해 페이지 경계의 최신순을 유지한다. 가용 신호 정규화는 유지하면서 가중 공통 근거로 유사도순을 비교하고, 중복 정보·한국어 제목을 합치며 기준 작품 자체와 근거 없는 후보를 제외한다. 캐시는 기존 service-role 전용 테이블·15분 TTL이고 만료된 전용 스냅샷만 제한 시간 안에 정리한다. DB 스키마·사용자 기록 변경 없음.
- 앱: 무한 Query·중복/반복 cursor 차단, 스크롤/명시적 더 보기, 표시/전체 개수·선택 정렬, 오류 재시도·만료 재시작을 연결했다. 다음 페이지나 새로 찾기 실패 시 기존 카드는 보존한다. 출처·영화/TV 유형·시즌·정렬·초점·조건별 캐시를 분리한다. 구서버의 12개 결과를 “전부”로 표시하지 않고 추가 조회 불가를 안내한다. 기존 auth 오류 문구 수정 등 다른 작업 변경을 보존했다.
- 자동 검사: 시작 `git status`의 기존 변경을 확인했고 전체 기준선 **1454/1454**, 최종 **1488/1488** 통과(새 앱 페이지 9개·서버 페이지 10개·엔진 회귀 15개). 타입·린트·웹 export·실제 Edge Deno check·diff 공백 검사 통과. `search:golden` **29/29**. 로그 `/tmp/scenenote-similar-{baseline,final-tests,final-typecheck,final-lint,final-build,final-deno,search-golden}.log`. Node 26 실행 파일은 simdjson 의존성 문제로 사용할 수 없어 기존 설치 Node 24.22.2로 실행했다.
- 실제 훅·서비스와 QueryClient/InfiniteQueryObserver 격리 실행: **70개 검증**, 네트워크 0회. 12→24→25·날짜 경계·중복 요청 1회·실패/재시도·만료 재시작·새 스냅샷 첫 페이지 교체·실패 시 기존 25개 유지·키 분리·취소를 확인했다(`/tmp/scenenote-similar-hook-u4ZPhY/report.md`). 실제 핸들러는 인증/DB/외부 API fixture로 **54개 검증**: 12/12/1·전역 최신순·후속 페이지 외부 호출 0회·scope/만료 409·캐시 실패 503·잘못된 입력 400·실제 빈 결과와 전체 실패 구별·부분 응답 보존·캐시 정리 범위/주기(`/tmp/scenenote-similar-handler-CZXBQ3/report.json`). 운영 인증·DB 실행을 대신하는 검사는 아니다.
- 실제 공개 AniList 10793 조회: 추천 25개 + 인기/최근 공개 발견 각 50개, 1,554ms(해당 실행 한 번). 엔진 적용 후 **95개**, 페이지 12×7+11, 전 페이지 날짜 내림차순을 확인했다. TMDB를 합친 운영 최종 수나 응답 시간 보장은 아니다. 증빙 `/tmp/scenenote-similar-anilist-public-probe.json`.
- 실제 로그인 Chrome 8081의 구서버 응답: 최신순 버튼 선택과 URL/날짜 내림차순·새 표시 문구·구응답 추가 조회 불가를 확인했다. 웹 375/768/1440에서 문서 폭=화면 폭이며 정렬 버튼 높이 44px·웹 `aria-pressed` 선택 상태를 확인했다. 사용자 작품 등록·상태 변경 없이 검증했다. iOS/Android 실기기·큰 글자·스크린리더는 환경이 없어 미실행이다.
- 배포(사용자 단일 함수 승인 후): 앱 설정·연결 프로젝트 일치와 승인 후보 4개 소스의 동일성을 재확인하고 Supabase 플러그인으로 `similar-content`만 **v3 → v4 ACTIVE·verify_jwt=true**로 배포했다. 다른 운영 함수 13개의 버전·상태·JWT 설정 불변, 무인증 POST 401을 확인했다. 내려받은 4개 소스는 서식·주석을 제외한 실행 코드 SHA가 후보와 모두 같았다. DB 스키마·secret·사용자 기록은 변경하지 않았다. 백업 `/tmp/scenenote-similar-production-v3`, 후보/SHA `/tmp/scenenote-similar-deploy-{candidate,sha256}.json`, 배포 증거 `/tmp/scenenote-similar-deployment-verification.json`, 소스 대조 `/tmp/scenenote-similar-deployed-source-verification.json`.
- 배포 후 실제 로그인 웹: 길티 크라운 기준 **142개** 응답과 최신순 **12 → 24(더 보기 Enter) → 36(아래 스크롤)**을 확인했다. 버튼으로 이동할 때 레이아웃 변화가 연속 추가 로딩을 일으키지 않도록 자동 호출은 목록 끝 근처의 실제 아래 방향 스크롤에서만 실행한다. 새로 찾기 실패도 별도 한국어 재시도를 제공한다. 최신순의 공개 캐시 스냅샷을 읽기 전용 집계해 **142개·식별자 중복 0·기준 작품 재등장 0·전체 날짜 내림차순**을 확인했다(2026-10-04~1972-12-03). 유사도순 전환 후 첫 페이지는 달링 인 더 프랑키스·코드 기아스·사이코패스 등의 공통 근거가 많은 작품이 앞섰으며, 기존 사용자의 검색 탭에도 12/142개와 더 보기가 표시됐다. 375/768/1440에서 가로 넘침 없음·정렬 버튼 44px·선택 상태 전달을 재확인했다. 증빙 `/tmp/scenenote-similar-deployed-{latest-desktop,mood-desktop,mobile}.jpg`. QA 탭/viewport를 정리했고 사용자 탭·검색 문맥·등록 기록은 유지했다. 네이티브 실기기·큰 글자·스크린리더 검증은 남는다.
- `npm run edge:drift`는 배포 후에도 종료 1로 16개 함수의 기존 미커밋/오래된 배포/미배포 상태를 보고했다(`/tmp/scenenote-similar-edge-drift-final.log`). `similar-content`는 v4로 확인되지만 미커밋 파일 때문에 `uncommitted`이며, 위 실행 코드 대조로 배포 일치를 별도 확인했다. 나머지 함수는 이번 범위 밖이므로 배포하지 않았다.

## AniList 방영 일정을 공개 회차로 사용 (2026-11-15)

- 사용자 신고: "전생 귀족, 감정 스킬로 성공하다 3기"(AniList 185756) 작품 상세의 시청 진행이 회차 버튼 대신 숫자 입력으로 나온다. 실측(2026-11-15): `episodes=null`, `streamingEpisodes=[]`, `nextAiringEpisode={8화}`, `airingSchedule` 12행(1~12화 방영 시각). 화수·스트리밍 목록은 비어 있지만 회차별 방영 일정은 API에 있었고 앱이 쓰지 않았다.
- 변경: `fetch-episodes`의 `availability_only` AniList 분기가 `airingSchedule(notYetAired: false)`의 방영이 끝난 행을 공개 회차로 쓰고 스트리밍 목록(제목·링크)과 회차 번호로 합친다(`publishedAiringScheduleEpisodes`, `mergePublishedEpisodes`). 25행을 넘으면 `Page.airingSchedules`로 200행까지 이어 받고, 그보다 길거나 실패하면 일정을 쓰지 않는다. 2026-10-16 결정("추정 수치를 넣지 않는다")은 유지한다 — `nextAiringEpisode`로 계산하지 않고 API에 번호·방영 시각이 있는 행만 쓰며 빈 번호를 채우지 않는다. 클라이언트·DB 변경 없음(기존 "공개 회차" 버튼 모드를 그대로 쓴다).
- 코드 검사: `npm test` 1454/1454(신규 AS-1~AS-5), typecheck·lint 통과, `fetch-episodes` 번들 통과. 변경한 함수를 실제 AniList에 실행: 185756 → 1~7화(방영일 포함)·다음 8화 2026-11-15, 16498(완결) → 기존과 같은 스트리밍 25행, 21(원피스) → 스트리밍 69행 + 일정 58행, 최신 1180화.
- 배포(사용자 요청, 2026-11-15): 앱 설정과 CLI 연결 프로젝트 일치 확인 후 `fetch-episodes`만 `--use-api`로 배포. 운영 **v11 ACTIVE, verify_jwt=true**. 다른 함수·DB·secret 변경 없음. CLI 3.1.0은 `supabase/config.toml`의 `[inbucket]`을 거부해(`CliConfigRemovedKeyError`) `supabase@2.116.0`으로 배포했다. 설정 파일은 바꾸지 않았다.
- 배포 후 화면 확인(2026-11-15 오전 KST, 8화 방영 전): 기존 로그인 세션의 웹 8081에서 전생 귀족 3기 상세를 별도 탭으로 열어 **1~7화 버튼**, "API 공개 회차 7개 · 최근 7화 · 총 화수 미정", **저장된 7화의 파란 선택 표시**를 확인했다. 요약은 "7화까지 시청 · 직접 설정함", 저장 버튼은 비활성이며 숫자 입력·진행 막대는 없다. 1440px·375px의 문서 폭은 각 화면 폭과 같고 모바일에서도 회차 버튼 7개가 유지된다. 저장·상태 변경·로그인 대행·재배포 없이 확인했고 임시 탭·viewport를 정리했다. 증빙 `/tmp/scenenote185756-v11-{desktop,mobile}.png`.
- 공식 AniList와 신규 공개 회차 함수도 같은 시각의 1~7화를 확인했다. API상 8화 방영 시각은 오늘 23:30 KST이며 총 화수는 여전히 null이다(`/tmp/scenenote185756-airing-20261115.json`). 공개 회차 수는 조회 시각에 따라 달라진다. 실제 8화 방영 후 갱신과 iOS/Android 실기기 동작은 미검증이다. 이번 확인에서는 코드·테스트를 바꾸지 않고 이 항목의 검증 기록만 갱신했다.
- 자동 갱신·선택 유지 후속 검증: 공식 일정 표본의 8화 시각 전 1ms에는 1~7화, 정각/후 1ms에는 1~8화(9화 이상 없음)를 실제 서버 순수 함수로 확인했다(3/3, `/tmp/scenenote185756-airing-boundary-20261115.json`). 미래 시각을 모사한 검사이며 실제 방영 후 API 응답 검증과 구분한다.
- 실제 `useEpisodeAvailability` 옵션과 설치된 TanStack QueryObserver로 30분 타이머를 진행시켰다(36개 확인, 네트워크 0). 같은 observer에서 29:59.999까지 데이터 7개/조회 1회, 30:00에 재조회 2회/데이터 8개로 변경되고 query key/hash는 유지됐다. 정책은 활성 화면의 **30분 간격**이며 공개 시각에 맞춘 즉시 조회는 아니다. 신선한 캐시로 재진입하면 기존 7개를 잠시 유지할 수 있고, 백그라운드·비활성 상태에서는 지연될 수 있다. 이는 mock 포커스/시간·응답을 사용한 Query 실행 검증으로 네이티브 앱 수명 주기 확인은 아니다. 결과 `/tmp/scenenote-airing-refresh-aEtt4t/report.json`.
- 실제 React 19.1.0/ReactDOM·`EpisodeProgressCard`·내부 회차 레일·순수 함수를 메모리 DOM에서 실행해 **7개→8개 갱신 뒤 7화 선택·저장 비활성·onSave 0회**를 확인했다(28/28, `/tmp/scenenote-episode-card-qa/result.json`). 합성 항목의 저장값 7은 변하지 않고 요약 7화·다음 회차 8화를 유지한다. RN host/layout과 Query/service/auth는 경계 fixture이며 실제 Expo UI·서버·개인 기록을 바꾸지 않았다. 로컬 HTML 브라우저 실행은 URL 정책이 막아 중단하고, 브라우저 없이 기존 jsdom을 사용하는 메모리 단위 실행으로 검증했다. 신규 설치 없음.
- 사용자의 "8화 공개되면 확인" 요청에 따라 이 채팅의 **2026-11-15 23:35 KST 단발 후속 확인**을 설정했다(automation 8). 실제 공개 목록·7화 선택을 읽기 전용으로 확인하되, 새 탭/새로고침 검증과 자동 타이머 직접 관측은 구분한다. 기존 사용자 저장값을 변경하지 않으며 로그인 세션이 없으면 대신 로그인하지 않는다.
- **공개 후 단발 확인(2026-11-15 23:36~23:40 KST)**: 공식 AniList를1회 조회했다(HTTP200). 원본 일정12행 중 조회 시각까지 방영 시각이 지난 회차는 **1~8화**, 8화는오늘23:30 KST, 총 화수는null·다음9화는11월22일23:30 KST다. 실제 `publishedAiringScheduleEpisodes`에 이 신규 응답/조회 시각을 넣어1~8화만 반환됨을 확인했다. 국내 OTT별 공개 확정이나 실제 Edge/30분 자동 타이머를 관측한 결과는 아니다. 지정 라이브러리 행을 읽기 전용 DB 조회해 **저장값7화 유지**, 진행 저장 시각2026-11-15 11:20:57 KST를 확인했다. 기존 로그인 브라우저의 라이브러리에도7화/다음8화가 표시됐으나 이 화면은 기존 렌더다. 별도 탭의 지정 상세 URL은 **localhost:8081 ERR_CONNECTION_REFUSED**였고8081 listen 프로세스도 없어, 실제1~8화 버튼·안내 문구·7화 선택 표시는 확인하지 못했다. 서버 시작/재시작·코드·배포·진행 저장·상태 변경·대신 로그인은 수행하지 않았다. 확인하려면 사용자가8081 웹 서버를 다시 실행해야 한다. QA 탭은 닫았고 기존 탭/필터·입력을 보존했으며 viewport는 바꾸지 않았다. 공식 원본 `/tmp/scenenote185756-postair-official-20261115.json`, 검증 범위 `/tmp/scenenote185756-postair-verification-20261115.json`. 문서 해당 항목만 갱신하고 경로·diff를 검사했다. 단발 후속 확인을 종료하고 automation8을 삭제했다.

## 로그인 전 사용성·오류 문구 정정 (docs/68, 2026-11-15)

- 적용 지침은 루트 `AGENTS.md`(하위/override 없음), 명세 68 전체·14장, 공통 UI 규칙·11장 인증 기준이다. 기존 진행률/검색 등의 미커밋 변경은 보존했다. `authErrorMessage`·`onboarding`·`errorCopy`와 순수 테스트를 추가하고, 인증 훅의 오류 6분기에서 코드 우선 한국어 변환을 적용했다. 세션 없는 비밀번호 설정 안내·계정 삭제·성공 이동·인증 메일 흐름은 유지한다. 온보딩 모든 장에 로그인 링크, 둘째 장부터 이전 버튼을 제공한다. `PasswordInput`은 각 칸의 보기 상태·44×44 버튼·폼 ref·화면 이탈 숨김을 제공하고 네 주 버튼에 눌림/disabled/busy(웹 `aria-busy` 포함)를 적용했다. 기존 16px 입력은 유지한다. `userFacingErrorMessage`와 `ErrorState`는 변경하지 않았다.
- F-6은 명세의 9개 파일 **24곳·20개 ERROR_COPY 키**만 교체했다. AST로 키·중복 개수·호출 위치를 확인했다. 표 밖인 `app/search.tsx:957,1154`의 `personalizedRecommendations.loadMoreError`는 훅의 `toErrorMessage`가 영문 원문을 유지할 수 있어 후속 보완이 필요하다(이번 요청대로 보고만 함). 명세의 범위 밖인 import/photo-import·핀/프로필 이미지 공유·미사용 PopularRecommendationSection의 원문 경로도 보존했다. `ContentReviewEditor`의 날짜 검증 catch는 한국어 전용 예외로 보존했다.
- 검사 순서: 최초 기본 Node 26은 Homebrew `libsimdjson.33.dylib` 부재로 실행 실패(종료 134). 설치된 **Node 24.22.2**를 PATH 앞에 둬 설정 변경 없이 기준선을 실행했다. 기준선 `npm test` **1432/1432** → STEP 1 테스트 3파일 추가 후 **1432 통과·3파일 실패**(`Cannot find module './authErrorMessage'`, `'./errorCopy'`, `'./onboarding'`) → 구현 후 **1449/1449**. T-1~T-17은 정확히 17개 it이며 기존 테스트는 수정·제거하지 않았다. typecheck·lint·diff 검사 통과. 신규 PasswordInput 금지 스타일/Alert 검색 0줄, 지정 화면 오류 검색은 인증 오류 4줄·fieldState 7줄만 남는다. 로그 `/tmp/scenenote68-{baseline,red,focused-green,final-test,final-typecheck,final-lint,token-check,error-check}.log`, 시작 상태 `/tmp/scenenote68-start-status.txt`.
- 실제 `useAuth`를 격리 번들로 실행해 6개 오류 분기의 알려진/알 수 없는 코드, session 없음, 가입 반환값·redirect, 로그아웃·삭제 흐름 보존 **22/22**를 확인했다. 외부 경계는 모사·네트워크 0회·실계정 0개이므로 실제 인증 성공/실패 및 React 렌더 검증과 구분한다. 하네스·결과 `/tmp/scenenote-auth-hook-harness.cjs`, `/tmp/scenenote-auth-hook-harness-report.json`.
- 웹은 기존 8081 PID 89389가 이전 소스를 제공해 해당 프로세스만 확인 후 같은 포트로 재기동했다(`/tmp/scenenote68-expo.log`). 기존 로그인 세션을 변경하지 않도록 별도 탭의 127.0.0.1:8081에서 로그인 전 화면을 확인했다. 계정 로그인·가입·메일 전송·비밀번호 변경을 실행하지 않았다. 임시 탭·viewport를 정리했고 서버/DB 배포·사용자 기록 변경은 없다.

| 수동 ID | 결과 | 증거·남은 범위 |
|---|---|---|
| M-1 웹 1440 | 통과 | 세 장의 로그인 링크, 둘째/마지막 장 이전, 마지막 계정 만들기→가입 이동, 1/3~3/3 접근성 표시 확인. 중앙 560px 컨테이너·화면 안 버튼. `/tmp/scenenote68-ui/onboarding-1440.png` |
| M-2 웹 375 | 부분 확인 | 온보딩·로그인·가입·메일 요청·복구 세션 없는 설정 안내 화면의 가로 폭 375 및 버튼 노출 확인. 마지막 장 버튼 높이 52.5/48/48, 하단 788<812. 768 온보딩도 넘침 없음. 유효한 복구 세션의 새 비밀번호 폼은 미확인(대신 로그인/복구하지 않음) |
| M-3 웹 375 | 확인 범위 통과 | 로그인/가입 보기·숨기기, 이메일 Enter→비밀번호(ref), 비밀번호 Tab→보기→제출, Enter→한국어 필드 검증, 보기 버튼 44×44, 검증 실패 후 시험값/보기 상태 유지. 실제 서버 실패와 복구 폼 두 칸은 미확인. 시험값은 합성이며 화면 캡처로 유지 확인. `/tmp/scenenote68-ui/sign-in-validation-retained-375.png`, `sign-up-validation-375.png` |
| M-4 웹 실제 로그인 실패 | 미확인 | 실제 계정으로 로그인하지 않았다. 오류 변환은 순수 테스트와 격리 훅 실행, pending 스타일/상태는 정적 검사로만 확인 |
| M-5 웹 로그인 후 오프라인 | 미확인 | 실제 계정으로 대신 로그인하거나 사용자 세션을 오프라인으로 전환하지 않았다. 24곳 연결·한국어 통과/영문 대체는 자동 검사로 확인, 화면별 실제 재시도는 남음 |
| M-6 iOS 세로 | 미확인 | `xcrun --find simctl` 실패(도구 없음), 연결 실기기 없음. 안전 영역·가상 키보드·글자 1.3배·실패 상태 유지 실기기 확인 필요 |

- D-1~D-6 변경 없음. 구현은 완료됐고 실제 계정의 M-4·M-5, 복구 세션 폼과 iOS M-6 확인은 남긴다. Edge Function·DB 변경이나 서버 배포가 필요한 작업은 아니다.

## 시즌별 진행 범위 일치 (2026-10-26)

- 사용자 승인에 따라 [17 §11](17_season_library_tracking_spec.md)·[48](48_content_detail_completed_progress_fixes_spec.md)의 진행 범위를 확정했다. 각 10화인 시즌1 10화+시즌2 3화의 경우 시즌 항목은 `10/10`·`3/10`, 작품 전체는 `13/20`이다. 서비스 매핑·수동/상태 캐시·상세 입력·완료 제안·에피소드 선택·방영 안내를 같은 범위로 연결했다.
- 수동 저장값과 기존 NULL 등록은 유지한다. 시즌2 첫 회차 체크 해제가 시즌1 마지막 회차 포인터를 저장하던 경계와 기존 null 시즌 수동값의 동기화를 보정했다. 선택 시즌 메타데이터/화수 누락 시 다른 시즌 값을 대입하지 않으며 AniList 표시 기수와 실제 단일 시즌 구분을 보존한다. DB 마이그레이션·운영 데이터 변경·서버 조작·배포·설치·커밋은 하지 않았다.
- 자동 검증: 기준선 **1355/1355** → 최종 `npm test` **1378/1378**(신규 회귀 23개), `npm run typecheck`, `npm run lint` 통과. 최초 `npm test`는 sandbox의 tsx IPC 제한으로 시작하지 못했고, 기준선은 같은 파일을 `node --import tsx --test`로 실행했다. 최종 npm 명령은 승인된 실행 환경에서 통과했다. 로그 `/tmp/scenenote-season-progress-final-{tests,typecheck,lint}.log`.
- 연결 검증: 실제 서비스 `getLibraryItems`와 실제 mutation의 낙관적 갱신/실패 복구 코드를 합성 Supabase 경계 및 QueryClient로 실행했다. 최초 조회, 두 목록 캐시, 모의 저장/재조회, 완료→보는 중, 실패 롤백, 직접 설정 초기화, 다른 등록행 보존을 확인했다. 네트워크 0회이며 실제 Supabase/RLS·실제 React 화면 실행을 의미하지 않는다. 이 검증은 `scripts/libraryProgressIntegration.test.ts`에 보존해 기존 `npm test`에 자동 포함된다. 설치된 `tsx` 기준으로 esbuild를 찾으며 새 의존성은 추가하지 않는다. 자식 프로세스에서 네트워크를 차단하고 합성 데이터만 사용하며 임시 번들은 항상 정리한다. 전체 1378개 검증 뒤 추가한 통합 시나리오 1개는 별도로 1/1 통과했다(7개 연결 확인). 결과 `/tmp/scenenote-progress-persisted-integration.log`.
- 웹 375/768/1440과 iOS/Android 실제 화면은 이번에 조작하지 않았다. 운영 계정 저장·완료/해제·재조회, 기기별 입력·접근성 확인이 남는다. UI 스타일 추가/변경 없이 기존 컴포넌트를 사용했으며 `EpisodeProgressCard`의 기존 토큰 직접값 16줄은 범위 밖으로 유지했다.


## 라이브러리 성우·출연배우 2명 표시 (2026-10-25)

- 검색 추천과 같은 표시를 요청받아 라이브러리 `ContentCard`·`ContentGalleryCard`의 확장 기능 플래그에 묶인 출연진 표시를 공용 `ContentCast`로 교체했다. 검색의 `RecommendationCast`도 이를 재사용한다. 기존 이름 정렬·중복 제거·한글 변환·애니메이션 영화 성우 판정을 공유한다. 출연진이 있으면 저장값을 사용하고 없으면 빠른 보기와 같은 상세 Query 캐시(10분)를 사용한다. 영화/TV 조회 구분, 로딩·실패·정보 없음 안내를 유지하며 수동 작품은 외부 조회하지 않는다. 사용처가 사라진 `useLibraryItemCast`는 제거했다.
- 전체 `npm test` **1349/1349**, typecheck·lint·diff 검사 통과. 공용 순수 함수의 기존 테스트로 출연 순서·2명 제한·빈 이름/중복 제거·한글 변환·영화 조회·성우 분류를 검증했다. 서버·DB·사용자 감상 기록 변경 및 배포 없음.
- 실제 로그인한 8081 웹에서 갤러리·자세히 보기 모두 단다단 3기 성우 ‘하나에 나츠키 · 와카야마 시온’, 100일의 거짓말 배우 ‘김유정 · 진영’, 영화 개인적인 택시 배우 2명 표시를 확인했다. 갤러리 375/768/1440 및 자세히 375에서 이름 표시와 가로 넘침 없음을 확인했다. 보기·viewport 복원, 증빙 `/tmp/scenenote-library-cast-{desktop,mobile}.png`. iOS/Android 실기기·큰 글자, 수동 작품·강제 조회 실패 상태는 실제 환경에서 미검증이다. 외부 API 조회를 기존 상세 경로로 실행해 확인했으며 인증 정보를 추출하지 않았다.

## 검색 추천 카드 성우·출연배우 표시 (2026-10-24)

- 영화 누락 정정: 표시 대상을 모든 콘텐츠 유형으로 넓히고, 영화 조회를 TV 고정에서 `movie`로 수정했다. 갤러리·목록 모두 영화 출연진 최대 2명을 표시하며 애니메이션 영화는 정규화한 추천/상세 장르로 성우를 구분한다. cast가 없을 때도 영역을 유지하고 정보 없음 안내를 표시한다. 배우 이름·추정 데이터를 추가하지 않는다.
- 검증: 기준선 1334/1334 → 전체 1336/1336, typecheck·lint 통과. 기존 movie 제외 기대값을 새 요구인 출연배우 표시로 정정했고 영화/TV 조회 경로·애니메이션 영화 장르별 회귀 2개를 추가했다. 실제 로그인 8081 웹 갤러리와 목록에서 ‘두잉 라이프’, ‘인생, 사랑하다’, ‘텐징’ 출연진 2명을 확인했다. 375/768/1440px 문서 가로 넘침 없음. 증빙 `/tmp/scenenote-movie-cast-desktop.png`. 애니메이션 영화 라벨은 자동 테스트로 검증했고 실작품 수동 사례는 이번 추천 묶음에 없어 미검증이다. 네이티브 실기기 검증 환경 부재는 동일하며 서버·DB·사용자 감상 기록 변경과 배포 없음.


- 후속 요청: 검색 기본 보기를 갤러리로 바꾸고 기존 저장 버전 0도 한 번 갤러리로 이관한다(이후 선택은 저장). 성우 이름은 공용 `formatPersonName`을 재사용해 API 로마자 읽기의 한글 표기를 우선 표시하며 원문만 있거나 변환 불가면 원문을 보존한다. 구 서버 cast에 source가 없는 경우 작품 source를 적용한다. 이름 하드코딩·추가 API 요청·서버 변경 없음.
- 후속 검증: 이름 회귀 4개(한글 변환/기존 한글 우선/변환 불가/구 source 누락), 전체 1334/1334·typecheck·lint 통과. 실제 로그인 웹에서 첫 진입 갤러리 선택과 ‘카쿠마 아이 · 미키 시니치로’, ‘코시미즈 아미 · 스자키 아야’ 표시를 확인했다(자동 음역은 공식 한글 표기와 다를 수 있음). 375px 문서 넘침 없음. 증빙 `/tmp/scenenote-cast-korean-gallery.png`. 네이티브 검증 환경 부재는 동일하다.


- 사용자 요청으로 추천 갤러리·목록 제목 아래에 애니 성우, 드라마 출연배우를 API 출연 순서로 최대 2명 표시한다. 공통 `RecommendationCast`가 빠른 보기의 상세 조회·캐시를 재사용하고, 순수 함수가 빈 이름·인물 중복을 제거한다. 조회가 늦거나 실패해도 추천·추가·완료 동작은 대기시키지 않는다. API가 1명만 주면 1명만 표시하며 임의 이름을 채우지 않는다.
- 기준선 테스트 1326/1326 → 변경 후 1330/1330, typecheck·lint 통과. 새 테스트는 유형별 라벨, API 출연 순서/원본 보존, 빈 이름·중복 성우, 공급자 identity·정보 부족을 검증한다. 실제 로그인 웹 8081에서 갤러리·목록의 성우 2명과 드라마 ‘당신이 잠든 사이에’의 ‘수지 · 이종석’을 확인했다. 375/768/1440px 문서 가로 넘침 없음. 첫 추천 조회의 운영 546 오류는 재시도 후 정상 응답했으며 이 작업에서 서버 수정·배포는 하지 않았다. 증빙 `/tmp/scenenote-recommendation-cast-desktop.png`, `/tmp/scenenote-recommendation-cast-mobile.png`.
- iOS/Android 실기기·큰 글자·스크린리더는 실행 환경 부재로 미검증이다(`simctl` 없음). 사용자 감상 기록은 변경하지 않았다. 인물 이름은 기존 상세 API의 이름을 사용하므로 공급자에 따라 일본어 원문일 수 있다.

## 템빨 넷플릭스 누락 정정 (2026-10-20)

- 사용자가 실제 넷플릭스 제공 작품의 누락을 신고했다. AniList 212888의 선공개일(2026-09-27)과 TMDB 324502 시즌 1의 TV 방영일(2026-10-02)이 달을 넘기면서 직전 같은 월 판정이 실패했다. 정확한 시즌 1 API에는 Netflix·Watcha·TVING이 있으며 [넷플릭스 공식 페이지](https://www.netflix.com/kr/title/82948047)도 에피소드 3개를 표시했다. 운영 v4는 `lookup_version` 없는 `scope:content`를 반환해 앱에서 차단되는 별도 배포 불일치도 실제 로그인 웹 응답으로 확인했다. 증빙 `/tmp/scenenote-temppal-production-before.json`.
- [54 §16](54_anime_sequel_watch_providers_fixes_spec.md#16-2026-10-20-후속-정정--템빨-누락과-구서버-캐시)에 따라 같은 시즌 번호·연도를 유지하면서 날짜 차이 7일 이내로 보정한다. 다른 기수·인접 연도·합쳐진 1기 추정은 금지한다. 구계약 캐시는 1시간을 기다리지 않고 다음 포커스당 1회 재조회하고, 정상 v2 미확인 캐시는 TTL을 유지한다. 구응답 때문에 조회하지 못하는 안내를 실제 데이터 미확인과 구별했다.
- 회귀 검증: 서버 새 회귀 수정 전 83/88 → 수정 후 88/88. 최종 전체 **1326/1326**, typecheck·lint·웹 export(종료 0, Expo 종료 강제 정리 안내 포함)·Deno get-watch-providers 검사·diff 검사 통과. 로그 `/tmp/scenenote-temppal-final-{tests,typecheck,lint,build}.log`. 실제 TMDB와 수정 helper 재검증에서 `/tv/324502/season/1/watch/providers`만 조회해 시즌 1 제공처를 얻었다(`/tmp/scenenote-overgeared-season-fixed.jsonl`).
- 실제 핸들러 fixture 23/23 통과(템빨 5일 차이 성공·8일 차이 거절·앞선 3기 오매칭 차단 포함). 인증과 외부 fetch는 모사이며 운영 앱과 분리한 검사다. 결과 `/tmp/scenenote-watch-providers-handler-validation.json`. 단일 함수 격리 배포 후보 `/tmp/scenenote-ott-deploy-candidate`와 SHA manifest·롤백 안내를 준비했다(`/tmp/scenenote-ott-deployment-readiness.md`).
- 사용자 단독 함수 배포 승인 후 `get-watch-providers`만 격리 후보에서 배포했다. 직전 CLI 연결 프로젝트·앱 대상 일치와 운영 v4, 후보 11개 파일의 SHA 일치를 재확인했다. 배포 후 **v5 ACTIVE·verify_jwt=true**, 다른 13개 함수의 버전·상태·설정 불변, 무인증 POST 401을 확인했다. 내려받은 v5의 정규화 실행 코드 SHA는 승인 후보와 같다. DB·secret·사용자 기록 변경 없음. 운영 백업 `/tmp/scenenote-ott-production-backup`, 배포 로그 `/tmp/scenenote-ott-deploy.log`, 검증 `/tmp/scenenote-ott-deployment-verification.json`.
- 배포 후 실제 로그인 웹: 템빨은 `lookup_version:2`, 요청 시즌 1·`scope:season`·TMDB 시즌 1로 **넷플릭스·티빙·왓챠**가 표시됐다. 데스크톱 1440px·모바일 375px에서 확인했고 모바일 문서 폭 375로 가로 넘침이 없다. 사용자가 기존에 열어둔 탭에도 세 제공처가 표시되는 것을 확인했다. 전생 귀족 3기는 요청 시즌 3·`scope:null`·빈 제공처로 확인돼 이전 시즌 넷플릭스가 섞이지 않는다. 임시 진단 코드를 제거하고 QA 탭·viewport를 정리했다. 증빙 `/tmp/scenenote-temppal-deployed-{desktop,mobile}.png`, `/tmp/scenenote-temppal-deployed-response.json`, `/tmp/scenenote-season3-deployed-response.json`.
- iOS/Android 실기기·큰 글자·스크린리더는 실행 환경이 없어 미검증이다. 서버 응답의 운영 확인과 네이티브 화면 검증은 구분한다. 추천 배지 변경의 `personalized-recommendations` 배포는 이번 승인 범위에 포함되지 않아 남아 있다.

## 작품의 선택 시즌 기준 OTT 정정 (2026-10-20)

- 사용자 신고 작품은 AniList 185756의 3기다. 기존 시리즈 전체 제공처를 3기 화면에 보여주던 동작을 [54의 후속 계약 §15](54_anime_sequel_watch_providers_fixes_spec.md#15-2026-10-20-후속-정정--선택한-시즌의-제공처만-표시)으로 대체했다. AniList는 원제 기수·방영일로 TMDB 시즌을 검증하고, TMDB 명시 시즌은 시즌 제공처 API만 조회한다. 시즌이 없거나 모호하면 미확인이며 시리즈 제공처로 채우지 않는다. 정확한 시즌의 200 응답은 국내 정보가 비어도 해당 시즌의 해외 정보만 보존하고, 404와 구별한다.
- 앱은 버전 2·선택 시즌 일치가 확인된 응답만 표시하고 구서버의 시리즈 응답도 차단한다. “시즌 3 기준”·미확인 안내·재시도를 추가했으며, 캐시는 시즌·제목·방영일별로 분리한다. 라프텔 검색에도 기수를 넣는다. 추천의 시리즈 ID만으로 붙던 AniList/명시 시즌 OTT 배지는 보류하며 후보 개수·순서·필터는 유지한다.
- 실데이터: TMDB 237150은 시즌 1(2024-04-07, 29화)만 반환해 새 helper는 3기 제공처를 조회하지 않고 미확인으로 처리했다. 대조 작품 전슬 4기는 `/tv/82684/season/4/watch/providers`에서 KR 왓챠·티빙을 반환했다. [넷플릭스 공식 페이지](https://www.netflix.com/kr/title/81769856)의 시즌 2개 표시는 3기 제공 근거가 아니다. 라프텔 공식 검색의 3기(47318)에 1화 재생하기 링크가 있음을 확인했지만, 이 수동 확인을 앱의 자동 제공처 데이터로 하드코딩하지 않았다. 로그 `/tmp/scenenote-ott-probe.jsonl`, `/tmp/scenenote-ott-live-check.jsonl`.
- 실제 로그인 웹 8081: 신고된 상세의 375·1440px에서 시리즈의 넷플릭스 등 목록이 사라지고 시즌 3 미확인 안내가 표시됨을 확인했다. 문서 폭은 화면 폭과 같고 재시도 버튼은 높이 44px다. 다시 확인하기 뒤에도 잘못된 제공처가 없으며 라프텔에서 3기 찾아보기는 해당 검색 결과를 연다. 증빙 `/tmp/scenenote-season-ott-{desktop,mobile}.png`. 기존 서버를 재사용하고 검증용 탭·viewport 설정을 정리했으며 감상 기록을 변경하지 않았다.
- 실제 핸들러를 인증 모사·외부 fetch fixture로 실행한 21/21 사례가 통과했다(선택 시즌 URL, 합쳐진 시즌 차단, 같은 연도 후속기, 200 해외/빈 응답과 404 구별, 입력 400·공급자 오류 503). 이 검사는 운영 인증·배포 검증이 아니다. 결과 `/tmp/scenenote-watch-providers-handler-validation.json`.
- 최종 자동 검사: `npm test` **1316/1316**, typecheck·lint·웹 build(export)·Edge 16개 Deno check·diff 공백 검사 통과. 로그 `/tmp/scenenote-season-ott-{tests,typecheck,lint,build}.log`, `/tmp/scenenote-watch-season-deno.log`. 웹 export는 종료 코드 0이며 export 뒤 Expo의 종료 강제 정리 안내가 남았다. 리뷰 후 AniList 극장판의 TV 오입력·구서버 캐시 차단, 네이티브 스택의 포커스 복귀 시 TTL 재검사도 보완했다. 네이티브 포커스 동작은 코드/정적 검사까지이며 실기기 실행 증거와 구분한다.
- 운영 배포·DB·secret 변경은 하지 않았다. 클라이언트는 구응답의 오표시를 막지만 새 시즌 조회에는 `get-watch-providers`, 추천 배지에는 `personalized-recommendations` 재배포가 필요하다. iOS/Android 실기기·큰 글자·스크린리더와 새 서버 배포 후 실제 앱의 성공 제공처 표시는 실행 환경/배포 범위 밖이어서 미검증이다. 제목에 기수 표식이 없는 AniList 후속작, TMDB가 여러 기수를 한 시즌으로 합친 작품, AniList 극장판은 자동 제공처가 미확인으로 남을 수 있다.

## 모바일·웹 사용성 중심 코드 점검 (2026-10-20)

- 검색 입력에 44pt 이상 지우기 버튼·포커스 유지를 추가하고 자동 대문자/자동 교정을 끈다. 검색 목록은 키보드가 열린 상태에서 행동을 누를 수 있게 하고 스크롤 시 키보드를 닫는다. 검색 추가 실패·라이브러리 진행 저장/상태 제안·핀 저장/삭제 오류를 기존 한국어 토스트 흐름으로 맞췄다. 핀 삭제는 공통 확인, 저장 중 태그 변경 차단을 적용했다. 토스트 행동/닫기 버튼은 최소 44×44pt로 보완했다. 라이브러리 목록·갤러리의 `anime` 등 내부 코드는 기존 분류 규칙의 한국어 표시명을 사용한다.
- 기록 변경 뒤 오래된 값이 남던 경로를 보완했다. 라이브러리 추가/상태 변경/삭제와 핀 생성/수정은 프로필 통계도 무효화한다. 인물 한글 이름을 자동으로 되돌릴 때 기존 자동 보정 캐시도 stale 처리한다. 초기 인증 조회가 늦거나 최신 인증 이벤트와 순서가 뒤바뀌어 세션을 잃는 문제를 고치고 계정 변경/자동 로그아웃 때 Query 캐시를 비운다. 현재 데이터 흐름은 [08](08_frontend_architecture.md)에 반영했다.
- 영화 핀의 제목 보강이 TV 상세를 조회하던 문제를 고치고 작품 핀을 시즌→회차→시간순으로 정렬한다. 추천 취향 보충은 아직 조회하지 못한 질의도 커서에 남겨 시간 제한/일부 실패를 목록 끝으로 오인하지 않게 했다. Edge JSON 본문·검색 인자 검증, 에피소드 조회의 관계 응답 정규화와 기존 Deno 타입 오류도 수정했다.
- 자동 검증: 시작 전체 테스트 1253/1254, 최종 `npm test` **1284/1284**, `npm run typecheck`, `npm run lint`(오류·경고 0), `npm run build`(웹 export), Edge Function **16개 Deno check**, `git diff --check` 통과. 기존 실패 1건은 docs/33의 “최근 공개작” 계약을 여전히 “최신”으로 검사하던 기대 문구를 정정했으며 추천 순서/모드 검증은 유지한다. 새 회귀는 인증 순서 7개·JSON 검증 12개·취향 보충 커서 3개·핀 제목 보강 5개·에피소드 관계 응답 3개다. 로그는 `/tmp/scenenote-audit-final2-{test,typecheck,lint,build}.log`, `/tmp/scenenote-audit-deno-fixed.log`. 인물 자동 이름 복원은 실제 mutation 콜백과 격리 QueryClient/QueryObserver로 재조회 1→2회도 확인했다.
- 실제 로그인 Chrome 웹(8081): 검색 320/375/768/1440px에서 가로 넘침 없음, 지우기 버튼 44×48px·입력 포커스 유지, 320px 필터 시트의 적용/취소 노출·취소 후 포커스 복귀를 확인했다. 375px 라이브러리의 2열 갤러리·6개 탭·한국어 유형, 에피소드→핀 작성 맥락을 확인했다. 잘못된 시간 `12:3x`는 원문과 오류를 유지하고 저장을 막았으며, 입력을 비우고 취소해 기록은 저장하지 않았다. 격리된 실제 ToastViewport의 320/375px 행동·닫기·44pt 영역도 실행 확인했다(증빙 `/tmp/scenenote-audit-ui/toast-375.png`). 임시 QA 파일/탭은 제거했다. 오래된 번들을 내주던 기존 Expo 프로세스만 확인해 같은 8081 포트로 재기동했다.
- 미검증: iOS/Android 실기기·가상 키보드·VoiceOver/TalkBack·큰 글자, 실제 계정의 저장/삭제 성공 및 강제 네트워크 실패, 운영 Edge 응답. `simctl` 실행 도구/연결 기기가 없어 네이티브 검증은 남긴다. DB·secret·운영 배포와 감상/핀 기록 변경은 하지 않았다. 서버 수정의 운영 반영에는 해당 Edge Function 재배포가 필요하다.
- 당시 남긴 진행 범위 충돌(전체 시즌 분자/선택 시즌 분모, `13/10`)은 사용자 승인 후 2026-10-26 상단 기록과 docs/17 §11에 따라 해소했다. 아래의 10월 20일 검증 결과는 당시 범위로 보존한다.

## 라이브러리 공백 무시 검색 (2026-10-16)

- 사용자 캡처의 `감정스킬로`가 `감정 스킬로`에 일치하지 않던 원인은 `filterLibraryItems`의 공백 포함 문자열 비교였다. 기존 검색에 각 필드·검색어의 공백 제거 비교를 추가했다. 제목·원제·제작진·출연진에 적용하고 다른 필터·정렬은 유지한다. 목록·갤러리와 웹·네이티브는 같은 순수 필터를 사용한다.
- 관련 테스트 16/16 통과. 새 사례 8개 중 6개가 수정 전 실패했고 수정 후 모두 통과했다(붙여 쓰기·임의 띄어쓰기·짧은 검색어·탭/전각 공백·원제/인물·필터 유지·필드 경계). typecheck 통과, lint 오류 0/기존 `batchedQuery.test.ts` 경고 1, diff 검사 통과.
- 실제 로그인 웹·iOS·Android 화면 수동 검증은 이번 작업에서 실행하지 않았다(순수 필터 실행으로 검증). 서버·DB 변경 및 배포 없음. 기존 다른 작업의 변경은 보존했다.

## 회차 선택을 실제 공개 에피소드 목록으로 전환 (2026-10-16)

- 사용자 후속 요청으로 앞선 nextAiringEpisode 기반 공개 회차 추정을 교체했다. 회차 선택은 fetch-episodes availability_only의 `released_episodes` 행만 사용한다. AniList는 streamingEpisodes의 제목에 명시된 번호와 HTTP(S) 링크, TMDB/TVmaze는 실제 에피소드 목록의 공개일이 지난 행을 쓴다. 다음 방영 정보는 예정일 안내에만 남기며 공개 회차 계산에는 사용하지 않는다. 빈 목록에 총 화수나 추정 수치를 넣지 않는다.
- 선택 번호는 API 목록 그대로이며 [1,3]이면 2를 생성하지 않는다. 이전 전체 화수/공개 최댓값 기반 선택 수 테스트는 새 요구에 맞춰 명시 번호 테스트로 변경했다. 기존 테스트 기준선 1233/1234에서 최종 1235/1236, 기존 추천 엔진 실패 1건 유지. 스트리밍 목록 정규화·날짜 필터 새 회귀 2개는 구현 전 실패, 후 통과. typecheck 통과, lint 오류 0/기존 batchedQuery.test.ts 경고 1, Edge 전체 번들 문법·diff 검사 통과.
- 실제 API 검증: AniList 185756은 streamingEpisodes=[] 반환. 운영 상세도 source=anilist_streaming, episodes=[]를 받아 목록 부재 안내와 직접 입력을 표시한다. 이 작품의 라프텔 공개 3화를 API로 확보한 것은 아니며 임의 대체하지 않았다. AniList 16498의 실제 streamingEpisodes 25행은 25개 번호 모두 변환됨 확인(HTTP 링크 포함). 로그 `/tmp/scenenote-released-list-{before,red,after,typecheck,lint}.log`, 표본 `/tmp/scenenote-published-list-sample.json`, 화면 `/tmp/scenenote-published-list-empty.png`.
- 사용자 배포 요청이 이어지는 범위에서 fetch-episodes만 배포했다. 최종 v10 ACTIVE, verify_jwt=true 확인. DB·사용자 기록 변경 없음. 임시 로컬 응답 진단 코드 제거. iOS/Android 실기기·API 목록 제공 작품의 네이티브 선택 동작은 환경 부재로 미검증. 실제 OTT별 제공 회차와 AniList 스트리밍 링크 목록의 지역 차이는 남는다.

## 총 화수 미정 작품의 회차 선택 복구 (2026-10-16)

- 사용자 신고는 0이라는 시청 값이 아니라 1·2·3화 빠른 선택 영역 누락이었다. `EpisodeProgressCard`가 총 화수 null이면 선택 영역을 숨기고 공개 회차를 조회하지 않았다. AniList 3기는 별도 콘텐츠인데 등록 표시 기수 3과 실제 시즌 행 1이 달라 조회가 연결되지 않는 문제도 확인했다.
- 기존 공개 회차 훅을 `useEpisodeAvailability`로 재사용하도록 분리하고, 실제 시즌을 골라 조회한 공개 회차로 빠른 선택을 표시한다. 총 화수 미정 표시·기존 입력 상한·진행 분모·완료 판정·개인 시청 기록은 유지한다. 조회 중/없음/실패 안내와 재시도 추가.
- 자동: 시작 1231/1232, 최종 1233/1234 통과, 기존 추천 엔진 실패 1건만 유지. 공개 회차 선택 수 회귀는 구현 전 실패·후 통과, 독립 AniList 후속기의 실제 시즌 선택 회귀 추가. typecheck·lint·diff 검사 통과. 로그 `/tmp/scenenote-airing-choices-{before,red,after,typecheck,lint}.log`.
- 실제 8081 작품 상세: 운영 API가 공개 3화를 반환하고 현재 3화까지 공개 안내 및 1·2·3화 radio 표시. 3화 선택 시 입력 3 반영을 확인한 뒤 입력을 0으로 복원했으며 저장하지 않았다. 375·768 폭에서 문서 폭이 화면 폭과 같음 확인, 1440 화면 증빙 `/tmp/scenenote-airing-choices-fixed.png`. viewport 복원. 임시 진단 로그 제거. 서버·DB 배포 불필요(기존 API 정상). iOS/Android 실기기·큰 글자는 실행 환경 부재로 미검증.

## 검색 종료 문구 정렬 (2026-10-16)

- 검색 결과 끝의 `모든 결과를 확인했습니다.`만 Text로 직접 렌더링돼 FlashList의 확장 여백 끝에 붙던 문제를 수정했다. `app/search.tsx`에서 기존 `loadMoreFooter`로 감싸 중앙 정렬·64pt 최소 높이·상하 여백을 재사용하고, 문구는 typography.caption·textMuted·줄바꿈 가능한 스타일로 표시한다. 추천 스켈레톤·공용 꼬리말 스타일·검색 동작은 변경하지 않았다.
- 웹 8081 실제 검색에서 1440·768·375 폭의 중앙 정렬 확인. 375·768 문서 폭은 각각 화면 폭과 같고 가로 넘침 없음, 중앙 오차 0px. 768 갤러리에서도 중앙 정렬과 꼬리말 높이 64 확인. 보기 모드와 viewport 복원. 증빙 `/tmp/scenenote-search-footer-fixed.png`.
- npm test 1231/1232(기존 추천 엔진 실패 1개), typecheck·lint 통과. 새 단위 테스트는 스타일 감싸기 변경이라 추가하지 않았다. iOS/Android 실기기와 큰 글자 검증은 실행 환경 부재로 미검증이다. 서버 배포·DB 변경 없음.

## 애니 검색 전체 시즌 운영 배포 (2026-10-16)

- 사용자 배포 요청에 따라 앱 설정과 CLI 연결 프로젝트 일치를 확인하고 `search-content`만 `--use-api`로 배포했다. 운영 **v28 ACTIVE, verify_jwt=true** 확인. docs/62의 2~8기 펼치기 및 AniList 후속 조회와 커밋된 docs/56의 짧은 검색어 보정이 함께 반영됐다. 다른 함수·DB·secret 변경 없음.
- 구현 검사: `npm test` 1231/1232(기존 추천 엔진 실패 1개), typecheck·lint·esbuild·diff 검사 통과, TMDB 골든 전후 23/23. AS-1~AS-3·AF-1~AF-7은 구현 전 전부 실패, 구현 후 전부 통과. 기존 1·2단계와 공용 조회 헬퍼 및 기존 테스트 보존 확인.
- 실제 8081 웹, 기존 로그인 세션 사용: `감정스킬로`에서 AniList 1기·2기·3기 세 카드와 3기 제목 확인. 응답 word_split_fallback=true, anime_follow_up=true, 재조회 cached=true. 전체 제목은 같은 세 카드와 두 플래그 false. `너말고`는 `너 말고 다른 연애` 포함 2개, word split만 true. `오징어게임`은 기존 시즌 결과와 두 플래그 false. 네 응답 모두 failedSources=[] 확인. 카드 추가·완료와 로그인 대행 없음.
- 증빙: `/tmp/scenenote62-deployed-seasons.png`, `/tmp/scenenote62-deploy-responses.json`, `/tmp/scenenote62-deployed-functions.json`, `/tmp/scenenote62-deploy-drift.log`. 플래그 확인용 임시 로컬 진단 코드는 원래 파일과 바이트 단위로 동일하게 복원. 기존 서버 재시작 없음.
- iOS M-4는 simctl 도구가 없어 미검증. edge:drift는 미커밋 코드 때문에 배포 후에도 search-content uncommitted로 표시하며 v28 배포 성공과 구분한다. 다른 함수들의 배포 불일치는 이번 범위 밖이다.

## 검색 추천의 라이브러리 조회 오류 정정 (2026-10-10)

- 검색 화면의 추천 영역에서 `라이브러리 정보를 불러오지 못해 취향을 분석할 수 없습니다`를 재현했다. 임시 오류 진단으로 시즌 조회의 `Bad Request`, 작품 ID 628개를 확인했다. `getLibraryItems`의 메타데이터 보강에서 전체 UUID를 한 `.in()` URL로 요청하던 것을 100개 ID씩 분할하여 요청 길이를 줄였다. 진단 코드는 제거했다.
- 감상·시즌·시청 진행·방영일 4개 조회에 `readBatchedRows`를 적용했다. 각 묶음은 ID 정렬과 1000행 페이지 조회로 결과 누락을 방지하고, 후속 묶음 실패 시 부분 성공으로 처리하지 않는다. 추천 필터·개인 기록·D-N·서버 및 DB 계약 변경 없음.
- 자동: 시작 경로·git 상태와 `npm test` 기준선 확인(1068/1069). 수정 후 1073/1074, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패. 새 5개 테스트는 628개 ID 분할·추가 페이지·후속 실패·빈 입력/중복·잘못된 크기를 확인한다. typecheck·lint·diff 공백 검사 통과. 로그 `/tmp/scenenote-library-error-{before,after,typecheck,lint}.log`.
- 실제 웹: 기존 8081 검색 화면의 동일한 2025년·애니/드라마·일본/한국 필터에서 오류 문구 제거, 추천 12개 표시와 새 추천 버튼 활성 확인. 증빙 `/tmp/scenenote-search-library-recovered.png`. 서버 재시작·배포·계정 기록 저장 없음. iOS/Android 실기기는 실행 환경이 없어 미검증이며, 실제 계정의 작품 완료 저장은 이번 조회 검증에 포함하지 않았다.

## 추천 캐시 카드 완료 무반응 정정 (2026-10-10)

- 실제 8081 검색 화면에서 라이브러리 조회 오류와 기존 추천 카드가 함께 표시되고, `모텔 캘리포니아 완료` 클릭이 반응 없이 끝나는 상황을 재현했다. 추천 요청이 비활성화되면 `removeOptimistically`가 null을 반환하여 저장 이전에 종료하는 것이 원인이다.
- `usePersonalizedRecommendations`의 캐시 제거·복원 조건을 요청 활성 조건과 분리했다. 현재 계정·추천 캐시 identity·마운트 범위를 확인하며 요청·자동 보충의 활성 조건은 유지한다. 캐시에서 카드를 찾지 못할 때 안내 토스트를 추가했다. [46 명세](46_recommendation_complete_action_spec.md#10-캐시-카드-완료-무반응-정정-2026-10-10)의 D-N 변경 없음.
- 자동: 시작 `git status --short`로 기존 변경 확인. 기준선 `npm test` 1066/1067, 수정 후 1068/1069. 새 회귀 2개는 구현 전 실패·구현 후 통과하며 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패한다. typecheck·lint 통과. 로그 `/tmp/scenenote-complete-{before,red,after,typecheck,lint}.log`.
- 격리 웹: 실제 추천 훅과 모의 계정·캐시를 사용하여 활성→라이브러리 실패(요청 비활성) 전환 뒤 완료 경로 진입·캐시 제거, 저장 실패 복원을 확인했다. 서버 저장은 모사이며 실제 계정의 완료 저장 성공은 확인하지 않았다. 증빙 `/tmp/scenenote-completion-qa/result.png`. 임시 public QA 파일은 제거했고 기존 8081 서버 재시작·배포·DB 변경 없음.
- 미검증: 실제 계정 저장 성공, iOS/Android 실기기, 계정·필터 전환의 UI 연속 동작. 조회 장애와 네이티브 실행 환경 제약으로 남긴다. 계정·필터·언마운트 차단은 순수 함수 테스트로 확인했다.

## 검색·라이브러리 상세 복귀 스크롤 유지 (2026-10-03)

- `useListScrollRestoration` + 세션 전용 `listScrollStore`를 검색·라이브러리 FlashList에 연결했다. 계정·검색 조건·정렬·보기별 offset/표시 개수 분리, 레이아웃·페이지 준비 후 복원, 비활성 화면/복원 이벤트 제외를 적용한다. 라이브러리 복귀 시 첫 묶음으로 표시 개수를 줄이던 효과를 저장된 개수 복원으로 바꿨다. 새 조건은 처음부터 시작한다. 서버·API·DB·저장 필터 계약은 변경하지 않았다.
- 자동: 복원 대기·페이지 준비·짧아진 목록 clamp·새 검색 0 offset 순수 테스트 4개 추가. 전체 `npm test` 888/889, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건 실패. typecheck·최종 전체 lint·웹 build·diff 공백 검사 통과. 동시 작업의 임시 `public/__codex_misclick_qa.js` 때문에 중간 전체 lint는 실패했으며 해당 작업의 정리 후 재실행은 통과했다. 로그 `/tmp/scenenote-scroll-{tests,typecheck,lint,focused-lint,build}.log`.
- 웹: 기존 8081 서버의 별도 로그인 세션 탭에서 라이브러리 아래쪽 카드 → 상세 → 뒤로 후 같은 카드/확장된 표시 개수 유지 확인. 검색 `사랑`의 필터 밖 결과 모두 보기에서 아래쪽 작품 → 상세 → 뒤로 복귀 offset 1234→1235px 확인, `건담` 새 검색은 0px 확인. 그림 증빙 `/Users/youngilkim/.codex/visualizations/2026/10/03/01a0ff70-82c7-7311-ad18-bb54cca11cfb/scroll-restore/library-return.jpg`.
- 미검증: iOS/Android 실기기 제스처·큰 글자, 브라우저 새로고침(세션 메모리 보존 대상 아님), 오래된 Query 페이지가 GC된 뒤 복귀, 모든 추천·유사 검색/계정 전환 조합. 네이티브 실행 환경이 없어 플랫폼 동작 확인은 남긴다. 서버 재시작·배포·개인 감상 기록 변경 없음.

## 추천 추가 오입력 방지 (2026-10-03, 미커밋)

사용자가 의도하지 않은 모노노케 등록을 보고했다. [43 명세](43_recommendation_add_misclick_fixes_spec.md)에 따라 추가한 카드의 표시 인덱스를 유지하고 `추가 중`/`추가됨`으로 비활성화한다. 보충은 뒤에 붙이고, 추가 진행·800ms 예약 대기에는 기존 자동 보충을 보류한다. 갤러리/목록의 press 시작 identity 검증·동기 중복 잠금·작품 제목 포함 토스트·FlashList 완료 키 갱신을 추가했다. 당시 클릭/요청 로그는 없어 모노노케의 실제 등록 경위는 미확정이며 사용자 기록·DB·서버 배포를 변경하지 않았다.

- 자동 검사: MC-1~MC-9는 구현 전 신규 export 없음으로 실패, 구현 후 모두 통과. 시작 전체 테스트 875/876, 최종 888/889(이번 추가 9개, 동시에 다른 작업의 목록 스크롤 테스트 4개가 추가됨). 실패는 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건이다. typecheck·lint·diff 공백 검사 통과. 로그 `/tmp/scenenote-misclick-{baseline,red,after,lint}.log`.
- 격리 웹: 실제 추천 갤러리/목록 카드와 순수 유틸을 사용하고 외부 저장 없이 지연을 모사했다. 768px 갤러리 A 더블클릭 → 시험 요청 A 1회, 모노노케 B 버튼 좌표 (285,576.875) 불변. 375px 목록 C 더블클릭 → C 1회만 추가. 1440px 컨테이너 선택 후 A/C는 `추가됨`·비활성, B는 활성, 보충은 끝에 유지. 임시 public QA 파일·시험 탭 정리, 기존 8081 서버 재시작 없음.
- 미검증: 로그인된 실제 Expo 화면의 전체 훅/서버 지연·실패 복원·키보드·계정 전환, 실제 viewport 375/768/1440, iOS/Android 세로·글자 1.3배·셀 재사용. 실제 계정 기록을 추가하지 않고 컴포넌트 격리 검사만 했다. 기존 Chrome 탭은 다른 작업이 사용 중이어서 조작하지 않았다. 42의 서버 지연 개선과 41의 취향 레인 재배포는 별도 후속 작업이다.


작성일: 2026-05-02

## 작품 상세 Disney+ 연결 오류 정정 (2026-10-03)

- 원인: `createProviderLink`가 만든 `https://www.disneyplus.com/search?q=...`이 없는 페이지로 연결됨. 한국어 검색 경로 역시 오류 페이지였고, 해당 페이지의 공식 홈 링크는 `/ko-kr`으로 정상 연결됨을 Chrome에서 확인했다.
- 서버 링크 생성과 클라이언트 클릭이 공유하는 `_shared/watchProviderLinks.ts`를 추가했다. 기존 서버 응답·캐시의 Disney 검색 URL만 홈으로 교정하며 실제 작품 주소와 다른 OTT 주소는 유지한다. `WatchProviderList`에 홈에서 작품명을 검색하라는 안내와 링크 열기 실패 한국어 토스트를 추가했다. 분류·정렬·카드 스타일·사용자 감상 기록은 변경하지 않았다.
- 검사: `npm test` 수정 전 842/843, 수정 후 846/847. 추가 회귀 4개 통과, 기존 추천 엔진 `uses latest-popular fallback ordering with an empty library` 1건만 실패. typecheck, lint, 웹 build(export), `npx --no-install deno check supabase/functions/get-watch-providers/index.ts`, diff 공백 검사 통과. 로그: `/tmp/scenenote-ott-{before,after,typecheck,lint,build,deno}.log`.
- 웹: 기존 8081 서버에서 메이드 인 코리아의 Disney Plus 버튼 → 정상 한국어 홈을 확인했다. 375 폭에서 안내 줄바꿈과 가로 넘침 없음(문서 폭 375)을 확인하고 viewport를 복원했다. iOS/Android 실기기·큰 글자, Disney 로그인 이후 작품 검색·재생, 다른 OTT의 실제 사이트 연결 및 강제 링크 열기 실패는 미검증이다. 기기/시뮬레이터와 OTT 로그인 없이 가능한 범위만 확인했다.
- 배포·DB 변경 없음. 클라이언트 교정은 이전 Edge 응답에도 적용된다. 운영 웹·앱에는 클라이언트 릴리스가 필요하며 서버에서 새 주소를 내려주려면 `get-watch-providers` 재배포가 필요하다.

## 라이브러리 기본 갤러리·카드 높이 정렬 (2026-10-03)

사용자 첨부 화면은 Underbar가 아닌 SceneNote 라이브러리와 일치해 이 저장소에서 수정했다. 기존 미커밋 변경은 보존했다.

- `src/stores/libraryUiStore.ts`: 기본 갤러리, 저장 설정 version 1로 이전 설정을 갤러리로 한 번 이관. 이후 사용자가 고른 상세/갤러리 보기는 기존 방식으로 저장한다. URL의 명시적 보기 선택은 유지한다.
- `src/components/content/ContentGalleryCard.tsx`, `app/(tabs)/library.tsx`: 정보 영역의 자연 높이(여백 포함)를 측정해 현재 폭·글자 배율에서 관측한 최대값을 모든 갤러리 카드의 최소 높이에 적용한다. 창 폭·글자 배율 변경 시 재측정하며 새로 렌더되는 더 큰 카드도 반영한다. 제목 두 줄 공간, 포스터 2:3, 기존 장르/상태 배지와 회차 이동 계약을 유지하고 이어보기 버튼의 중첩 Pressable을 제거했다. 기존 토큰·AppImage를 재사용하며 API/DB 변경은 없다.
- 실제 검사: `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check` 통과. `npm test`는 843개 중 842개 통과, 미변경 추천 엔진의 `uses latest-popular fallback ordering with an empty library` 1건 실패(추천 이유에 `최신`을 기대). 해당 테스트 파일 단독 실행에서도 재현됐으며 추천 엔진/테스트는 HEAD와 동일하다. 관련 라이브러리 반응형·URL·이어보기 테스트 24개 통과. 로그는 `/tmp/scenenote-gallery-{test,focused,existing-failure,typecheck,lint,build}.log`.
- 기존 8081 서버의 로그인된 Chrome에서 375·768·1440 및 기본 데스크톱 폭을 확인했다. 375의 카드 높이 438.25, 768의 445, 기본 데스크톱의 약 461로 각 폭에서 같은 행의 하단선이 일치했고 카드 좌우가 콘텐츠 범위 안에 있다. 회차 버튼 → 에피소드 목록 이동, URL 보기 파라미터 없는 `/library` 진입의 갤러리 선택을 확인했다. viewport 임시 설정을 해제했다. 서버 재시작·배포·개인 기록 변경은 하지 않았다.
- 미검증: iOS/Android 실기기·시뮬레이터, 시스템 글자 1.3배·스크린리더, 저장 설정 이관의 모든 기기 조합. Web build는 Native 동작 검증이 아니다. 각 기기에서 갤러리 기본 진입·큰 글자·긴 장르/상태 배지·회차 버튼·스크롤을 확인하고 기존 추천 테스트 실패는 별도 후속 작업으로 조사한다.

## 현재 작업 재개 기준 (2026-09-26)

코드 대조 기준: `main`, `198a064`의 작업 트리. 이번 작업은 Markdown 문서만 점검·보완했다. 아래의 **코드 확인**은 정적 조사 결과이며 실행·배포·실기기 검증 완료를 의미하지 않는다. 초기 5월 기록은 뒤에 별도로 보존한다.

| 영역 | 확인한 상태 | 근거·다음 확인 |
|------|-------------|----------------|
| 앱 구조·핵심 기능 | Expo Router, 인증, 검색/추천, 라이브러리, 진행률, 핀 CRUD 코드 존재 | [README](../README.md), [04](04_architecture.md), [08](08_frontend_architecture.md)에서 기능별 진입점 확인 |
| 5월 이후 기능 | 비밀번호 재설정, 리뷰, 라이브러리 제거, 회원 탈퇴, 공유 코드 존재 | `src/hooks/useAuth.ts`, `src/services/reviews.ts`, `src/services/library.ts`의 `deleteLibraryItem`, `src/services/account.ts`, `src/services/libraryShare.ts` |
| 기능 노출 | `EXTENDED_FEATURES_ENABLED=false`, `SEARCH_RECOMMENDATIONS_ENABLED=true`, `PEOPLE_FEATURES_ENABLED=true`, `SHARE_FEATURES_ENABLED=true`(2026-10-02, 라이브러리 공유·`/share`만) | `src/constants/features.ts`. 코드 존재와 노출은 다르다. 공개 공유 링크는 만료 미설정·발급 목록/회수 UI 없음(docs/11 선행 조건 미구현). 리뷰는 별도 검토 필요 |
| DB·서버 | `supabase/migrations/0001`~`0021` SQL, npm 배포 목록 14개 함수 존재 | 파일 존재만 확인. 원격 migration 적용·함수 버전·secret 설정은 이번에 조회하지 않음 |
| 문서 정비 | 실행 안내·목차·현행 코드 지도·과거 기록 구분, 공통 AI 규칙 보완 | 이번 검증은 경로/링크/스크립트와 diff 정적 점검. 앱 테스트·빌드·서버·DB 작업 없음 |

이번 문서 검증 결과: 변경 Markdown 18개에서 상대 링크·앵커 193건과 추가된 npm 스크립트명 14종을 로컬 검사해 오류가 없었다. 코드 경로는 실재 경로와 명시적인 부재 예제를 구분해 대조했다. `git diff --check`, 변경 범위·원문 보존 확인, 추가 문구의 비밀값 패턴 검사도 통과했다. 기존 Python 스킬 검증기는 `PyYAML` 미설치로 실행되지 않아 저장소에 이미 설치된 Node `yaml`로 두 스킬 및 네 에이전트의 frontmatter를 파싱하고 스킬 메타데이터·미완성 표식을 대신 검사했다. 의존성은 설치·변경하지 않았다. 실제 스킬 선택·새 세션 지침 로딩 및 앱 동작은 별도 확인 대상이다.

### 일본 드라마 원작 검색 복구 (2026-09-29)

`결혼 못하는` 검색에서 TMDB의 2006년 일본 원작(`13372`, 시즌 1)이 누락되고 2019년 후속작(같은 TMDB id, 시즌 2)만 표시됐다. TMDB 응답과 원격 검색 캐시에는 두 시즌이 모두 있었으나 배포된 `search-content` v25의 `compactResults`가 `source:id`만으로 합쳤다. 저장소의 시즌별 키(`source:id:season_number`)와 기존 T-1~T-5 회귀 테스트는 이미 이 결함을 수정한 상태였다.

- 사용자 승인 후 앱과 CLI의 프로젝트 ref `pstkeooflscvtaxxrwdf`를 대조하고 `search-content` 함수 하나만 배포했다. 원격 **v26 ACTIVE, verify_jwt=true** 확인. DB·secret·다른 함수는 변경하지 않았다.
- `normalize.test.ts` 20/20 통과, `deno check supabase/functions/search-content/index.ts` 통과. 변경 전 원격 코드와 현재 저장소의 차이는 `adapters/normalize.ts`의 시즌 병합 로직이었다.
- 8081 웹 서버를 복구하고 로그인된 Chrome에서 새로고침 후 같은 검색어를 실행했다. 2019년 일본 후속작, 2009년 한국 리메이크, **2006년 일본 원작(12화)** 카드가 각각 표시됐다. 증빙 화면: `/tmp/scenenote-search-2006-verified.png`. iOS·Android 실기기와 다른 검색어 전체는 이번에 재검증하지 않았다.

### Edge Function 배포 동기화 (docs/35)

- `supabase/functions/`를 바꾼 작업은 끝에 `npm run edge:drift`를 실행해 결과 표를 보고한다. `stale`·`not_deployed`·`uncommitted`가 있으면 재배포 대상 목록을 사람에게 넘긴다. 도구는 읽기 전용이며 배포하지 않는다.
- 검색 관련 변경은 `npm run search:golden`으로 12개 기준 작품을 다시 확인한다. 새 누락 사례는 `scripts/searchGolden.ts`의 `SEARCH_GOLDEN_CASES`에 추가한다.
- 2026-09-29 실측: 13개 중 11개 함수가 코드보다 오래된 배포, `delete-account` 미배포([35 2절](35_search_completeness_and_deploy_drift_spec.md#2-배포-불일치-실측-2026-09-29-kst)). 이번 구현에서 `search-content`는 미커밋 변경으로 표시되며 배포하지 않았다.
- 구현 검증: K-1은 수정 전 `anime ≠ jdrama`로 실패, 수정 후 검색 관련 93/93 통과. 전체 `npm test`는 시작 675/676에서 41개 테스트 추가 후 716/717이며, 기존 `uses latest-popular fallback ordering with an empty library` 1건은 이번 허용 파일 밖의 추천 테스트 실패로 남았다. `npm run typecheck`, `npm run lint`, `npm run build`(웹 export), `deno check supabase/functions/search-content/index.ts`, `git diff --check`는 통과했다. `npm run search:golden`은 실제 TMDB 조회 12/12, `npm run edge:drift`는 `search-content`의 미커밋 변경 등 재배포 대상 13개를 보고하고 종료 코드 1을 반환했다. 토큰 누락은 네트워크 호출 전 종료 코드 2를 확인했다.
- 8081 Chrome 웹에서 `결혼 못하는`에 2024년 필터를 적용하면 숨김 3개·"모두 보기"가 표시되고 세 카드를 열람할 수 있었다. 검증 뒤 계정 필터를 전체로 복원했다. 새 서버 계약과 국가 필터를 포함한 운영 동작은 `search-content` 재배포 전에는 웹에서 확인할 수 없고, iOS·Android 실기기는 이번에 실행하지 않았다.

### 추천 필터·API 재사용 후속 수정 (2026-09-26, 미커밋 작업)

이번 사용자 요청은 제외 안내만 반복하는 빈 추천과 API 낭비 수정이다. 기존 문서 정비·홈 개편 변경은 보존했다. [30 후속 범위](30_recommendation_fill_and_action_consistency_fixes_spec.md#6-2026-09-26-후속-요청-조회-전-필터와-재사용)에 따라 조회 전 계정 필터, 공개 메타데이터 영속 캐시, 미확인 후보 커서 재개, 필터별 Query key·커서 재시도를 구현했다. DB migration·secret 변경은 없다.

- 원격 `personalized-recommendations` v14를 별도 임시 디렉터리에 내려받아 비교: 로컬의 키워드 보강 및 최종 계정 제외 판정 연결이 빠져 있었다. 현재 앱과 CLI 연결 대상이 같은 프로젝트임을 확인한 뒤 이 함수만 배포했다. 최종 원격 v16 `ACTIVE`, `verify_jwt=true` 확인. 다른 13개 함수는 배포하지 않았다.
- 수정 범위: `app/search.tsx`, `usePersonalizedRecommendations.ts`, query key·추천 Feed/Preferences/Visibility 유틸, 서버 Catalog/Providers/Themes 및 새 Cache/ProviderFilters 모듈, 해당 회귀 테스트.
- 최종 자동 검증: `npm test` **537/537**, `npm run typecheck`, `npm run lint`, `npx --yes deno check supabase/functions/personalized-recommendations/index.ts`, `git diff --check` 통과. 자동 보충 잠금 해제 경합을 수정했고, 제공처 장애·복구 및 캐시를 사용하는 다음 페이지의 후보 누락 회귀 테스트를 포함했다. 테스트 로그: `/tmp/scenenote-recommendation-tests.log`.
- 웹 실행 확인: 기존 8081 서버·로그인 계정과 제외 설정 3개를 유지했다. 자동 보충으로 **4→9→12개**, 실제 하단 스크롤 후 **24개**(서로 다른 카드 접근성 이름 24개)를 확인했다. 홈→검색 복귀 때 12개 캐시가 유지됐고 추천 응답 로그 추가가 없었다. 최종 v16 배포·브라우저 새로고침 후에도 **7→12개 자동 보충**, 로딩 종료·새 추천 버튼 활성·추천 오류 로그 없음 확인. 마지막 응답은 5,368ms + 2,694ms였으며 첫 콜드 응답은 8,793ms였다. 환경별 성능 보장이나 실제 청구 비용 감소 실측으로 일반화하지 않는다.
- API 비용 검증은 fetch mock으로 진행했다. 인스턴스 교체 후 캐시 재사용, 캐시 적중 시 외부 호출 0회, 실패/빈 키워드 TTL, 한 요청의 새 키워드 조회 최대16회, 첫8개 제외 뒤 뒤쪽12개 검증을 포함한다. 현재 추천 경로에 LLM 호출은 없다.

수용 검증 대응: RFC-01~05·07과 RSP-01~08·10의 순수 계약은 전체 테스트에 포함된다. 필터·자동 보충·스크롤·화면 복귀는 위의 인증된 Chrome 웹 실행으로 확인했다. RFC-06/RSP-09의 데스크톱 아이콘 동일 노출은 화면으로 확인했지만 이번 변경에 카드 JSX 수정은 없다. 320/360/390/430 및 큰 글자·iOS/Android 접근성, 다른 실제 계정 전환, 실제 공급자 강제 장애/네트워크 차단은 이번에 재실행하지 않았다. 계정 필터 분리·장애·기한·취소는 자동 테스트로 검사하며 수동 플랫폼 검증을 대신하지 않는다.

### 원하는 장르·제작 국가 필터 (2026-09-27, 미커밋 작업)

사용자 요청에 따라 [22 후속 계약](22_search_recommendations_restore_spec.md#7-2026-09-27-후속-요청--원하는-장르제작-국가)의 선택 필터를 구현했다. `ContentSearchBar`의 적용/취소 시트와 `app/search.tsx`의 적용 요약·추천 진입 버튼을 연결하고, 검색/추천 hook·service·query key 및 서버의 공유 `discoveryFilters` 판정에 같은 장르 AND 제작 국가 조건을 전달한다. 계정별 추천 제외가 우선하며 원하는 조건을 맞추기 위해 제외를 완화하지 않는다. 기존 홈·문서 변경은 보존했고 DB migration·secret 변경은 없다.

- 공급자 조회 전에 지원하는 장르·제작국 조건을 적용하고 조건별 추천 캐시·커서를 분리했다. 일반 제목 검색은 원본 페이지 캐시를 재사용한 뒤 필터를 적용한다. 영화 제작국은 상세 메타데이터, TMDB TV의 로맨스·공포·스릴러는 정확히 일치하는 공급자 키워드로 확인하며 언어나 줄거리로 추정하지 않는다. 새 메타데이터 조회는 한 제목 검색에서 합산 8건·3초 이내이고 정상/실패 캐시를 재사용한다.
- 자동 검증: `npm test` **567/567**, `npm run typecheck`, `npm run lint`, `npx --yes deno check supabase/functions/personalized-recommendations/index.ts supabase/functions/search-content/index.ts`, `git diff --check` 통과. 로그: `/tmp/scenenote-positive-tests.log`. 장르 별칭·교집합·국가 미확인·계정 제외 우선, 조건별 캐시/커서 격리, 제공처 요청 조건·조회 예산 회귀를 포함한다.
- 앱과 CLI의 프로젝트 일치를 확인하고 두 함수만 배포했다. 원격 `search-content` **v24**, `personalized-recommendations` **v17**, 모두 `ACTIVE`, `verify_jwt=true` 확인. 다른 함수·DB는 배포하지 않았다.
- 인증된 Chrome 웹(8081): `코미디 · 일본`을 선택하고 취소하면 적용값이 바뀌지 않으며 추천 응답 추가 **0건**. 적용하면 요약이 표시되고 기존 제외 3개를 유지한 채 자동 보충으로 **12개**가 표시됐다. 최초 응답과 6회 보충 합산 약21.5초, 첫 3개는 약9초에 도착했다. 요청당 약2.3~3.8초였고 추천 오류/시간 초과는 없었다. 모든 조건에서 같은 속도나 12개 충족을 보장한다는 뜻은 아니다.
- 같은 조건의 `은혼` 제목 검색에서 영화·일본 TV 결과를 확인했다. 일부 공급자 결과가 없다는 기존 partial 안내도 표시됐으므로 전체 공급자 정상 응답으로 기록하지 않는다. 검색어를 지우면 해당 조건의 추천 12개 캐시로 복귀했다. 검증 후 선택 조건을 전체로 되돌렸다.
- 반응형 웹 390×844·320×568에서 시트·적용/초기화 버튼(48px)이 화면 안에 표시되고, 320px에서 가로 넘침이 없음을 확인했다. 증빙: `/tmp/scenenote-positive-filters/desktop.png`, `/tmp/scenenote-positive-filters/mobile-sheet.png`. 웹 실물 확인은 일본+코미디에 한정하며 다른 국가·장르/미확인 메타데이터·장애 조합은 자동 테스트로 확인했다. iOS/Android 실기기·VoiceOver·큰 글자·오프라인·실제 계정 전환은 실행하지 않았다. 기존 홈 카드의 중첩 button 콘솔 오류는 이번 필터 수정 범위 밖에 남아 있다.

### 다중 선택·계정 저장과 텍스트 토글 (2026-09-27, 미커밋 작업)

[22 §8](22_search_recommendations_restore_spec.md#8-2026-09-27-후속-요청--다중-선택과-계정별-저장)에 따라 유형·장르·제작 국가를 복수 선택한다. 같은 그룹은 OR, 그룹 간은 AND이며 계정 제외가 우선한다. 후속 사용자 요청으로 네모/체크 아이콘을 제거하고 텍스트 칩의 배경·테두리·글자색으로 켜짐/꺼짐을 표시한다. 접근성 `checked`는 네이티브와 웹 모두 유지한다.

- `ContentSearchBar`의 임시 선택을 `useSearchFilterPreferences` → 서비스 → `profiles.search_filters`에 저장하고, 성공한 값만 화면에 적용한다. 저장 전에 조회 완료를 기다리고, 취소/실패/계정 전환/늦은 응답을 분리했다. 최근 검색어는 기기 내 계정별로 분리하며 과거 미귀속 검색어는 삭제 없이 숨긴다.
- 검색·추천 hook/service와 공유 `discoveryFilters`, 두 Edge 핸들러, TMDB/AniList 조회가 배열 조건을 전달한다. 선택 순서와 중복에 무관한 캐시·커서, 조회 조건 근거와 실제 메타데이터의 구분, 제한된 요청 예산을 검증했다. 조합 수에 비례해 모든 국가×장르를 개별 호출하지 않는다.
- `npm test` **591/591**, 전체 typecheck/lint, 두 핸들러 Deno check, diff 검사 통과. 로그는 `/tmp/scenenote-multi-full-test.log`, `/tmp/scenenote-multi-typecheck.log`, `/tmp/scenenote-multi-lint.log`, `/tmp/scenenote-multi-deno.log`. 마지막 체크 아이콘 제거 후 대상 lint·전체 typecheck도 통과했다. 저장 정규화·실패 시 기존값 유지·중복 저장·늦은 응답·A→B→A·검색어 계정 분리는 순수 테스트로 검증했다.
- 원격 migration 목록 일치와 dry-run의 0022 단독 변경을 확인한 뒤 **0022_profile_search_filters.sql 적용 완료**. 기존 본인 프로필 RLS를 재사용한다. 앱과 동일한 프로젝트에 `search-content` **v25**, `personalized-recommendations` **v18**을 배포했고 두 함수 `ACTIVE`, `verify_jwt=true`와 migration 0001~0022 일치를 확인했다. 다른 함수·secret 변경은 없다.
- 인증된 Chrome 웹 8081에서 애니+드라마 / 미스터리+코미디 / 한국+일본을 저장하고 **전체 페이지 새로고침 후 여섯 선택 복원**을 확인했다. 추가로 공포·미국을 고른 뒤 취소하면 기존 여섯 선택만 유지됐다. 초기화 적용은 전체로 저장됐다. 마지막 아이콘 제거 후 여섯 항목의 독립 토글과 접근성 checked 상태, 아이콘 없는 텍스트를 확인했다. 검증용 임시 선택은 취소하고 저장 조건은 검증 전 전체로 복원했다.
- 390×844와 320×568 웹에서 줄바꿈·시트 스크롤과 고정 적용 버튼(48px)을 확인했다. 320px에서 시트 clientWidth/scrollWidth 모두320, 적용 버튼 하단544로 화면 내부다. 최종 증빙: `/tmp/scenenote-multi-filters/desktop-toggle.png`, `/tmp/scenenote-multi-filters/mobile-toggle.png`. 아이콘 제거 전 저장 복원 증빙은 `desktop-restored.png`다.
- 한 실제 계정의 저장/복원을 확인했으며 다른 계정·다른 기기·오프라인 실패·iOS/Android 실기기·VoiceOver/TalkBack·큰 글자는 미실행이다. 원격 정책 카탈로그 조회는 Management API의 `database_read` 권한 부족(403)으로 실행하지 못했으므로 두 실제 계정의 RLS 격리 확인을 완료로 간주하지 않는다. 이번 웹 검증은 필터/저장/반응형에 한정하며 SRR-03~06·09~16·19~22의 전체 수동 흐름을 재실행하지 않았다.

### 애니·일본 필터 503 복구 (2026-09-27, 미커밋 작업)

직전 다중 선택 구현에서 AniList에 사용하지 않는 `countryOfOrigin_in: null`까지 전달해 추천이 실패했다. 사용자와 동일한 `애니 / 모든 장르 / 일본`, 계정 제외3개 상태의 Chrome 로그에서 HTTP503 `ALL_PROVIDERS_FAILED`(1,721ms)를 확인했다. 익명 AniList 진단 총4회에서 기존 쿼리 HTTP500, 해당 인자만 생략한 쿼리 HTTP200(18개), 실제 복수 국가 배열 쿼리 HTTP200을 확인했다. nullable 스키마만으로 실제 resolver의 null 처리를 보장할 수 없었고 기존 응답 모킹은 이 차이를 잡지 못했다.

- `recommendationProviders.ts`: 미선택 장르·국가·제외 조건은 GraphQL 인자와 변수 모두 생략한다. 장르 OR 별칭·국가 다중 선택·50개 후보 예산을 보존했다. AniList 페이지 캐시만 `recommendation-provider-anilist-v4`로 분리해 기존 실패 캐시를 재사용하지 않으며 TMDB·한국어 제목 캐시는 유지했다. UI·저장된 필터·DB는 변경하지 않았다.
- `recommendationProviders.test.ts`: 단일 국가/전체/여러 국가, 단일/복수 장르, 애니메이션 전체 장르 의미, 오래된 실패 캐시를 포함한 회귀7개 추가. 실제 null-list HTTP500을 모킹해 수정 전7개 실패, 수정 후 관련47개 통과를 확인했다. 전체 `npm test` **598/598**, `npm run typecheck`, `npm run lint`, 두 관련 핸들러 Deno check, `git diff --check` 통과. 전체 로그: `/tmp/scenenote-anime-503-tests.log`.
- 해당 코드 경로를 실행하는 `personalized-recommendations`만 배포해 **v19 ACTIVE, verify_jwt=true**를 확인했다. 기존 `search-content`의 공유 모듈 사용은 변경되지 않은 키워드 helper에 한정되어 재배포하지 않았다.
- 인증된 Chrome 웹8081에서 사용자 필터·제외3개를 유지한 채 재시도1회. 초기 응답0개(6.646초) 후 자동 보충1개(2.967초),11개(4.472초)로 **약14.1초에 12개 표시**를 확인했다. 세 응답 모두 partial=false, failedSources=[]였고 이후 새 추천 오류 로그는0개였다. 증빙: `/tmp/scenenote-anime-503/recovered.png`. 다른 계정·조건의 동일 응답시간이나12개 보장을 의미하지 않는다.
- 전체/복수 국가 등의 요청 조합과 실패/복구 계약은 자동 테스트로 확인했고 실제 UI는 신고한 단일 조건을 검증했다. iOS/Android 실기기·강제 오프라인·공급자 장애 주입은 재실행하지 않았다. 라이브러리·시즌·카드 편집 등 이번 수정과 무관한 수동 QA는 이전 기록을 새 실행으로 간주하지 않는다.

### 일본 인물 한글 이름 (docs/38)

- 배포 순서: ① `supabase/migrations/0023_favorite_people_korean_name.sql` 적용 → ② `search-person-content`, `get-person-detail`, `resolve-person-names` 배포 → ③ `npm run edge:drift` 확인.
- ① 전에도 좋아하는 인물 등록은 동작한다(PGRST204 재시도). ② 전에는 새 필드가 오지 않아 표시가 지금과 같다.
- 배포 후 수동 확인: docs/38 10장 M-1~M-7.

### 헤더·본문 정렬 (2026-10-03, 미커밋 작업)

- 루트·인증 Stack에 공통 `ScreenHeader`를 적용하고 화면별 한국어 제목과 본문 최대 폭을 맞췄다. 탭의 기본 헤더는 숨기고 검색·라이브러리에 본문 제목을 추가했다. 검색·라이브러리·핀 및 상세/보조 화면은 1200 가운데 프레임과 `getHomeLayout` gutter를 사용하며, 핀 상세·폼·인증은 720, 온보딩은 560으로 제한한다. `KeyboardScreen`, 핀 저장 footer, `ScreenStateFrame`도 해당 본문 폭을 공유한다. 구조 설명은 [04](04_architecture.md)·[08](08_frontend_architecture.md#공통-헤더본문-프레임-2026-10-03)에 있다.
- 실행 검사: `npm test` **840개 중 839개 통과**. `supabase/functions/_shared/recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1건은 작업 전부터 존재한 실패다. 마지막 UI 변경 뒤 `npm run typecheck`, `npm run lint`, `npm run build`(웹 정적 export·`dist` 생성) 최종 실행은 모두 종료 코드 0이며 `git diff --check`도 통과했다. UI 프레임 변경은 순수 함수 테스트만으로 화면 동작을 보장하지 않는다.

| 플랫폼·범위 | 확인한 결과 | 남은 확인·이유 |
|---|---|---|
| Chrome 웹 8081, 폭 375·1440 | 여섯 탭(홈·검색·라이브러리·핀·인물·프로필), 인물 상세, 핀 상세/편집의 헤더·본문 표시 확인 | 해당 화면의 다른 폭은 이번에 확인하지 않았다. |
| Chrome 웹 8081, 목록 보기 | 검색·라이브러리의 리스트/갤러리 보기 1440, 라이브러리 갤러리 375 확인 | 검색 갤러리 375 등 나머지 조합은 별도 확인 필요. |
| Chrome 웹 8081, 작품 상세 | 폭 375·768·1440의 헤더·본문 정렬 확인 | 실제 저장·삭제 흐름의 재검증을 뜻하지 않는다. |
| Chrome 웹 8081, 에피소드 목록 | 폭 375·768 표시 확인 | 다른 폭은 이번에 확인하지 않았다. |
| Chrome 웹 8081, 핀 추가 375 | 작품·회차 맥락과 저장 footer의 정렬, 미변경 취소 후 복귀 확인 | 실제 핀 저장은 실행하지 않았다. |
| Chrome 웹 8081, 작품 핀 목록 375·1440 | 네비게이션 제목 "작품 핀"·본문 작품명·빈 상태 정렬 확인 | 핀이 있는 목록과 에피소드별 핀 진입 전체를 재검증한 것은 아니다. |
| 가져오기·사진 가져오기·이전 추천 제외 목록 | 코드 프레임·웹 빌드만 확인 | `EXTENDED_FEATURES_ENABLED=false`이므로 실제 화면 진입·조작은 확인하지 않았다. |
| 유효 공유 링크·로그아웃 상태의 인증 화면 | 실제 UI 미확인 | 사용자 기록·로그인 세션을 변경하지 않는 범위에서 QA했다. 별도 환경에서 확인 필요. |
| iOS·Android | 실행하지 않음 | `xcrun simctl`을 사용할 수 없어 네이티브 안전 영역·키보드·글자 크기 1.3배를 확인하지 못했다. 시뮬레이터 또는 실기기에서 별도 검증 필요. |

이번 웹 QA에서는 사용자 기록의 저장·삭제와 로그인 세션 변경을 실행하지 않았다. 코드·빌드 확인을 실제 화면 조작이나 네이티브 검증 완료로 간주하지 않는다.

### 먼저 처리할 미완료·충돌

| 중요도 | 상태 | 항목과 근거 | 다음 작업 |
|--------|------|-------------|-----------|
| P0 | 명세 미충족·코드 확인 | [31 U-1](31_usability_review_fixes_spec.md): `app/(tabs)/pins.tsx`의 모바일 카드/타임라인 선택이 `setSelectedPinId`만 수행 | 명세 D-2의 데스크톱 선택 동작을 유지하며 모바일 열기 수정·검증 |
| P0 | 코드 구현 확인·실제 삭제 검증 남음 | [31 U-2](31_usability_review_fixes_spec.md)·[39](39_content_detail_saas_redesign_spec.md): `app/content/[id].tsx`가 `confirmDestructive`로 확인 후 `removeFromLibrary` 호출 | 실제 삭제 성공·관련 기록 제거 범위·실패 피드백·이동을 별도 테스트 기록으로 재검증 |
| P0 | 명세 미충족·코드 확인 | [31 U-3](31_usability_review_fixes_spec.md): `src/services/pins.ts`의 `getPinsByContent`는 초→작성 시각 정렬이며 `PIN_SELECT`에 시즌 정보 없음 | D-3·D-4의 시즌→회차→초 정렬과 표기 적용. U-4~U-11도 구현·테스트 표 전체를 별도 대조 |
| 높음 | 보안 원칙과 구현 관계 판단 필요 | `supabase/functions/add-to-library/index.ts`가 `requireUser` 후 관리자 클라이언트로 사용자 기록 저장. [04](04_architecture.md)의 RLS 경유 원칙과 차이 | 인증 검증·소유권 지정·RLS 우회 범위를 검토하고 계약을 결정. 취약점이 입증됐다는 뜻은 아님 |
| 높음 | 환경 구성 개선 필요 | `.env.example`, `backend:serve`, `scripts/backfill-content-air-date.ts`, `scripts/smoke-edge-functions.ts`가 앱/서버 변수 및 관리자 키 사용을 섞음 | AGENTS의 서버 secret 경계 유지. 별도 작업에서 서버/관리용 환경 분리; 앱용 env에 관리자 키를 추가하는 우회 금지 |
| 중간 | 요구사항 관계 판단 필요 | [7월 제품 컨셉](../migrations/7월/00_7월_개선_로드맵_개요.md)은 공유/소통 중심, 초기 문서는 핀 중심. [11](11_screen_implementation_spec.md)의 확장 범위 제외와 현재 리뷰·공개 공유 경로도 대조 필요 | 기존 기능을 삭제·축소하지 말고 다음 기능의 범위를 결정할 때 사용자 요구와 연결 |
| 중간 | 설계 대조 필요 | `app/search.tsx`의 `mergeSearchResults`/`isSameWorkResult`가 서로 다른 출처의 결과 병합; `watchProvidersAtom`은 서버 응답 캐시 | 출처 선택 계약 및 TanStack Query 원칙과 차이를 [04](04_architecture.md)·[08](08_frontend_architecture.md)에서 검토. 이번에 이관하지 않음 |
| 중간 | 실행 구성 불일치 | `.run/Backend Functions Deploy.run.xml`은 4개, `package.json`의 `backend:deploy`는 14개 함수 배포 | 별도 설정 변경 시 IDE 실행 구성 동기화. 문서 점검을 이유로 배포하지 않음 |
| 출시 전 | 환경 미검증 | 인증 메일·딥링크, 두 사용자 RLS, 원격 DB/Edge·외부 API, 웹/iOS/Android E2E | 대상·테스트 계정·플랫폼을 정한 통합 QA 필요. 과거 성공 로그로 대체하지 않음 |

### AI 로컬 검증 스킬·커밋 훅 (2026-11-16)

- 범위: `.agents/skills/scenenote-verify/`, Claude 참조 진입점, `.githooks/`와 README/문서 목차. 후속 독립 검토에서 AGENTS/CLAUDE에 검증 스킬 경로도 연결했다. 기존 앱·서버·SQL 미커밋 변경은 보존했다. 기능별 선택 테스트는 작업 중 반복용이며 완료 시 AGENTS/명세가 요구하는 전체 검사를 줄이지 않는다.
- 실행 도구: `--tests`로 정확한 파일 선택, `--only`로 검사 선택, `--plan`으로 실행 전 확인. `--node-bin DIR`은 선택한 Node/npm을 해당 실행과 자식 프로세스에만 적용한다. 기본 Node가 실패하는 이 Mac에서는 `/opt/homebrew/opt/node@24/bin`을 선택한다. 자동 런타임 재시도·전역 PATH 변경은 하지 않는다. 인수 없이 전체 검사를 시작하지 않으며 결과는 검사별 한 줄, 로그·요약은 권한 700 폴더/600 파일로 임시 저장한다. 요약에는 실제 명령·런타임 경로도 남긴다.
- 격리 검증: 초기 CLI 13개·훅/설치기 18개를 후속 독립 검토에서 26개·24개로 확대했고, 런타임 선택 보완 후 최신은 **31개·24개 통과**다. 기존 신호/시간 제한·로그 실패·부분 staging 검사에 더해 정상 런타임을 명시해 고장 난 기본 Node를 피하는 실행, 공백 포함 경로·미리보기·npm 필요 여부·잘못된 실행 파일 차단·부모 PATH 보존을 확인했다. 회귀 입력은 수정 전 실패를 재현했다. 새 에이전트는 스킬 이름을 직접 지정하지 않은 요청에서도 AGENTS 경로를 따라 선택 검사 `--plan`을 실행했다. 이는 지침에 따른 선택 검증이며 앱의 자동 발견 검증과 구분한다.
- 실제 확인: `python3 .githooks/install.py --check`는 기존 설치를 **active**로 확인했다. `verify.py --node-bin /opt/homebrew/opt/node@24/bin --tests src/utils/pinCache.test.ts` 한 실행에서 순수 테스트 1개·앱 typecheck·lint가 모두 통과했다. Node 24.22.2의 정확한 실행 경로와 결과는 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-tdw9etcf/summary.json`에 남겼다. 기본 Node의 simdjson 누락은 남아 있으며 전역 환경은 변경하지 않았다.
- 실패 보고: 취소는 130/143과 `CANCELLED`, 로그/실행 환경 실패는 2를 반환한다. 검사 전 실패는 `NOT RUN`, 일부 실행 후 실패는 `INCOMPLETE`로 구분하며 이미 출력한 PASS/FAIL을 보존한다. 중도 실패·취소에는 `summary.json`이 없을 수 있다.
- 한계: 훅은 파일명/경로 기준으로 내용의 비밀값을 전수검사하지 않으며 예제 환경 파일은 허용한다. 공백 검사는 Git whitespace·attributes 설정을 따른다. 공통 Git 훅이 적용되는 linked worktree에 guard 파일이 없으면 커밋이 실패한다. 현재 프로젝트의 실제 커밋·push·배포는 수행하지 않았다. 공식 Python 스킬 검증기는 PyYAML 부재로 실행되지 않아 기존 Node `yaml`로 두 진입점 메타데이터를 대체 검사했다. Python 구문·추가 링크/앵커·diff도 확인했다. 앱 기능을 수정하지 않아 전체 앱 테스트·빌드·웹/iOS/Android QA는 실행하지 않았다. POSIX 이외 자손 프로세스 정리·SIGKILL·실제 시간/토큰 절감률은 검증 범위 밖이다. Codex 앱의 스킬 자동 발견은 미확인이다. 앞선 읽기 전용 app-server 확인은 기본 SQLite 위치 쓰기 제한으로 시작에 실패했고, 임시 SQLite/log 경로를 사용한 재시도도 초기화 응답이 20초 내 오지 않았다(모델 호출·지속 설정 변경 없음). 증거: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-skill-discovery-ovwixkj6/report.json`.

### 변경 종류별 검증

아래 명령의 실행 위치는 저장소 루트다. 의존성 설치와 환경 선행조건은 [README](../README.md)를 따른다. 필요한 명세의 테스트 표는 모든 행을 자동 테스트 또는 수동 검증에 대응시키고 미실행 행과 이유를 기록한다.

| 변경 | 실행·점검 방법 | 확인 범위와 한계 |
|------|---------------|------------------|
| Markdown만 변경 | 저장 후 재독, 상대 링크/앵커·실재 경로·`package.json` 명령 대조, `git diff --check`, 최종 diff/상태 | 문서 정합성. 전체 앱 테스트·빌드를 근거 없이 반복하지 않음 |
| 순수 로직·캐시·서비스 계약 | 회귀 입력을 기존 `.test.ts`에 연결하고 `npm test`, `npm run typecheck`, `npm run lint` | 테스트는 `node:test`+`node:assert/strict`. React Native/Expo/Supabase 런타임 import 없이 순수 함수 검사 |
| 화면·라우팅·입력 | 위 검사 + 해당 명세의 실제 화면 수동 QA; 웹 export 영향이 있으면 `npm run build` | 웹·iOS·Android 결과를 따로 기록. 테스트 글롭은 `app/`와 `.tsx`를 실행하지 않음 |
| Edge Function·외부 응답 | `_shared`·adapter 순수 함수 테스트, 요청/응답 계약과 오류/partial/auth 분기 검토 | `tsconfig.json`과 `eslint.config.js`는 `supabase/functions` 제외. `npm test`의 일부 서버 테스트도 Deno 핸들러·원격 API 동작을 보증하지 않음 |
| DB·RLS | migration·타입·서비스 사용처 대조 후 별도로 준비한 테스트 DB에서 인증 전/소유자/다른 사용자 권한 QA | 새 schema는 새 migration으로. 실제 DB 검증 환경·명령·결과를 남겨야 완료 |

정상 흐름 외에 세션 없음·만료, 빈 데이터/네트워크 실패, 같은 작품의 여러 시즌, 영화의 `episode_id = NULL`, 시간만/메모만/둘 다 빈 핀, 동일 시간 복수 핀, 스포일러, 저장·삭제 뒤 캐시와 이동을 해당 변경 범위에 맞게 확인한다. 수동 세부 항목은 [11](11_screen_implementation_spec.md), 기능별 후속 명세, 아래 기존 QA 체크리스트를 참고한다.

### 일반 검사와 구분할 명령

명령이 존재한다는 사실은 실행 허가나 성공 증거가 아니다. 아래 작업은 대상 환경과 목적이 요청 범위에 있을 때만 수행한다. 문서 점검 중에는 실행하지 않는다.

| 명령/경로 | 선행조건·부작용 |
|-----------|----------------|
| `npm run smoke:edge -- "Inception" movie` | 전용 테스트 계정 로그인 및 실제 검색·인기 추천 호출. 캐시를 갱신할 수 있음. 관리자 키와 로컬 URL 또는 `SCENENOTE_DELETE_ACCOUNT_SMOKE=1` 조건이 맞으면 임시 사용자/데이터 **생성·삭제**까지 수행 (`shouldRunDeleteAccountSmoke`) |
| `npm run backend:serve` | Supabase CLI/로컬 서비스 준비 필요. `.env`를 읽고 서버 프로세스 시작 |
| `npm run backend:deploy` | 대상 프로젝트 확인 및 인증 필요. 원격 함수 14개 변경; 로컬 실행 검사가 아님 |
| `npm run import:netflix` | 입력 파일·테스트 계정·대상 확인 필요. 옵션과 관계없이 외부 호출 여부부터 코드에서 확인; 실제 등록은 사용자 데이터 변경 |
| `scripts/backfill-content-air-date.ts` | 관리자 권한으로 메타데이터/회차를 갱신하는 관리 스크립트. 일반 실행 예제로 사용하지 않음 |
| `supabase db push`, `supabase secrets set`, `supabase db pull` | 원격 schema/secret 또는 로컬 migration 변경. 과거 연결 기록을 믿고 실행하지 말고 대상·이력·출력 파일부터 확인 |
| `npm run restart`, `npm run web:restart`, `npm run dev:restart` | 광범위한 `pkill -f` 포함. 다른 세션의 서버를 끊을 수 있음. 먼저 8081 프로세스와 공유 여부 확인 |

### 인수인계 기록 방법

작업이 끝나면 이 문서의 관련 현재 상태만 갱신한다. 원문 QA 기록을 현재 결과로 덮어쓰거나 여러 파일에 동일 로그를 복사하지 않는다.

- **기준:** 날짜, 리비전/미커밋 변경 여부, 변경 파일과 기능 범위.
- **완료:** 코드 확인인지, 검사 실행인지, 사용자 동작 확인인지 구분해 근거를 남김.
- **검증:** 실행 명령, 결과, 적용 플랫폼/계정 역할; 미실행 이유와 남은 테스트 ID. 비밀값·메일·사용자 데이터는 제외.
- **다음 작업:** 미해결 증상·재현 조건·관련 명세/심볼, 원격 적용 필요 여부. 담당자·승인·날짜를 추측해 쓰지 않음.

새 Codex 세션에서는 저장소 루트에서 시작해 “현재 작업 경로와 실제 적용한 지침 파일을 나열하고, AGENTS의 해당 작업 명세와 이 문서의 미완료 항목을 확인해라”라고 요청한다. 같은 위치의 override가 있는지 확인하고, 일반 문서가 모두 자동으로 읽혔다고 가정하지 않는다.

## 2026-05-02 후속 작업 기록 (참고 전용)

> 이 아래는 당시 연결·배포·검증 및 후속 계획을 보존한 기록이다. “완료”, “현재”, “미구현”, 취약점 개수, 서버 기동 상태는 **2026-05-02 당시 표현**이며 지금의 상태가 아니다. 명령을 일괄 재실행하지 않는다. 실행 선행조건은 현재 README와 위 검증 기준을 따른다. 아래 앱/서버 env 혼용 예시는 현재 설정 안내로 사용하지 않는다.

## 다음 개발자가 바로 이어서 할 일

1. 원격 DB에는 `0001_initial_schema.sql` 적용 완료. 이후 schema 변경은 새 migration 파일로 추가한다.
2. `search-content`, `add-to-library`, `get-content-detail`, `fetch-episodes` 배포 완료. 인증된 사용자로 호출 테스트한다.
3. Supabase generated type은 `src/types/database.ts`에 반영했고 `src/lib/supabase.ts`에 제네릭도 연결했다. schema 변경 후에는 다시 생성한다.
4. 검색 → 라이브러리 추가 → 에피소드 로드 → 핀 생성 E2E를 실제 Supabase 프로젝트에서 검증한다.
5. 앱 아이콘/splash, 비밀번호 재설정, 라이브러리 제거 플로우를 후속 구현한다.

## Supabase 프로젝트 연결 순서

1. Supabase Dashboard에서 새 프로젝트 생성.
2. Project Settings > API에서 Project URL과 anon public key 확인.
3. 로컬에 `.env` 또는 `.env.local` 생성:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. service role key는 Expo 앱에 넣지 말고 Edge Function secret으로만 설정.

현재 `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`만 있다면 Expo 앱용으로 아래 두 줄도 같은 public 값으로 추가해야 한다:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 환경변수 설정 방법

Expo 앱:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Supabase Edge Function secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set TMDB_API_KEY=your-tmdb-api-key
supabase secrets set ANILIST_API_URL=https://graphql.anilist.co
supabase secrets set KITSU_API_URL=https://kitsu.io/api/edge
supabase secrets set TVMAZE_API_URL=https://api.tvmaze.com
```

인증된 Edge Function smoke test용 선택값:

```bash
SCENENOTE_TEST_EMAIL=qa@example.com
SCENENOTE_TEST_PASSWORD=qa-password
```

## Migration 적용 방법

```bash
supabase link --project-ref your-project-ref
supabase db push --dry-run
supabase db push
```

또는 Supabase SQL Editor에서 `supabase/migrations/0001_initial_schema.sql` 내용을 실행한다.

주의: 이전 Supabase 프로젝트에는 로컬에 없는 migration 이력이 있었다. 현재는 새 SceneNote 프로젝트에 연결되어 `0001` 적용이 완료됐다. 나중에 다른 프로젝트로 바꿀 때 `db push --dry-run`이 원격 migration 누락을 보고하면 바로 push하지 말고 먼저 reconcile한다:

```bash
supabase migration list
supabase db pull
```

## Edge Function 배포 방법

```bash
supabase functions deploy search-content
supabase functions deploy add-to-library
supabase functions deploy get-content-detail
supabase functions deploy fetch-episodes
```

배포는 완료됐고 `TMDB_API_KEY`도 Supabase Edge Function secret으로 설정 완료했다. 키를 교체해야 할 때는 아래 명령을 다시 실행한다:

```bash
supabase secrets set TMDB_API_KEY=your-tmdb-key
```

## 앱 실행 방법

```bash
npm install
npm run start
npm run web
```

현재 Expo web dev server는 `http://localhost:8081`에서 기동 확인됐다. 브라우저 확인이 목적이면 `npm run web -- --port 8081 --localhost`를 사용한다.

Cursor에서는 Command Palette > `Tasks: Run Task`에서 아래 작업을 실행할 수 있다:

- `Frontend: Expo Web`
- `Frontend: Expo Native`
- `Backend: Supabase Functions Serve`
- `Backend: Supabase Functions Deploy`
- `Quality: Typecheck Lint Test`

JetBrains 계열 IDE에서는 루트의 `.run/` 아래 실행 구성을 사용할 수 있다.

검증 명령어:

```bash
npm run typecheck
npm run lint
npm test
npx expo config --type public
npm run smoke:edge -- "Inception" movie
```

`smoke:edge`는 `.env` 또는 `.env.local`의 Supabase public 값과 `SCENENOTE_TEST_EMAIL`/`SCENENOTE_TEST_PASSWORD`로 로그인한 뒤 `search-content`를 호출한다. 실제 사용자 비밀번호 대신 전용 테스트 계정을 사용한다.

## QA 체크리스트

- 이메일 회원가입/로그인 후 세션 유지 확인.
- 인증 전 탭 화면 접근 차단 확인.
- `search-content`가 TMDB/AniList 결과를 반환하고 partial 실패를 표시하는지 확인.
- 라이브러리 추가 Edge Function 중복 추가 방지 확인.
- 시즌/에피소드 lazy load 후 진행률 체크/해제 확인.
- 핀 생성 시 `timestamp_seconds >= 0` 검증 확인.
- 타임스탬프와 메모가 모두 비어 있으면 저장 차단 확인.
- 동일 에피소드/동일 시간대 복수 핀 허용 확인.
- 스포일러 핀이 기본 가림 처리되고 보기 버튼으로 해제되는지 확인.
- 다른 사용자 데이터 접근이 RLS로 차단되는지 실제 계정 2개로 검증.
- 영화 핀은 `episode_id = NULL`로 저장되는지 확인.
- npm audit에 남은 moderate 취약점은 Expo SDK 호환성을 깨지 않는 업데이트 경로가 나올 때 재검토한다.
- 한글 메타데이터 QA: TMDB 검색 결과가 한국어 제목/개요로 표시되는지 확인한다. AniList/Kitsu는 TMDB 한국어 fallback을 시도하지만, TVmaze는 한국어 지원이 제한적이므로 영어가 섞일 수 있다.
- 기존에 영어로 저장된 콘텐츠가 있으면 관리용 메타데이터 refresh 기능을 추가하거나 해당 콘텐츠를 재동기화한다.


### 2026-10-04 추천 연도 필터 정정 (41 D-9)

- 원인: 검색 요약에 연도는 표시됐지만 추천 요청/발견 필터에는 전달되지 않아 월별 최신 레인과 기간 무제한 취향 레인이 다른 연도 작품을 반환했다.
- 수정: 공유 필터의 연도 판정·캐시 identity, 검색 화면/추천 훅의 연도 전달·표시/보충 검사·카드 유지 문맥, 서버 요청 검증, 선택 연도 월별 범위, 취향 제공처 공개일 범위·캐시 분리, 필터 시트 안내. 제목 검색의 연도 숨김 사유는 보존했다.
- Y-1~Y-5가 수정 전 실제 실패했고 수정 후 통과했다. Y-6은 모의 제공처 요청·영속 캐시 분리를 추가 검증한다. 관련 115개 테스트 전부 통과. 전체 기준선 951개 중 950개 통과; 수정 후 957개 중 956개 통과. 기존 `recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1개 실패는 기준선과 같다.
- `npm run typecheck`, `npm run lint`, `git diff --check` 통과. Edge handler는 esbuild로 구문/번들 검사했다(Deno 실행·원격 인증/RLS 확인을 대신하지 않음).
- 41의 YM-1 웹과 YM-2 iOS/Android 실제 로그인 동작은 미실행(이번 실행에서 인증된 앱/실기기 접근 없음). 운영 배포/DB 변경 없음. 사람이 `personalized-recommendations` 재배포 후 해당 수동 행을 검증해야 한다. 앱은 구 배포본 응답도 연도로 숨기지만 선택 연도의 후보를 충분히 수집하려면 서버 배포가 필요하다.


### 2026-10-05 추천 묶음 화면 개수 재정정 (47 §14)

- 로그인한 실제 검색 화면: 화면 51개/훅 48개. 추가됨 보존 슬롯 3개를 보충 개수에서 빼고 있어 격자의 마지막 줄이 어긋났다. 화면 슬롯의 고유 개수를 보충·스크롤에 공통 적용했다. 보존 슬롯 위치·등록/제외 정책은 유지한다.
- 커서가 진전한 빈 응답을 즉시 오류로 처리하던 분기를 제거해 기존 무진전 3회·6회·45초 한도로 이어 찾는다. 요청 시작 목표를 캡처해 첫 요청 로그의 이전 목표 문제도 수정했다.
- 기존 테스트 989/990 → 993/994(기존 recommendationEngine 실패 1개 동일). 신규 표시 슬롯 테스트 3개는 구현 전 실패/후 통과, 기존 한도 보존 테스트 1개 추가. 관련 30개 통과. typecheck·lint·diff 검사 통과.
- 기존 8081 프로세스가 없어 캐시를 비운 같은 포트 서버를 시작한 뒤 실제 브라우저 재로드. 웹 1440에서 새 코드의 로그: 12→24(target24), 빈 응답24→24(target36) 이후 자동24→36(target36). 빈 응답 직후 수동 재시도 없이 보충됨을 확인했다.
- 사용자 라이브러리 기록을 임의로 추가/삭제하지 않았다. 실제 등록 후 슬롯 유지 흐름과 네이티브 QA는 남아 있으며 순수 회귀 테스트로만 검사했다. 서버·DB·배포·커밋 없음.

### 2026-10-05 추가·완료 후 다음 추천 12개 (47 §15)

- 성공 후 예약 보충의 `computeRefillLimit(표시 수, 12)` 경로를 공통 `loadNextBatch`로 연결했다. 최신 캐시 표시 수 + 12를 목표로 하고, 짧은 응답은 같은 목표까지 이어 찾는다. 연속 성공은 기존 800ms trailing 예약 한 번으로 모으며 진행 중 조회가 끝날 때까지 예약을 유지한다.
- 예약 당시 scope 검사, 새 묶음 시작 전 요청 잠금 검사, 첫 요청부터 6회·45초 탐색 예산 적용, 이전 조회 오류/무진전 카운터 초기화를 추가했다. 스크롤도 추가 진행·예약 대기를 로딩 상태로 보아 중복 묶음 시작을 막는다. 변경: `usePersonalizedRecommendations.ts`, 검색 화면의 스크롤 판정, AddFlow 회귀 테스트, 47 §15와 08의 추천 흐름.
- 관련 순수 조합 테스트 **62/62** 통과(신규 AB-1~AB-6 포함). 전체 기준선 **993/994** → 수정 후 **999/1000**; 기존 `recommendationEngine.test.ts`의 `uses latest-popular fallback ordering with an empty library` 1개 실패만 동일. typecheck·lint·diff 공백 검사 통과. 로그: `/tmp/scenenote-action-batch-{before,after,typecheck,lint}.log`.
- 웹 Chrome에서 실제 추천 훅·React/TanStack Query에 모의 인증/추천 응답을 연결한 격리 화면을 실행했다. 단일 완료 표시12→24, 첫 응답5개 후 부족분7개 요청으로24 도달, 연속 완료3건 표시36→48(추가 요청1회), 조회 중 완료 표시48→60 후 예약된 묶음으로72 도달을 확인했다. 실패는 표시72·목표72로 복원되고 추가 요청이 없었다. 예약 대기 중 필터 변경은 이전 예약을 취소하고 새 초기12개 요청만 실행했다. 진전한 빈 응답3회는 목표24에서 중단, 다음 완료 성공으로24까지 복구했다.
- 격리 검증 소스/HTML/증빙은 `/tmp/scenenote-action-batch-qa/`에 보관하고 임시 `public` 페이지는 정리했다. 최종 증빙 `result.png`는 표시24·목표24 및 요청12→7(응답5+7)을 보여준다. 실제 라이브러리 서버 저장을 모의 성공으로 대체한 검증이며 사용자 기록을 변경하지 않았다. 실제 계정의 완료 저장과 함께 재현하는 QA, iOS/Android 실기기 터치·네트워크 검증은 미실행(실기기 없음; 사용자 감상 기록에 테스트 작품을 임의 등록하지 않음). 관심 없음/테마 줄이기 legacy 보충은 이 추가·완료 후속 수정의 범위 밖이다. 서버·DB·배포·커밋 없음.
