# SceneNote Development Next Steps

## 쓰지 않는 상태 파일 삭제 (docs/83, 2026-11-19)

상태: **구현·코드 검사 통과, 화면 미확인.** [83](83_unused_state_files_cleanup_spec.md) 전체와 14장 STEP 1→2→3→4를 따랐다. D-1~D-4 변경 없음. 시작 경로 `/Users/youngilkim/SceneNote`의 git 상태·원문은 `/tmp/scenenote-83-start-{status.txt,snapshot.json}`에 기록했고, 실제 테스트 기준선은 **N=1,866**이다. `scenenote-verify`와 명령에만 적용한 Node 24를 사용했다. 기존 docs/74~82 작업을 보존했다. 브라우저·시청 앱·개발 서버·사용자 저장값·DB/Edge/secret·의존성·커밋/푸시는 조작하지 않았다.

### 1. STEP 1 실제 실패 출력(요약)

새 `scripts/unusedStateFilesCleanup.test.ts`만 먼저 작성한 뒤 전체 테스트를 실행했다. **1,870개 중 1,867개 통과·3개 실패**였고 실패는 정확히 T-1/T-2/T-4, 보호 테스트 T-3은 통과했다. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-9vxh5zej/test.log`, 전체 실제 출력 `/tmp/scenenote-83-step1-proof.json`.

```text
✖ 83 T-1: unused state files are removed (2.531209ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
✖ 83 T-2: no source references the removed state files (27.910625ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
✖ 83 T-4: current guidance docs no longer name the removed files (2.828417ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
```

- T-1: 삭제 대상 4파일의 existsSync가 실제 true·기대 false였다.
- T-2: 네 정의 파일 자체에서 경로·내보내기 문자열이 검출돼 실제 참조 목록이 비어 있지 않았다.
- T-4: 현재 안내 docs/08·docs/04·AGENTS에 이전 파일명이 남아 실제 참조 목록이 비어 있지 않았다.

STEP 2에서 네 파일을 지운 뒤 **1,869개 통과·T-4만 실패**했고 typecheck도 통과했다. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-3r10oma5/test.log`, `/tmp/scenenote-83-step2-proof.json`. STEP 3에서 문서 문장만 정리한 뒤 네 테스트가 모두 통과했다. 단언·검사 범위는 완화하지 않았다.

### 2. npm test before N / STEP 1 / STEP 2 / after

| 단계 | 전체 | 통과 | 실패 |
|------|------|------|------|
| 실제 시작 기준선 N | 1,866 | 1,866 | 0 |
| STEP 1 테스트 추가 | 1,870 | 1,867 | 3(T-1·T-2·T-4) |
| STEP 2 4파일 삭제 | 1,870 | 1,869 | 1(T-4) |
| STEP 3 문서 정리 후 최종 | 1,870 | 1,870 | 0 |

기준선 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-4z6_dl27/test.log`; 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ic46csv2/test.log`. 새 테스트 4개, 기존 테스트 파일/단언 변경 0, 삭제된 테스트 0, 최종 skip 0이다. 다른 작업으로 작성 시점의 수와 달라질 수 있어 실제 N을 먼저 기록했고 이번 N은 명세 작성 시점과 같은 1,866이었다.

### 3. typecheck / lint 결과와 보호 범위

- 최종 `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ic46csv2/{typecheck.log,lint.log,summary.json}`.
- STEP 2 typecheck도 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-3r10oma5/typecheck.log`에서 통과했다.
- 남길 상태 10파일·package.json/package-lock.json·과거 프롬프트/명세 4문서의 **보호 16파일 SHA-256이 시작 때와 동일**하다. `/tmp/scenenote-83-protected-hashes.json`.
- 삭제는 명세 6.1의 네 파일뿐이다. app/src/scripts에서 신규 guard 자신을 제외한 7문자열 참조가 0개이며, 최초 점검에서는 supabase에서도 사용처가 없었다. 사용 중인 폼·스포일러 atom과 다른 store는 그대로다.
- 독립 읽기 전용 검토에서 문서 3곳 전체가 지정 변경만 적용한 기대 원문과 일치하고 AGENTS의 83번 작업 표 행도 동일함을 확인했다. `git diff --check` 통과. 화면·상태 동작 코드·패키지·서버 코드는 바꾸지 않았다.

### 4. 추가 테스트 ID와 이름

모두 `scripts/unusedStateFilesCleanup.test.ts`에 있다. 순수 Node 모듈만 import하고 RN/Expo/Supabase를 가져오지 않는다.

| ID | 이름 |
|----|------|
| T-1 | 83 T-1: unused state files are removed |
| T-2 | 83 T-2: no source references the removed state files |
| T-3 | 83 T-3: state files in use are kept |
| T-4 | 83 T-4: current guidance docs no longer name the removed files |

T-2는 app/src/scripts의 TS/TSX 전체에서 자기 파일만 제외해 명세의 7문자열을 검사한다. T-3은 atoms 2개+stores 8개의 존재를 보호하고, T-4는 현재 안내 3문서의 4파일명 부재를 검사한다.

### 5. 현재 안내 문서 3곳의 diff

**`docs/08_frontend_architecture.md`**

```diff
--- before/docs/08_frontend_architecture.md
+++ after/docs/08_frontend_architecture.md
@@ -98,8 +98,7 @@
 | 검색·라이브러리·추천 UI | `src/stores/searchUiStore.ts`, `searchHistoryStore.ts`, `libraryUiStore.ts`, `recommendationUiStore.ts` | 서버 응답을 새로운 UI store에 복제하지 않는다. 필터/정렬/검색 기록과 응답 캐시를 구분한다. |
 | 핀 작성 | `src/atoms/pinFormAtom.ts`: `pinFormDraftAtom`; `PinComposer`의 로컬 상태·`createPinSchema` | 현재 PinComposer는 Jotai draft + Zod 검증을 사용한다. 아래 RHF 예제는 이 컴포넌트의 실제 구현이 아니다. |
 | 스포일러 | `src/atoms/spoilerAtom.ts`: `revealedSpoilerPinIdsAtom`; 핀 상세는 `isSpoilerRevealed` 로컬 상태 | 전체 핀/작품 핀/홈과 상세의 초기화 범위가 다르므로 사용자 전환·화면 이탈 시 실제 초기화 코드를 확인한다. |
-| 시청처 캐시 | `src/hooks/useWatchProviders.ts` → TanStack Query; `get-watch-providers` → DB | docs/69의 수동 갱신 캐시다. `watchProvidersAtom.ts`는 이전 미사용 파일이며 서버 상태 저장에 사용하지 않는다. |
-| 정의만 남은 상태 | `src/stores/pinComposerStore.ts`, `episodeSelectionStore.ts`, `src/atoms/tagFilterAtom.ts` | 점검 시 `app/`·`src/` 사용처 검색에서 import를 찾지 못했다. 실제 작성 폼·회차 선택의 상태 원천으로 오인하지 말고, 제거/재사용은 별도 변경으로 검토한다. |
+| 시청처 캐시 | `src/hooks/useWatchProviders.ts` → TanStack Query; `get-watch-providers` → DB | docs/69의 수동 갱신 캐시다. 서버 상태를 Jotai·Zustand에 복제하지 않는다. |

 ### 캐시와 mutation의 현재 동작

```

**`docs/04_architecture.md`**

```diff
--- before/docs/04_architecture.md
+++ after/docs/04_architecture.md
@@ -25,7 +25,7 @@
 | 앱 진입·인증 | `app/_layout.tsx`: `RootLayout`, `AuthRedirect`, `AuthLinkHandler`; `src/providers/AppProviders.tsx`: `AppProviders` | 인증 링크 처리 `src/utils/authLinks.ts`, 세션 초기화, 비밀번호 재설정·공유 경로의 리다이렉트 예외 |
 | 화면·공통 UI | `app/`, `src/components/`; 실제 검색 본체는 `app/search.tsx`: `SearchScreen`; 공통 Stack 헤더는 `src/components/common/ScreenHeader.tsx` | `(tabs)` 화면, 상세/핀 라우트, 공통 디자인 값 `src/constants/theme.ts`, 본문 폭 `src/utils/homeLayout.ts`·`src/constants/layout.ts` |
 | 서버 상태·요청 | `src/hooks/` → `src/services/` → `src/lib/supabase.ts`; `src/lib/query.ts`: `queryClient`, `queryKeys` | 캐시 키와 mutation 후 갱신, 사용자 전환 시 캐시 정리, 서버 응답 타입 `src/types/` |
-| UI·폼 상태 | `src/stores/`의 Zustand와 `src/atoms/`의 Jotai를 함께 사용 | 실제 사용처는 08 현황 표 참조. `watchProvidersAtom`은 이전 미사용 파일이며 현재 보러가기는 TanStack Query와 DB 저장 경로다(docs/69). |
+| UI·폼 상태 | `src/stores/`의 Zustand와 `src/atoms/`의 Jotai를 함께 사용 | 실제 사용처는 08 현황 표 참조. 보러가기는 TanStack Query와 DB 저장 경로다(docs/69). |
 | 외부 콘텐츠 호출 | `supabase/functions/*/index.ts`; `_shared/externalContent.ts`; `search-content/adapters/` | `search-content/adapters/types.ts`, `_shared/types.ts`, 클라이언트 `src/types/content.ts` 및 응답 변환 서비스 |
 | DB·권한 | `supabase/migrations/`의 순서별 SQL, `src/types/database.ts` | 후속 migration까지 읽어 최종 제약 확인. 로컬 파일 존재만으로 원격 적용을 단정하지 않는다. |

```

**`AGENTS.md`**

```diff
--- before/AGENTS.md
+++ after/AGENTS.md
@@ -159,7 +159,7 @@

 - TypeScript 타입을 명확히 작성한다.
 - 서버 데이터는 TanStack Query, UI 상태는 Zustand로 관리한다.
-- 기존 Jotai 기반 폼·스포일러 상태는 관련 작업 없이 이관하지 않는다. `watchProvidersAtom`은 이전 구현의 미사용 파일이며, 보러가기 서버 응답은 docs/69의 TanStack Query·DB 저장 경로를 쓴다. Jotai로 새 서버 캐시를 만들지 않는다.
+- 기존 Jotai 기반 폼·스포일러 상태는 관련 작업 없이 이관하지 않는다. 보러가기 서버 응답은 docs/69의 TanStack Query·DB 저장 경로를 쓴다. Jotai로 새 서버 캐시를 만들지 않는다.
 - 기존 구조·명명·UI 동작을 우선하고 무관한 리팩터링이나 중복 유틸을 섞지 않는다. 오류를 숨기는 임시 우회로 완료 처리하지 않는다.
 - 불확실한 외부 API 동작은 TODO와 문서에 남긴다.
 - 큰 리팩터링보다 설계 문서에 맞는 작은 구현 단위를 선호한다.
```

AGENTS의 83 작업 표 행이나 다른 규칙은 고치지 않았다. docs/08의 지정 표 두 줄 외 과거 예제 본문도 그대로다.

삭제 파일은 다음 네 개다. 원문은 시작 snapshot에 보존했다.

- `src/stores/pinComposerStore.ts`
- `src/stores/episodeSelectionStore.ts`
- `src/atoms/watchProvidersAtom.ts`
- `src/atoms/tagFilterAtom.ts`

`docs/codex_prompt.md`, `docs/codex_implementation_prompt.md`, `docs/cursor_verification_prompt.md`, `docs/11_screen_implementation_spec.md`는 전혀 변경하지 않았다. docs/README 83번 상태는 **구현, 화면 미확인**으로 갱신했다.

### 6. 수동 확인 M-1·M-2

| ID | 플랫폼 | 결과·미실행 사유 |
|----|--------|------------------|
| M-1 | 웹 8081 | **미실행.** 브라우저·로그인 세션·개발 서버를 조작하지 않았다. 사용처 부재와 전체 테스트/타입 검사는 확인했지만 실제 홈·핀·상세/회차 선택·핀 작성의 열림 및 콘솔 오류는 미확인이다. 저장 버튼이나 사용자 기록은 건드리지 않았다. |
| M-2 | iOS 세로 | **미실행.** 기기·시뮬레이터를 실행하지 않았다. 같은 화면이 실제로 열리는지는 미확인이다. |

Android 실제 화면 확인도 미실행이다. `EXTENDED_FEATURES_ENABLED`를 포함한 기존 기능 플래그와 상태 저장값을 바꾸지 않았으며 사용자 시청 환경을 보존했다.

### 7. D-1~D-4 문제 여부

**변경 필요사항·충돌 없음.** D-1의 삭제 4파일 한정·남길 10상태/패키지 불변, D-2의 문서 지정 문장만 정리, D-3의 과거 프롬프트/명세 불변, D-4의 순수 fs 검사를 준수했다. 변경은 명세의 10파일뿐이다(삭제 4개·새 테스트 1개·문서 5개). Jotai↔Zustand 이관이나 전수 export 정리는 하지 않았다.

### 8. 사람이 할 후속 작업

웹 8081과 iOS에서 M-1/M-2의 홈·핀 목록·작품 상세(회차 선택)·핀 작성 화면을 열고 콘솔 오류를 확인한다. **저장 버튼은 누르지 않는다.** 서버가 이미 실행 중이면 재사용하고 예전 번들이 의심될 때만 8081에서 재시작한다. 이번에는 서버를 조작하지 않았다. DB migration·배포는 필요 없고 실행하지 않았으며 커밋·푸시도 하지 않았다.


## 검색·추천 한국 드라마 필터 혼입 정정 (docs/82, 2026-11-19)

- 검색의 한국 드라마 조건은 유형 `drama` + 국가 `KR`이며, 공용 `discoveryMediaType`이 예능을 TV 드라마로 보고 국가 OR가 한일 공동 제작을 양쪽에 허용하던 것이 원인이다. 일반 검색은 TMDB 원어를 버리고 추천 장르 매핑은 News·Reality·Talk를 버렸다. 공통 `discoveryFilters`에서 명시 비드라마 TV를 드라마 유형/장르 가지에서 제외하고, 드라마 문맥에서 한일 중 한쪽만 선택하면 원어(없으면 가나 원제)와 기존 국가 증거를 교집합한다. 국가를 새로 만들지 않는다. 영화·애니·국가만 조건·KR/JP 동시 선택·다른 장르 OR는 보존했다. 새 `dramaClassification`의 장르/원제 helper를 81에서도 재사용하며 81의 결과는 유지했다.
- T-1~T-3은 `discoveryFilters.test.ts`의 신규 6개 테스트, T-4는 `searchResultVisibility.test.ts`의 신규 3개, T-5는 TMDB 원어 전달/추천 장르 맵 각각 1개, T-6은 81의 라이브러리/통계 전체 사례로 대응했다. 총 신규 11개이며 기존 assertion을 줄이지 않았다. 초기 소유 테스트 37개 중 32 통과·5 실패(분류·지역·앱 방어): `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-uk3s15zr/test.log`. 전달/매핑 2개도 구현 전 실패: 같은 임시 상위 폴더의 `scenenote-verify-xfmrh446/test.log`. 첫 구현에서 기존 TMDB 복수 국가 OR 1개가 실패해 기존 assertion을 유지하고 KR/JP 동시선택 보호를 구현했다. 관련 115/115 통과(`scenenote-verify-c5orvzee/test.log`), 추가 동시선택 assertion까지 소유 37/37 통과(`scenenote-verify-e2t3kv9h/test.log`).
- `scenenote-verify` + 명령 한정 Node 24로 전체 **1866/1866**, typecheck·lint 모두 exit 0. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-f90rwffs/{test.log,typecheck.log,lint.log,summary.json}`. 순수 공유 모듈 3개(`dramaClassification`·`discoveryFilters`·`recommendationProviderFilters`)의 strict TypeScript 검사 통과. 설치된 esbuild로 `search-content/index.ts`·`personalized-recommendations/index.ts`의 로컬 의존성 bundle을 메모리에서 검사해 모두 통과(원격/npm import는 external). Deno가 없어 실제 Deno 검사·Edge 실행은 미실행이며 앱 타입 검사/번들 검사가 이를 대신한다고 보지 않는다. diff 공백 검사 통과.
- M-1 실제 로그인 웹 8081에서 유형 드라마+한국의 가스인간 3개 숨김/카드 없음, 일본 단독 조건의 가스인간 표시, 한국 조건의 나 혼자 산다 1개 숨김을 확인했다. 각각 모두 보기로 원래 카드를 확인한 뒤 필터를 재적용했다. 정상 한국 드라마 도깨비(2016, 공유·김고은)는 유지됐다. 유형 전체+장르 드라마+한국에서도 로맨틱 어나니머스(코미디·드라마)가 숨겨지는 것을 확인했다. 증빙 `/tmp/scenenote-search-kr-drama-fixed.jpg`, `/tmp/scenenote-search-variety-filter-fixed.jpg`. 기존 8081 서버를 재사용했다.
- M-2 빈 검색어 추천을 유형 드라마+장르 드라마+한국에서 열어 최종 표시 수 **12개**, 실제 카드 12개 일치와 유일무이 로맨스·너에게 다이브·날아올라라 나비·공감세포 등 표시를 확인했다. 예능·일본 드라마 카드 혼입은 관찰되지 않았다. 증빙 `/tmp/scenenote-search-drama-recommendations-fixed.jpg`. 구응답에서 제거된 후보를 보충 목표에 세지 않는 경로는 `recommendationVisibility`·추천 훅의 공통 필터 사용처 및 기존 전체 자동 테스트로 확인했으며, 운영 서버에 인위적인 혼입 후보를 주입하지는 않았다. 검증 뒤 필터는 원래의 모든 유형·모든 장르·일본+한국·내 목록 전체·전체 연도·최신순으로 복원했고 검색어를 비웠다. 검색 실행으로 최근 검색어는 갱신됐으며 라이브러리/좋아하는 인물 등록 버튼은 누르지 않았다.
- UI 스타일·접근성·Alert 변경은 0줄이다. M-3의 375/768/1440별 수동 조작 전체와 M-4 iOS/Android 실기기는 실행하지 않았다(로컬 웹 데스크톱에서 로직 확인, 네이티브 실행 환경 없음). 영화·애니·국가만·복수 장르/국가의 보호는 자동 테스트로 확인했다. 공개 메타데이터가 모호하거나 잘못된 모든 작품의 분류를 보장하지 않는다.
- 앱 공통 판정은 구응답에도 적용된다. 서버 후보 수집·원어/장르 전달 소스를 운영에 반영하려면 별도 `search-content`·`personalized-recommendations` 배포가 필요하다. 이번 작업에서 운영 배포·DB·마이그레이션·개인 기록·secret·의존성·커밋/푸시는 변경하지 않았다. 구 서버/영속 캐시에 비드라마 근거 자체가 없으면 앱이 복원할 수 없다는 한계가 있다.

## 라이브러리 한국 드라마 필터 혼입 정정 (docs/81, 2026-11-19)

- 사용자 신고와 실제 8081에서 `한국 드라마 + 완료` 303개에 가스인간이 포함됨을 재현했다. 공개 콘텐츠 메타데이터 SELECT에서 `가스인간/ガス人間`, `로맨틱 어나니머스/匿名の恋人たち`, `K-연하남 주의보/韓ドラみたいな彼と私`가 `kdrama`로 저장되고, 나 혼자 산다 등 예능도 Reality·Talk인데 `kdrama`임을 확인했다. 원인은 국가 KR 우선의 서버 분류와 저장 유형을 그대로 믿던 앱 분류다. 국가·원어 필드는 현재 라이브러리 데이터에 없고 기존 콘텐츠 빠른 등록 경로도 과거 유형을 유지한다.
- `src/utils/libraryFilters.ts`의 공용 `libraryContentCategory`만 보정했다. 영화·애니 보존 → 명시 비드라마 장르의 TV는 기타 → TMDB kdrama의 일본어 원제(실제 가나, 한글 없음)는 일본 드라마 → 기존 유형/해외 드라마 규칙 순서다. 이 분류를 쓰는 카드 라벨·프로필 통계도 함께 일치한다. 원제·출처 누락/모호함·한글 포함/한자만·수동 항목은 기존 지역 유형을 보존하고 번역 제목이나 출연자 이름으로 국적을 추측하지 않는다. 전체 목록·시청 기록은 유지한다. 국가 provenance를 추가하는 작업은 이 범위 밖이며 원제 기반 규칙은 한일 합작을 일본 드라마로 표시할 수 있다.
- 기존 테스트를 유지하고 `libraryFilters.test.ts`·`profileStats.test.ts`에 신규 6개 추가. 초기 회귀 5개 추가 시 관련 28개 중 25 통과·3 실패(일본 원제/비드라마/통계), 수정 후 결합 필터 회귀 포함 29/29 통과. 상태·검색 공백·장르 OR·평점·연도 조합도 확인했다. red 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ctq582vg/test.log`; green `scenenote-verify-qeb6fhok/test.log`(같은 임시 상위 경로).
- `scenenote-verify`와 명령 한정 Node 24로 전체 **1855/1855**, typecheck·lint 통과(exit 0). 최종 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-n42kg7cq/{test.log,typecheck.log,lint.log,summary.json}`. diff 공백 검사 통과. 공유 함수 사용처(라이브러리 필터·목록/갤러리 라벨·프로필 통계)를 검색하고 자동 회귀로 검사했다.
- 실제 로그인 웹: 가스인간 검색 후 한국 드라마에서 빈 결과, 일본 드라마에서 `일본 드라마` 카드/완료 상태 유지 확인. 나 혼자 산다도 한국에서 빈 결과, 기타에서 `기타`·리얼리티 카드 유지 확인. 검색어를 비우고 원래 한국 드라마+완료+갤러리로 복원했으며 결과 267개. 증빙 `/tmp/scenenote-library-jdrama-fixed.jpg`, `/tmp/scenenote-library-variety-fixed.jpg`. 기존 8081 listener가 없어 지정 명령으로 같은 포트 서버를 시작했다. 사용자 감상 기록·DB·Edge 배포·secret·의존성·커밋/푸시 변경 없음.
- 이번 변경은 순수 분류 로직이며 화면 스타일/접근성 속성은 수정하지 않았다. 수동 웹 확인은 데스크톱이며 iOS/Android 실기기·큰 글자·폭별 UI 재검증·실제 프로필 패널 수동 확인은 실행하지 않았다. 로맨틱 어나니머스·K-연하남 주의보는 저장 메타데이터와 자동 회귀로 확인했고 실제 해당 카드 수동 확인은 별도로 남는다. 문서81의 수동 표에 대응한다.

## 인기 추천 잔여 코드 삭제·제외 해제 버튼 이름 (docs/80, 2026-11-19)

상태: **구현·웹 화면 확인(2026-11-19, Claude), iOS 미확인.** [80](80_popular_recommendation_leftovers_and_exclusion_label_spec.md) 전체와 14장 STEP 1→2→3→4를 따랐다. D-1~D-5 변경 없음. 기존 미커밋 작업을 명세의 삭제 대상 외 보존했다. 시작 git 상태·원문은 `/tmp/scenenote-80-start-{status.txt,snapshot.json}`, 보호할 서버 파일은 `/tmp/scenenote-80-server-hashes.json`에 기록했다. `scenenote-verify`와 명령에만 적용한 Node 24로 검증했다. 브라우저·시청 앱·개발 서버·계정 저장값·DB/Edge/secret·의존성·커밋/푸시는 조작하지 않았다. smoke 스크립트는 실행하지 않았다.

### 웹 실제 화면 확인 (2026-11-19, Claude)

- 코드 검사: `npm test` 1,855개 통과(docs/80 목표 1,849개 + 같은 날 docs/81의 6개), `typecheck`·`lint` 통과. 지운 3개 파일 없음, `app`·`src`·`scripts`의 남은 참조는 80 가드 테스트 자신뿐, `supabase/functions/` diff 0줄, 새 타입 파일은 `import type`만 가진다.
- 이미 떠 있던 8081 서버(Codex가 시작)를 그대로 썼다. `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꿔 확인했고 확인 후 `false`로 되돌렸다. 검증용 항목 2개를 `localStorage`에 넣었다가 지웠다(원래 값은 비어 있었다).

| ID | 결과 |
|----|------|
| M-1 | ✓ 해제 버튼 `aria-label`이 "검증용 작품 B 제외 해제"·"검증용 작품 A 제외 해제"로 서로 다르다. "전체 해제"는 `aria-label` 없이 글자 그대로 |
| M-2 | ✓ A의 해제를 누르면 "1개", 저장 keys `["test:v80b"]`. 홈·검색·프로필이 정상으로 열리고 콘솔 오류 0건 |
| M-3 | 미실행(iOS) |

### 1. STEP 1 실제 실패 출력(요약)

새 테스트 8개만 먼저 썼다. **1,853개 중 1,847개 통과·6개 실패**이며 실패는 정확히 T-1~T-5·T-7이었다. 보호 테스트 T-6·T-8은 통과했다. 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-58ypfzgu/test.log`, 전체 실패 출력 `/tmp/scenenote-80-step1-proof.json`.

실제 실패 이름과 오류 첫 줄:

```text
✖ 80 T-1: unused client popular recommendation files are removed (3.874292ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
✖ 80 T-2: no source references the removed client popular code (46.213833ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
✖ 80 T-3: popular recommendation types live in a type-only module (0.231125ms)
  AssertionError [ERR_ASSERTION]: Popular recommendation type module must exist
✖ 80 T-4: the smoke script imports the response type from the types module (6.279959ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
✖ 80 T-5: the unused popular query key is removed (0.28725ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
✖ 80 T-7: each exclusion remove button names the title (9.617625ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
```

- T-1: 삭제 대상 3파일이 존재해 실제 true·기대 false.
- T-2: 기존 guard의 services 문자열, smoke 타입 import와 서비스 내부 실행 코드 참조가 남아 실제 목록이 비어 있지 않음.
- T-3: 새 타입 모듈이 아직 없으므로 존재 assertion 실패.
- T-4: smoke가 여전히 services 경로를 가져오므로 새 types import assertion 실패.
- T-5: query 파일에 기존 `"popular"`가 있으므로 실제 true·기대 false.
- T-7: 대상 버튼은 정확히 1개지만 지정 accessibilityLabel이 아직 없어 assertion 실패.

STEP 2에서는 타입/참조를 옮기고 3파일·쿼리 키를 지운 뒤 **1,848개 통과·T-7만 실패**, typecheck도 통과했다. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-7k9laqtg/test.log`, `/tmp/scenenote-80-step2-proof.json`. STEP 3에서 라벨 한 줄을 더한 뒤 8개가 모두 통과했다. 단언 완화는 없었다.

### 2. npm test before / STEP 1 / STEP 2 / after

| 단계 | 전체 | 통과 | 실패 |
|------|------|------|------|
| 실제 시작 기준선 | 1,845 | 1,845 | 0 |
| STEP 1 테스트 추가 | 1,853 | 1,847 | 6 |
| STEP 2 클라이언트 정리 | 1,849 | 1,848 | 1(T-7) |
| STEP 3 수정 후 최종 | 1,849 | 1,849 | 0 |

시작 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-6wxfkshf/test.log`; 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ycy7e6yf/test.log`. 최종 skip 0. 새 테스트는 8개이며 삭제한 기존 테스트는 `src/utils/popularRanking.test.ts`의 아래 4개뿐이다. 랭킹 구현은 서버 복사본과 byte-identical이었고, 같은 4개 테스트가 서버 파일에서 계속 실행된다(테스트 파일은 import의 .ts 확장자와 describe 이름만 다름).

- `keeps last month's most popular work above this month's weakest work`
- `boosts a recent release above an older work with the same popularity`
- `keeps December releases eligible across the January boundary`
- `allows year-only rows when their year overlaps the rolling window`

기존 테스트의 나머지 변경은 docs/80 D-3이 명시한 78 T-4의 타입 경로 문자열 한 곳뿐이다.

### 3. typecheck / lint 결과와 서버 보존

- 최종 `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ycy7e6yf/{typecheck.log,lint.log,summary.json}`. STEP 2 typecheck도 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-7k9laqtg/typecheck.log`에서 통과했다.
- `supabase/functions/` 전체 **108파일의 경로 집합과 SHA-256이 시작 때와 동일**하다. 추가·삭제·수정 0이며 해당 경로 git diff도 0줄이다. 서버 함수와 서버 랭킹/테스트는 그대로다.
- 새 타입 파일은 원래 타입 선언 3개를 글자 그대로 옮겼고 `import type { SearchResult } from "./content";` 외 import나 실행 코드가 없다. `/tmp/scenenote-80-type-contract.txt`, `-preservation-proof.json`.
- UI-13.2 이번 변경 줄의 토큰·Alert 위반 0줄. 화면은 라벨 한 줄만 추가돼 역할·클릭·스타일·보이는 글자·전체 해제 버튼은 원문 그대로다. `git diff --check` 통과.
- 추가 독립 읽기 전용 검토에서도 타입 원문·지정 수정·서버 파일 보존을 확인했다. 웹 빌드·원격 smoke·배포·DB 명령은 실행하지 않았다.

### 4. 추가 테스트 ID와 이름

모두 순수 Node 모듈을 쓰고, 화면 검사는 기존 findJsxOpeningTags 함수로 ownText만 읽는다. 테스트에서 RN·Supabase·TSX를 import하지 않는다.

| ID | 이름 | 파일 |
|----|------|------|
| T-1 | 80 T-1: unused client popular recommendation files are removed | `scripts/popularRecommendationsCleanup.test.ts` |
| T-2 | 80 T-2: no source references the removed client popular code | `scripts/popularRecommendationsCleanup.test.ts` |
| T-3 | 80 T-3: popular recommendation types live in a type-only module | `scripts/popularRecommendationsCleanup.test.ts` |
| T-4 | 80 T-4: the smoke script imports the response type from the types module | `scripts/popularRecommendationsCleanup.test.ts` |
| T-5 | 80 T-5: the unused popular query key is removed | `scripts/popularRecommendationsCleanup.test.ts` |
| T-6 | 80 T-6: server popular recommendation code is kept | `scripts/popularRecommendationsCleanup.test.ts` |
| T-7 | 80 T-7: each exclusion remove button names the title | `scripts/excludedRecommendationsA11y.test.ts` |
| T-8 | 80 T-8: exclusion remove button keeps role and handler | `scripts/excludedRecommendationsA11y.test.ts` |

T-2는 app/src/scripts의 모든 TS/TSX를 검사하되 자기 파일만 제외한다. T-6은 서버 보호 검사다. T-7/T-8의 대상 태그는 removeExclusion(item.key)를 포함하는 Pressable 정확히 1개다.

### 5. 지정된 4파일의 diff / 삭제·타입 이동

**`src/lib/query.ts`**

```diff
--- before/src/lib/query.ts
+++ after/src/lib/query.ts
@@ -29,7 +29,6 @@
       ["search", "similar", "similarity-snapshot-v2", userId, librarySignature, anchorKey, focus, mediaType, sort, filters] as const
   },
   recommendations: {
-    popular: (userId: string) => ["recommendations", userId, "popular", "ko-title-v2"] as const,
     personalized: (userId: string, mediaType: MediaTypeFilter, exclusionSignature = "[[],[]]", discoverySignature = "[[],[],[]]") =>
       [
         ...createRecommendationFeedKey(userId, mediaType, exclusionSignature, discoverySignature),
```

**`scripts/smoke-edge-functions.ts`**

```diff
--- before/scripts/smoke-edge-functions.ts
+++ after/scripts/smoke-edge-functions.ts
@@ -6,7 +6,7 @@
 import { createClient, type SupabaseClient } from "@supabase/supabase-js";

 import type { SearchContentResponse } from "../src/types/content";
-import type { PopularRecommendationsResponse } from "../src/services/popularRecommendations";
+import type { PopularRecommendationsResponse } from "../src/types/popularRecommendations";
 import type { Database } from "../src/types/database";

 loadEnvFile(".env");
```

**`scripts/alertUsageGuard.test.ts`**

```diff
--- before/scripts/alertUsageGuard.test.ts
+++ after/scripts/alertUsageGuard.test.ts
@@ -58,5 +58,5 @@
       return /PopularRecommendationSection|usePopularRecommendations/.test(source) ? [file] : [];
     });
   assert.deepEqual(references, []);
-  assert.ok(readFileSync(join(root, "scripts/smoke-edge-functions.ts"), "utf8").includes("services/popularRecommendations"));
+  assert.ok(readFileSync(join(root, "scripts/smoke-edge-functions.ts"), "utf8").includes("types/popularRecommendations"));
 });
```

**`app/settings/excluded-recommendations.tsx`**

```diff
--- before/app/settings/excluded-recommendations.tsx
+++ after/app/settings/excluded-recommendations.tsx
@@ -64,6 +64,7 @@
                 </Text>
               </View>
               <Pressable
+                accessibilityLabel={`${item.title} 제외 해제`}
                 accessibilityRole="button"
                 onPress={() => removeExclusion(item.key)}
                 style={styles.removeButton}
```

- 새 파일: `src/types/popularRecommendations.ts`. RecommendationCategory·PopularRecommendation·PopularRecommendationsResponse의 필드는 변경하지 않았다.
- 삭제: `src/services/popularRecommendations.ts`, `src/utils/popularRanking.ts`, `src/utils/popularRanking.test.ts`. 삭제 전 원문은 시작 snapshot에 보존했다.
- **docs/78 D-7(서비스 보존)은 docs/80이 대체한다.** 과거 명세 본문은 고치지 않았다. 78 T-4의 이름·다른 단언·허용 목록은 그대로다.
- smoke의 popular-recommendations 호출과 다른 점검 코드는 그대로다. 기존 캐시 저장값을 지우는 코드도 추가하지 않았다.
- docs/README의 80번 상태는 **구현, 화면 미확인**으로 갱신했다. 이번 범위는 명세의 12파일(삭제 3개 포함)뿐이다.

### 6. 수동 확인 M-1~M-3 / 기능 플래그

| ID | 플랫폼 | 결과·미실행 사유 |
|----|--------|------------------|
| M-1 | 웹 8081 | **미실행.** 브라우저·실제 저장값을 조작하지 않았다. 소스상 라벨 형식과 전체 해제 원문은 확인했지만 실제 aria-label 속성과 화면 낭독은 미확인이다. |
| M-2 | 웹 8081 | **미실행.** 실제 항목 삭제·화면 탐색·콘솔 확인을 실행하지 않았다. onPress와 화면 원형 보존, 전체 테스트/타입 검사는 통과했지만 실제 탐색은 미확인이다. |
| M-3 | iOS 세로 | **미실행.** 기기·시뮬레이터·VoiceOver를 실행하지 않았다. 실제 “<제목> 제외 해제, 버튼” 낭독은 미확인이다. |

`EXTENDED_FEATURES_ENABLED`는 **true로 바꾼 적 없이 false 그대로**다. 되돌릴 변경이 없으며 해당 파일 원문은 동일하다. Android 실제 확인도 미실행이다. 사용자 시청 환경을 보존했고 개발 서버를 재시작하지 않았다.

### 7. D-1~D-5 문제 여부

**변경 필요사항·충돌 없음.** D-1의 서버 불변·smoke 호출 유지, D-2의 타입 원문 이전, D-3의 기존 guard 문자열 한 곳 변경, D-4의 지정 라벨과 다른 화면 코드 보존, D-5의 순수 소스 검사를 준수했다. 타입 단언·패키지·런타임 설정 변경은 없다. docs/76~79의 기존 변경도 이번 명세가 지정한 삭제/경로 갱신 외 보존했다.

### 8. 사람이 할 후속 작업 (Edge Function 존폐·iOS)

- 실제 항목을 건드리지 않는 검증용 환경에서 서로 다른 제목 2개로 M-1/M-2를 확인한다. 기존 사용자 항목이 있으면 삭제하지 말고 미실행으로 남긴다. 확장 플래그를 임시 true로 바꾼다면 8081 서버를 재시작하고, 확인 후 검증 항목을 지우고 false로 복구한다.
- iOS VoiceOver로 M-3의 작품별 버튼 이름을 확인한다.
- **popular-recommendations Edge Function과 smoke 점검의 존폐는 사람이 판단한다.** 이번에는 둘 다 보존했고 배포하지 않았다.
- 로컬 제외 목록 화면을 유지할지 서버 설정 화면으로 전환할지는 docs/79의 제품 판단으로 남는다. 같은 제목 항목에 구분 정보를 덧붙이는 일도 범위 밖이다.
- 기존 AsyncStorage 인기 추천 캐시 키는 읽는 코드가 제거됐으므로 그대로 두며 별도 정리 코드는 넣지 않았다. DB migration·Edge 배포·커밋·푸시는 실행하지 않았다.


## 추천 제외 전체 해제 정정 (docs/79, 2026-11-19)

상태: **구현·코드 검사 통과, 웹 화면 확인(2026-11-19, 아래 "웹 실제 화면 확인"). iOS M-3 미확인.** [79](79_recommendation_exclusion_clear_fix_spec.md) 전체와 14장 STEP 1→2→3을 따랐다. D-1~D-5 변경 없음. 시작 경로·git 상태와 기존 미커밋 원문은 `/tmp/scenenote-79-start-{status.txt,snapshot.json}`에 기록했다. `scenenote-verify` 스킬과 명령에만 적용한 Node 24를 사용했다. docs/76~78을 다시 구현하지 않았으며 기존 변경을 보존했다. 브라우저·시청 앱·개발 서버·계정 저장값·DB/Edge/secret·의존성·커밋/푸시는 조작하지 않았다.

### 1. STEP 1 T-1·T-2 실제 실패

액션 3개와 타입을 순수 모듈로 옮기고 시간만 주입 가능하게 바꿨다. 이때 **clearExclusions는 원래처럼 객체만 반환하고 set을 호출하지 않는 결함을 그대로 유지**했다. 스토어에 모듈을 연결하고 테스트 6개를 쓴 뒤 전체 검사를 실행했다.

**1,843개 통과·T-1/T-2만 실패**, T-3~T-6은 통과했다. T-1은 a·b 항목이 그대로 남았고, T-2는 set 호출이 기대 1회 대신 실제 **0회**였다. 모듈이 없는 오류가 아닌 실제 결함의 실패다. 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-z0732tk0/test.log`, 원본 `/tmp/scenenote-79-red-proof.json`. 수정 전 추출 모듈·스토어는 `/tmp/scenenote-79-step1-{actions,store}.ts`에 보존했다.

```text
✖ 79 T-1: clearExclusions empties exclusions and keys (2.602791ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + [
  +   {
  +     excludedAt: '2026-11-19T00:00:00.000Z',
  +     key: 'a',
  +     title: '작품 a'
  +   },
  +   {
  +     excludedAt: '2026-11-19T00:00:00.000Z',
  +     key: 'b',
  +     title: '작품 b'
  +   }
  + ]
  - []

      at TestContext.<anonymous> (/Users/youngilkim/SceneNote/src/utils/recommendationExclusionActions.test.ts:35:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.start (node:internal/test_runner/test:1262:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ { key: 'a', title: '작품 a', excludedAt: '2026-11-19T00:00:00.000Z' }, { key: 'b', title: '작품 b', excludedAt: '2026-11-19T00:00:00.000Z' } ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

```text
✖ 79 T-2: clearExclusions updates the store exactly once (0.252209ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at TestContext.<anonymous> (/Users/youngilkim/SceneNote/src/utils/recommendationExclusionActions.test.ts:42:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

STEP 2에서는 순수 모듈의 clearExclusions 한 곳만 `set({ excludedRecommendations: [], excludedRecommendationKeys: [] })`로 바꿨다. STEP 1 이후 테스트와 스토어 파일은 다시 고치지 않았다.

### 2. npm test before / STEP 1 / after

| 단계 | 통과 | 실패 |
|------|------|------|
| 실제 시작 기준선 | 1,839 | 0 |
| STEP 1 결함 보존 추출 | 1,843 | 2(T-1·T-2) |
| STEP 2 수정 후 최종 | 1,845 | 0 |

- 기존 테스트·단언 변경 0, 신규 6개, 최종 skip 0.
- 시작 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-560jlcus/test.log`.
- STEP 1 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-z0732tk0/test.log`.
- 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-yxugyyuo/test.log`.

### 3. typecheck / lint 결과

- `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-yxugyyuo/{typecheck.log,lint.log,summary.json}`.
- 순수 모듈은 import가 0개다. RN·AsyncStorage·zustand 런타임/타입을 가져오지 않고 필요한 타입을 직접 정의했다. 테스트는 Node의 it/assert와 순수 모듈만 import한다.
- UI-13.2의 이번 변경 줄 기준 토큰·Alert 위반 0줄. `git diff --check` 통과. 웹 빌드·서버 재시작·원격 검증은 실행하지 않았다.
- 원문 비교 및 독립 읽기 전용 검토에서 추가/개별 해제 본문은 들여쓰기와 `new Date()`→`now()` 외에 동일함을 확인했다. 저장 키·version 2·persist options·migrate/normalize 전체와 canUsePersistentStorage/noopStorage는 byte-identical이다. `/tmp/scenenote-79-preservation-proof.json`.

### 4. 추가 테스트 ID와 이름

모두 `src/utils/recommendationExclusionActions.test.ts`에 있다.

| ID | 이름 |
|----|------|
| T-1 | 79 T-1: clearExclusions empties exclusions and keys |
| T-2 | 79 T-2: clearExclusions updates the store exactly once |
| T-3 | 79 T-3: excludeRecommendation appends with default title, injected time and synced keys |
| T-4 | 79 T-4: excludeRecommendation ignores a duplicate key |
| T-5 | 79 T-5: removeExclusion removes only the given key and keeps order |
| T-6 | 79 T-6: clearExclusions on an empty state stays empty |

가짜 set은 calls에 먼저 기록하고, 함수 updater면 현재 상태에 적용한 반환값을, 객체면 그 값을 얕게 병합한다. 시각은 `2026-11-19T00:00:00.000Z`로 고정한다. 테스트가 실제 계정·저장소를 읽거나 쓰지는 않는다.

### 5. recommendationUiStore.ts diff

기존 액션 본문과 RecommendationExclusion 타입은 새 순수 모듈로 옮겼다. 스토어는 default now를 쓰도록 set만 넘기며, RecommendationExclusion 타입을 기존 경로에서 계속 재내보낸다. 상태는 기존 slice/actions와 같은 모양이다.

```diff
--- before/src/stores/recommendationUiStore.ts
+++ after/src/stores/recommendationUiStore.ts
@@ -3,19 +3,16 @@
 import { create } from "zustand";
 import { createJSONStorage, persist } from "zustand/middleware";

-export interface RecommendationExclusion {
-  key: string;
-  title: string;
-  excludedAt: string;
-}
+import {
+  createRecommendationExclusionActions,
+  type RecommendationExclusion,
+  type RecommendationExclusionActions,
+  type RecommendationExclusionSlice
+} from "@/utils/recommendationExclusionActions";

-interface RecommendationUiState {
-  excludedRecommendations: RecommendationExclusion[];
-  excludedRecommendationKeys: string[];
-  excludeRecommendation: (key: string, title?: string) => void;
-  removeExclusion: (key: string) => void;
-  clearExclusions: () => void;
-}
+export type { RecommendationExclusion } from "@/utils/recommendationExclusionActions";
+
+type RecommendationUiState = RecommendationExclusionSlice & RecommendationExclusionActions;

 const canUsePersistentStorage = Platform.OS !== "web" || typeof window !== "undefined";
 const noopStorage = {
@@ -29,36 +26,7 @@
     (set) => ({
       excludedRecommendations: [],
       excludedRecommendationKeys: [],
-      excludeRecommendation: (key, title = "제목 없는 작품") =>
-        set((state) => {
-          if (state.excludedRecommendations.some((item) => item.key === key)) return {};
-
-          const excludedRecommendations = [
-            ...state.excludedRecommendations,
-            {
-              key,
-              title,
-              excludedAt: new Date().toISOString()
-            }
-          ];
-
-          return {
-            excludedRecommendations,
-            excludedRecommendationKeys: excludedRecommendations.map((item) => item.key)
-          };
-        }),
-      removeExclusion: (key) =>
-        set((state) => {
-          const excludedRecommendations = state.excludedRecommendations.filter((item) => item.key !== key);
-          return {
-            excludedRecommendations,
-            excludedRecommendationKeys: excludedRecommendations.map((item) => item.key)
-          };
-        }),
-      clearExclusions: () => ({
-        excludedRecommendations: [],
-        excludedRecommendationKeys: []
-      })
+      ...createRecommendationExclusionActions(set)
     }),
     {
       name: "scenenote-recommendation-ui",
```

전체 diff는 `/tmp/scenenote-79-store.diff`에도 있다. 순수 모듈의 STEP 1→2 차이는 clearExclusions 한 곳뿐이다. 저장 키/버전/마이그레이션/스토리지 가드·정규화·화면 원문은 변경하지 않았다.

### 6. 수동 확인 M-1~M-3 / 기능 플래그

| ID | 플랫폼 | 결과·미실행 사유 |
|----|--------|------------------|
| M-1 | 웹 8081 | **미실행.** 브라우저·실제 localStorage 항목을 조작하지 않았다. 메모리 가짜 set에서 두 배열이 비는 것은 확인했지만 실제 빈 상태/프로필 개수·새로고침 뒤 저장 유지는 미확인이다. |
| M-2 | 웹 8081 | **미실행.** 실제 항목 삭제나 확인/취소를 실행하지 않았다. 순수 모듈의 개별 해제·순서·keys 동기화는 통과했지만 화면 확인은 하지 않았다. |
| M-3 | iOS 세로 | **미실행.** 기기·시뮬레이터·AsyncStorage를 조작하지 않았다. 실제 앱 재실행 후 저장 유지 여부는 미확인이다. |

`EXTENDED_FEATURES_ENABLED`는 **true로 바꾸지 않았고 false 그대로**다. 되돌릴 변경이 없으며 화면/feature flag 원문도 그대로다. Android 실제 확인도 미실행이다. 사용자 시청 환경을 보존했다.

### 7. D-1~D-5 문제 여부

**변경 필요사항·충돌 없음.** D-1의 RN 없는 액션 모듈, D-2의 결함 보존 추출 후 수정 순서, D-3의 상태/저장 스키마·타입 재내보내기, D-4의 선택적 시간 주입 및 default now, D-5의 화면 불변을 준수했다. 수정은 명세의 5파일에 한정한다. 기존 docs/76~78과 다른 스토어·서버 추천 제외 설정을 건드리지 않았다.

### 8. 사람이 할 후속 작업 (13장 포함)

- 검증용 항목만 있는 환경에서 M-1/M-2를 확인한다. 기존 사용자 실제 항목이 있으면 전체 해제로 지우지 말고 미실행으로 남긴다. 확장 플래그를 잠시 true로 바꾼다면 8081 서버를 재시작한 뒤 확인하고, 종료 후 false로 복구한다. 이번 세션은 서버/플래그를 변경하지 않았다.
- iOS에서 같은 동작과 앱 재실행 후 AsyncStorage의 빈 목록 유지를 확인한다(M-3).
- 현재 로컬 excludeRecommendation 호출부는 없고 이 화면은 예전 저장 항목만 다룬다. 확장 기능을 열 때 로컬 제외 목록 화면을 유지할지 서버 recommendationPreferences 화면으로 바꿀지는 제품 판단이 필요하다(13장).
- DB migration·Edge 배포는 이번 변경에 필요 없고 실행하지 않았다. 커밋·푸시도 하지 않았다.


### 웹 실제 화면 확인 (Claude, 2026-11-19)

재실행 결과: `npm test` 1,845개 통과(79 T-1~T-6 포함), typecheck·lint 통과. 순수 모듈에 RN·AsyncStorage·zustand import가 없고, 스토어 diff는 인터페이스 이동·타입 재내보내기·액션 펼치기뿐이다(저장 키·버전·마이그레이션은 그대로). 로컬에서 `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꾸고 8081을 재시작해 확인한 뒤 `false`로 되돌렸다. 검증용 항목 3개를 `localStorage`에 넣어 확인하고 키를 지웠다(원래 값 `null`, 사용자 데이터 없음).

| ID | 결과 |
|----|------|
| M-1 | ✓ "전체 해제" → 확인 시 "0개"와 빈 상태가 보이고, 저장값이 `{"excludedRecommendations":[],"excludedRecommendationKeys":[]}`가 된다. 새로고침 뒤에도 0개다 |
| M-2 | ✓ 3개 중 B의 개별 "해제"를 누르면 A·C만 남는다(keys `["test:a79","test:c79"]`). 전체 해제를 취소하면 2개가 유지된다. 빈 목록에서 전체 해제를 누르면 확인 창이 뜨지 않는다(E-2) |
| M-3 | 미실행(iOS) |

참고(별도 개선 후보): 개별 "해제" 버튼은 모두 접근성 이름이 "해제"뿐이라, 화면 낭독기로는 어느 작품의 버튼인지 구분할 수 없다. 확장 기능을 켤 때 `accessibilityLabel={`${item.title} 제외 해제`}` 같은 라벨이 필요하다. 13장의 제품 판단(로컬 목록 화면 유지 여부)과 함께 정한다.

## 웹 Alert 정리·미사용 추천 섹션 제거 (docs/78, 2026-11-19)

상태: **구현·코드 검사 통과, 웹 화면 일부 확인(2026-11-19, 아래 "웹 실제 화면 확인"). 별도 결함 1건 발견(`clearExclusions`). iOS M-5 미확인.** 정정된 [78](78_web_alert_and_dead_code_cleanup_spec.md) 14장과 10장 T-4를 적용했다. D-1~D-7 변경 없음. 명세가 지정한 두 미사용 파일 삭제 외에는 docs/74~77과 사용자의 기존 미커밋 작업을 보존했다. 작업 시작/재개 상태는 `/tmp/scenenote-78-start-{status.txt,snapshot.json}`, `/tmp/scenenote-78-resume-{status.txt,snapshot.json}`에 기록했다. `scenenote-verify`와 명령에만 적용한 Node 24로 검증했다. 브라우저·시청 앱·개발 서버·운영 DB/Edge/secret·의존성·커밋/푸시는 조작하지 않았다.

### 1. STEP 1 T-1·T-3 실제 실패 / 단계별 검증

사용자 정정(2026-11-19)대로 기존 테스트의 **T-4 필터에 REMOVED_FILES 두 경로만 추가**했다. T-1의 허용 목록 3곳, 검사식, 기존 단언은 바꾸지 않았다. 정정 후 전체 테스트는 **1,839개 중 1,837개 통과·T-1/T-3만 실패**, T-2/T-4는 통과했다. T-1 실제 값은 15회·8파일이다. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-950wpcgx/test.log`, 원본 `/tmp/scenenote-78-corrected-step1-proof.json`.

T-1 실제 출력:

```text
✖ 78 T-1: Alert.alert appears only in the documented allowlist (18.970542ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      [
        'app/(tabs)/pins.tsx',
  +     2
  +   ],
  +   [
  +     'app/(tabs)/profile.tsx',
        1
      ],
      [
  +     'app/library/import.tsx',
  +     4
  +   ],
  +   [
  +     'app/library/photo-import.tsx',
  +     4
  +   ],
  +   [
  +     'app/settings/excluded-recommendations.tsx',
  +     1
  +   ],
  +   [
  +     'src/components/content/PopularRecommendationSection.tsx',
  +     1
  +   ],
  +   [
        'src/utils/confirmDestructive.ts',
        1
      ],
      [
        'src/utils/confirmDiscard.ts',

      at TestContext.<anonymous> (/Users/youngilkim/SceneNote/scripts/alertUsageGuard.test.ts:33:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.start (node:internal/test_runner/test:1262:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ [ 'app/(tabs)/pins.tsx', 2 ], [ 'app/(tabs)/profile.tsx', 1 ], [ 'app/library/import.tsx', 4 ], [ 'app/library/photo-import.tsx', 4 ], [ 'app/settings/excluded-recommendations.tsx', 1 ], [ 'src/components/content/PopularRecommendationSection.tsx', 1 ], [ 'src/utils/confirmDestructive.ts', 1 ], [ 'src/utils/confirmDiscard.ts', 1 ] ],
    expected: [ [ 'app/(tabs)/pins.tsx', 1 ], [ 'src/utils/confirmDestructive.ts', 1 ], [ 'src/utils/confirmDiscard.ts', 1 ] ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

T-3 실제 출력:

```text
✖ 78 T-3: the unused popular recommendation section and hook are removed (0.367167ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      [
        'src/components/content/PopularRecommendationSection.tsx',
  +     true
  -     false
      ],
      [
        'src/hooks/usePopularRecommendations.ts',
  +     true
  -     false
      ]
    ]

      at TestContext.<anonymous> (/Users/youngilkim/SceneNote/scripts/alertUsageGuard.test.ts:47:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ [ 'src/components/content/PopularRecommendationSection.tsx', true ], [ 'src/hooks/usePopularRecommendations.ts', true ] ],
    expected: [ [ 'src/components/content/PopularRecommendationSection.tsx', false ], [ 'src/hooks/usePopularRecommendations.ts', false ] ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

STEP 2의 5개 화면 교체 뒤에도 **1,837개 통과·T-1/T-3 실패**였으며, T-1에는 허용 목록 외 `src/components/content/PopularRecommendationSection.tsx`의 1회만 남았다. 정정된 기대와 같다. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-z5zud10h/test.log`, `/tmp/scenenote-78-step2-proof.json` 및 `-step2-alerts.json`.

STEP 3에서 컴포넌트와 전용 훅을 삭제한 뒤 T-1~T-4가 모두 통과했다.

### 2. npm test before / after

- 실제 시작 기준선 **1,835/1,835 → 최종 1,839/1,839**, 신규 4개·실패/skip 0. 기존 테스트 파일·단언은 변경하지 않았다. 이번 새 guard 파일의 T-4 제외 목록만 정정 지시대로 바꿨다.
- 시작 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-rhyhdn_8/test.log`.
- 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ws0xfy3_/test.log`.
- 허용된 `Alert.alert`는 `app/(tabs)/pins.tsx`, `src/utils/confirmDestructive.ts`, `src/utils/confirmDiscard.ts` 각 1회로 **총 3회**다. 처음 15회에서 12회가 제거됐다(화면 호출부 11회 교체/삭제와 미사용 컴포넌트 1회 삭제).

### 3. typecheck / lint 결과와 원문 보존

- `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ws0xfy3_/{typecheck.log,lint.log,summary.json}`.
- 별도 읽기 전용 검증은 resume snapshot에 6.2의 지정 교체를 적용한 기대 AST와 현재 5개 화면의 본문 AST가 동일함을 확인했다. 허용된 import 추가/제거 및 새 `addToast` selector 3개도 각각 검사했다. 인라인 오류 상태·스타일·role·기타 콜백·hasItems·console.error·스포일러 3지선다·기존 플랫폼 분기가 보존됐다. `/tmp/scenenote-78-preservation-audit{.cjs,-report.json}`.
- UI-13.2 **이번에 추가·변경한 화면 줄의 토큰/Alert 위반 0줄**. 5개 화면의 기존 토큰 위반 74줄은 범위 밖으로 보존했다. `/tmp/scenenote-78-ui-added-lines.json`, `-preexisting-tokens.json`.
- `git diff --check` 통과. 웹 빌드·개발 서버·화면 검증은 이번에 실행하지 않았다.

### 4. 추가 테스트 ID와 이름

모두 `scripts/alertUsageGuard.test.ts`에 있고 순수 Node 모듈만 import한다.

| ID | 이름 |
|----|------|
| T-1 | 78 T-1: Alert.alert appears only in the documented allowlist |
| T-2 | 78 T-2: the pins Alert is reachable only after the web early return |
| T-3 | 78 T-3: the unused popular recommendation section and hook are removed |
| T-4 | 78 T-4: no source file references the removed section or hook while the smoke type import remains |

T-1은 app/src의 비테스트 TS/TSX에서 문서의 정규식으로 위치별 호출 수까지 비교하고, T-2는 sharePin 내부 웹 조기 반환 뒤에 Alert가 있는지 확인한다. T-3은 삭제 대상 두 파일의 부재, T-4는 그 두 파일과 자기 테스트를 제외한 외부 참조 0개 및 smoke 타입 import 보존을 확인한다. 허용 목록을 늘리지 않았다.

### 5. 6.2 표 각 행의 교체 결과 / 삭제 파일

| 원래 위치 | 현재 위치 또는 삭제 지점 | 결과 |
|-----------|--------------------------|------|
| `app/(tabs)/pins.tsx:137` | `app/(tabs)/pins.tsx:140` | 공유 오류를 지정 fallback의 error 토스트로 교체. console.error·앱 전용 가드·3지선다 유지 |
| `app/(tabs)/profile.tsx:193` | `app/(tabs)/profile.tsx:191 뒤에서 삭제` | 중복 Alert와 Alert import만 삭제. 기존 shareFeedback 인라인 오류 보존 |
| `app/settings/excluded-recommendations.tsx:28` | `app/settings/excluded-recommendations.tsx:29` | hasItems 가드 후 confirmDestructive. 전체 해제/추천 제외 목록을 모두 비울까요?/해제/clearExclusions 그대로 |
| `app/library/import.tsx:87` | `app/library/import.tsx:89 인라인 상태 뒤 Alert 삭제` | 중복 Alert만 삭제. setParseError 인라인 상태 보존 |
| `app/library/import.tsx:93` | `app/library/import.tsx:95` | 엑셀 미선택 본문 그대로 info 토스트 |
| `app/library/import.tsx:107` | `app/library/import.tsx:109` | 검사/등록에 따라 지정한 한국어 fallback을 쓰는 error 토스트 |
| `app/library/import.tsx:114` | `app/library/import.tsx:116` | Dry-run 안내 본문 그대로 info 토스트 |
| `app/library/photo-import.tsx:97` | `app/library/photo-import.tsx:99 인라인 상태 뒤 Alert 삭제` | 중복 Alert만 삭제. setErrorMessage 인라인 상태 보존 |
| `app/library/photo-import.tsx:122` | `app/library/photo-import.tsx:124` | 검색 결과 미선택 본문 그대로 info 토스트 |
| `app/library/photo-import.tsx:130` | `app/library/photo-import.tsx:132` | 기존 등록 완료 본문의 success 토스트 + 라이브러리 보기 액션(router.replace) |
| `app/library/photo-import.tsx:135` | `app/library/photo-import.tsx:134` | 지정 한국어 fallback을 쓰는 error 토스트 |

- 삭제: `src/components/content/PopularRecommendationSection.tsx`, `src/hooks/usePopularRecommendations.ts`. 삭제 전 원문은 시작/재개 snapshot에 보존돼 있다.
- 유지: `src/services/popularRecommendations.ts`, `scripts/smoke-edge-functions.ts`의 타입 import, `src/lib/query.ts`, `supabase/functions/popular-recommendations/`와 기타 Edge/DB 경로.
- 관련 외부 참조는 새 guard 테스트 말고 0개다. 교체된 토스트 오류는 6.2의 한국어 fallback을 정확히 사용하고, 기존 한국어 안내 본문은 그대로다. D-2가 지정한 인라인 오류 표현식도 그대로다.
- UI-13.2에 명세 11장 문장 하나만 추가했고, docs/README 78번 상태는 **구현, 화면 미확인**으로 갱신했다. 자세한 위치는 `/tmp/scenenote-78-{app-report,import-report}.json`.

### 6. 수동 확인 M-1~M-5 / 기능 플래그

| ID | 플랫폼 | 결과·미실행 사유 |
|----|--------|------------------|
| M-1 | 웹 8081 | **미실행.** 브라우저·로그인 세션을 조작하지 않았다. hasItems 가드와 confirmDestructive 인자는 소스로 확인했으나 실제 확인/취소와 목록 변경은 미확인이다. |
| M-2 | 웹 8081 | **미실행.** 파일 선택·잘못된 엑셀 입력을 실행하지 않았다. info 토스트와 읽기 오류의 인라인 상태 보존은 소스로 확인했으나 실제 표시 횟수는 미확인이다. |
| M-3 | 웹 8081 | **미실행.** 사진 선택·등록으로 사용자 기록을 바꾸지 않았다. 성공 토스트의 액션/경로는 확인했지만 실제 표시 시간과 클릭 이동은 미확인이다. |
| M-4 | 웹 8081 | **미실행.** 실제 공유 실패를 만들거나 브라우저를 조작하지 않았다. 기존 인라인 상태만 남았지만 실제 표시 확인은 하지 않았다. |
| M-5 | iOS 세로 | **미실행.** 기기·시뮬레이터·네이티브 확인 창·공유를 실행하지 않았다. 3지선다 원문 보존과 전체 정적 검사는 통과했으나 실제 낭독/클릭/표시는 미확인이다. |

`EXTENDED_FEATURES_ENABLED`는 **한 번도 true로 바꾸지 않았고 false 그대로다**. 되돌릴 변경이 없으며 기능 플래그 파일 원문도 동일하다. Android 실제 확인도 미실행이다. 사용자 시청 환경을 보존했다.

### 7. D-1~D-7 문제 여부

**변경 필요사항·충돌 없음.** D-1의 공용 토스트/확인 경로, D-2의 인라인 오류 원문 보존, D-3의 6.2 토스트 오류 변환, D-4의 본문 유지, D-5의 앱 3지선다, D-6의 3곳 허용 목록, D-7의 서비스/Edge/query key 보존을 지켰다. 새 플랫폼 분기나 화면 직접 window.confirm은 만들지 않았다. 변경은 명세 11장의 11파일(삭제 2개 포함)에 한정한다.

### 8. 사람이 할 후속 작업 (12.1 포함)

- 로그인된 웹에서 로컬 확장 플래그를 잠시 켜 M-1~M-3을 확인한 뒤 반드시 false로 복구한다. M-3은 3.5초 토스트 안의 “라이브러리 보기” 액션도 확인한다. M-4 공유 실패의 인라인 표시도 확인한다.
- iOS에서 이 명세 M-5와 docs/74 M-11·M-12, docs/75 M-6·M-7, docs/76 M-5, docs/77 M-3을 함께 확인한다. docs/74 M-8은 웹도 미실행으로 남아 있다.
- docs/74~78의 기존 미커밋 변경을 작업 단위로 나눠 검토·커밋한다(이번 세션은 커밋/푸시하지 않음).
- 실제 화면 확인 전 필요하면 사람 담당자가 기존 8081 서버를 확인하고 같은 포트로 재시작한다. 이번 작업에서는 서버를 조작하지 않았다.
- DB migration·Edge 배포는 이번 변경에 필요 없고 실행하지 않았다.

### 웹 실제 화면 확인 (Claude, 2026-11-19)

재실행 결과: `npm test` 1,839개 통과(78 T-1~T-4 포함), typecheck·lint 통과. `Alert.alert`는 허용 목록 3곳(`pins.tsx:149`, `confirmDiscard.ts:7`, `confirmDestructive.ts:18`)뿐이고 삭제 대상 두 파일은 없다. 6.2 표의 교체는 모두 명세대로다. 로컬에서 `EXTENDED_FEATURES_ENABLED`를 잠시 `true`로 바꾸고 8081을 재시작해 확인한 뒤 `false`로 되돌렸다.

| ID | 결과 |
|----|------|
| M-1 | 확인 창 ✓, 해제 ✗(별도 결함). 빈 목록일 때 `localStorage`에 검증용 항목 1개를 넣어 확인했다(확인 후 키 삭제, 원래 `null`). "전체 해제"를 누르면 `window.confirm("전체 해제\n\n추천 제외 목록을 모두 비울까요?")`가 호출된다. 취소하면 목록이 유지된다 ✓. **확인해도 목록이 비워지지 않는다** ✗ |
| M-2 | 부분. "Dry-run 확인"·"등록 확인"은 파일이 없거나 검사 전이면 `disabled`라 안내 토스트 2개는 화면에서 도달하지 않는 방어 코드다. 잘못된 파일의 `ErrorPanel` 단독 표시는 파일 업로드를 하지 않아 미확인 |
| M-3 | 미실행. 등록 버튼은 선택 전 `disabled`. 등록 성공 토스트는 운영 DB에 실제로 라이브러리를 추가해야 해서 실행하지 않았다 |
| M-4 | 미실행(공유 실패를 만들 수 없음) |
| M-5 | 미실행(iOS) |

**발견한 결함(docs/78 이전부터 있음):** `src/stores/recommendationUiStore.ts:58`의 `clearExclusions: () => ({ excludedRecommendations: [], excludedRecommendationKeys: [] })`는 `set()`을 호출하지 않고 객체만 반환한다. 그래서 "전체 해제"는 웹·앱 모두 아무것도 지우지 않는다. 예전 앱 `Alert` 경로도 같은 콜백이었다. `clearExclusions: () => set({ excludedRecommendations: [], excludedRecommendationKeys: [] })`로 고쳐야 한다. 확장 기능이 꺼져 있어 지금 사용자에게는 보이지 않는다.


## 출연진 카드 선택 상태 정정 (docs/77, 2026-11-18)

상태: **구현·코드 검사 통과, 웹 화면 확인(2026-11-18, 아래 "웹 실제 화면 확인"). iOS M-3 미확인.** [77](77_cast_card_selection_state_fix_spec.md) 전체와 14장 STEP 1→2→3→4를 따랐다. 기존 docs/74·75·76 및 사용자 문서의 미커밋 변경을 보존했다. 시작 root `/Users/youngilkim/SceneNote`, `main` `519ddc7`; git 상태와 원문은 `/tmp/scenenote-77-start-{status.txt,snapshot.json}`에 기록했다. `scenenote-verify` 스킬과 명령에만 적용한 Node 24를 사용했다. docs/76 구현을 다시 수행하거나 helper·guard를 수정하지 않았다.

### 1. STEP 1 T-2 실제 실패

새 `scripts/castSectionA11y.test.ts`만 먼저 추가한 뒤 전체 `npm test`를 실행했다. **1,835개 중 1,834개 통과·T-2만 실패**, T-1·T-3은 통과했다. 검사나 단언을 완화하지 않았다. 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-frrsx3pq/test.log`. `/tmp/scenenote-77-red-proof.json`에 원본 출력을 보존했다.

```text
✖ 77 T-2: cast card exposes no selection or toggle state on any platform (2.225083ms)
  AssertionError [ERR_ASSERTION]: Cast card must not include selectionAriaProps

  true !== false

      at TestContext.<anonymous> (/Users/youngilkim/SceneNote/scripts/castSectionA11y.test.ts:21:12)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

### 2. npm test before / after

- 시작 **1,832/1,832 → 최종 1,835/1,835**, 신규 3개·실패/skip 0. 기존 테스트 파일·단언 변경 0.
- 시작 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-5vny3lml/test.log`.
- 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-978rk2tt/test.log`.
- `77 T-1~T-3`, `75 T-16` 및 기존 docs/76 테스트 모두 통과했다. 다른 선택 칩 호출부는 시작 원문 그대로다.

### 3. typecheck / lint 결과

- `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. 로그 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-978rk2tt/{typecheck.log,lint.log,summary.json}`.
- UI-13.2 토큰·Alert grep은 이번에 바뀐 카드 줄 기준 **0줄**, CastSection 파일 전체도 **0줄**이다. 타입 단언·의존성·설정 변경 없음.
- `git diff --check` 통과. 원문과 정확히 지정된 세 삭제만 대조했고, 별도 읽기 전용 검토에서도 일치를 확인했다. `/tmp/scenenote-77-scope-proof.json`.

### 4. 추가 테스트 ID와 이름

모두 `scripts/castSectionA11y.test.ts`에 있다. `node:test`·`node:assert/strict`·`node:fs`·`node:url`과 기존 guard의 순수 함수만 import한다. 테스트에서 RN/Expo/Supabase 모듈을 import하지 않는다.

| ID | 이름 |
|----|------|
| T-1 | 77 T-1: cast section has exactly one person-detail card opening tag |
| T-2 | 77 T-2: cast card exposes no selection or toggle state on any platform |
| T-3 | 77 T-3: cast card keeps its button role, registered label and open handler |

T-1은 인물 상세 카드 태그 1개, T-2는 카드 `ownText`의 금지 상태 문자열 5개와 파일 전체 helper 문자열 0회, T-3은 기존 button role·등록됨 라벨·이동 handler를 검사한다.

### 5. CastSection.tsx diff

스프레드와 더 쓰지 않는 `Platform`·helper import만 제거했다. 카드 줄의 나머지 문자와 `key`·role·라벨·onPress·style, 등록 배경·배지·8명 제한은 원문 그대로다. `plain`으로 대체하지 않았다.

```diff
--- before/src/components/content/CastSection.tsx
+++ after/src/components/content/CastSection.tsx
@@ -1,16 +1,15 @@
-import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
+import { Pressable, StyleSheet, Text, View } from "react-native";
 import { DashboardPanel } from "@/components/profile/DashboardPanel";
 import { PersonAvatar } from "@/components/people/PersonAvatar";
 import { colors, radius, spacing, typography } from "@/constants/theme";
 import type { CastMember } from "@/types/content";
 import { resolveCastMemberPerson } from "@/utils/peopleScreen";
-import { selectionAriaProps } from "@/utils/selectionAria";
 interface CastSectionProps { cast: CastMember[]; isAnime: boolean; favoriteKeys: ReadonlySet<string>; columns: 1 | 2; onOpen: (member: CastMember) => void }
 export function CastSection({ cast, isAnime, favoriteKeys, columns, onOpen }: CastSectionProps) {
   return <DashboardPanel title={isAnime ? "성우" : "출연 배우"} subtitle="누르면 인물 정보를 확인하고 좋아하는 인물로 등록할 수 있어요.">
     <View style={styles.grid}>{cast.slice(0, 8).map(member => {
       const registered = favoriteKeys.has(resolveCastMemberPerson(member, isAnime).key);
-      return <Pressable key={`${member.id}:${member.character ?? ""}`} accessibilityRole="button" {...selectionAriaProps("button", registered, Platform.OS)} accessibilityLabel={`${member.name} 인물 상세 보기${registered ? ", 등록됨" : ""}`} onPress={() => onOpen(member)} style={[styles.item, { width: columns === 2 ? "48.5%" : "100%", backgroundColor: registered ? colors.primarySoft : colors.surfaceMuted }]}>
+      return <Pressable key={`${member.id}:${member.character ?? ""}`} accessibilityRole="button" accessibilityLabel={`${member.name} 인물 상세 보기${registered ? ", 등록됨" : ""}`} onPress={() => onOpen(member)} style={[styles.item, { width: columns === 2 ? "48.5%" : "100%", backgroundColor: registered ? colors.primarySoft : colors.surfaceMuted }]}>
         <PersonAvatar name={member.name} profileUrl={member.profile_url} size={40} />
         <View style={styles.copy}>
           <View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{member.name}</Text>{registered ? <Text style={styles.badge}>등록됨</Text> : null}</View>
```

전체 diff는 `/tmp/scenenote-77-cast.diff`에도 보존했다. UI-4.4에는 명세 8.1 문장만 지정 위치에 추가했다. `docs/README.md`의 77번 상태는 **구현, 화면 미확인**으로 갱신했다.

### 6. 수동 확인 M-1~M-3

| ID | 플랫폼 | 결과·사유 |
|----|--------|-----------|
| M-1 | 웹 8081 | **미실행.** 브라우저·로그인 세션을 조작하지 않았다. 순수 소스 검사에서 상태 속성 없음과 등록 라벨 보존을 확인했지만 실제 페이지 DOM·배지는 미확인이다. |
| M-2 | 웹 8081 | **미실행.** 브라우저 클릭·이동을 실행하지 않았다. 다른 칩 원문 및 카드 onPress는 그대로이며 전체 정적 검사는 통과했지만 실제 탐색은 미확인이다. |
| M-3 | iOS 세로 | **미실행.** 기기·시뮬레이터·VoiceOver를 실행하지 않았다. 등록된 카드에 선택 상태를 주는 코드는 제거했으나 실제 낭독은 미확인이다. |

Android 실제 낭독도 실행하지 않았다. 사용자 시청 환경을 보존했고 브라우저·시청 앱·개발 서버는 열거나 종료하지 않았다.

### 7. D-1~D-4 문제 여부

**변경 필요사항·충돌 없음.** D-1의 플랫폼 공통 상태 제거, D-2의 나머지 원문 보존, D-3의 helper/guard 불변, D-4의 지정 문장 추가를 지켰다. 변경 범위는 명세의 5파일뿐이고 기존 다른 작업을 되돌리지 않았다.

### 8. 사람이 할 후속 작업

로그인된 웹에서 등록/미등록 카드의 pressed·selected가 모두 없고 등록 라벨·배지는 유지되는지(M-1), 다른 칩 상태와 인물 상세 이동이 같은지(M-2), iOS VoiceOver에서 “선택됨” 없이 기존 등록 라벨과 버튼 역할을 읽는지(M-3) 확인해야 한다. DB·Edge 변경/배포는 필요 없고 실행하지 않았다. 커밋·푸시도 하지 않았다.

### 웹 실제 화면 확인 (Claude, 2026-11-18)

재실행 결과: `npm test` 1,835개 통과(77 T-1~T-3 포함), typecheck·lint 통과. 실행 중이던 8081 서버가 변경 전 번들을 계속 내보내고 있어(새로고침 후에도 `selectionAriaProps` 호출이 남아 있었음), 서버를 재시작한 뒤 확인했다.

| ID | 결과 |
|----|------|
| M-1 | ✓ 작품 상세 `/content/e24a00dc-…`에서 출연진 카드 8개 모두 `role=button`이고 `aria-pressed`·`aria-selected`가 없다. 등록된 카드의 라벨 "오세영 인물 상세 보기, 등록됨"과 "등록됨" 배지·배경색이 유지된다 |
| M-2 | ✓ 같은 화면의 다른 칩은 `aria-pressed`를 유지한다(시청 상태 "보고 싶음", OTT "정액제" true). 등록 카드를 누르면 `/people/tmdb:2339725`로 이동한다. 콘솔 오류 0. tab이 아닌 요소의 `aria-selected` 0 |
| M-3 | 미실행(iOS) |



## 웹 접근성 선택 상태 후속 정정 (docs/76, 2026-11-18)

상태: **코드 검사 통과, 웹 화면 확인(2026-11-18, 아래 "웹 실제 화면 확인"). iOS M-5 미확인.** [76](76_web_aria_selection_followup_spec.md) 전체와 14장 STEP 1→2→3→4→5를 따라 구현했다. D-1~D-6 변경 없음. 시작 경로 `/Users/youngilkim/SceneNote`, `main` `519ddc7`과 docs/74·75 및 사용자 문서의 기존 미커밋 변경을 `/tmp/scenenote-76-start-{status.txt,snapshot.json}`에 기록했다. `scenenote-verify` 스킬과 명령에만 적용한 Node 24를 사용했다. 브라우저·시청 앱·개발 서버·운영 DB·Edge·secret·의존성·커밋/푸시는 조작하지 않았다.

### 1. STEP 1 및 STEP 3의 실제 실패

먼저 신규 테스트 14개를 작성하고, docs/75 테스트를 명세 10장 허용 범위로만 변경했다. 함수·검사기·화면은 아직 고치지 않은 상태에서 전체 `npm test`를 실행했다.

- STEP 1 실제 결과: 테스트 1,825개 중 1,811개 통과·14개 실패. 순수 함수가 아직 없어 아래 모듈 오류로 T-1~T-8은 **개별 등록/실행 전에 테스트 파일 전체가 실패**했다. 이를 T-1~T-8이 각각 실행된 실패라고 세지 않는다. T-9~T-11은 각각 실제 실패했고, T-13 및 변경된 docs/75의 구규칙 테스트도 예상대로 실패했다.
- STEP 1 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-j0wd8a00/test.log`. `/tmp/scenenote-76-step1-proof.json`에 실패 이름과 합계를 보존했다.

```text
Error: Cannot find module './selectionAria'
Require stack:
- /Users/youngilkim/SceneNote/src/utils/selectionAria.test.ts
code: 'MODULE_NOT_FOUND'
✖ src/utils/selectionAria.test.ts

✖ 76 T-9: nested opening tags retain source order and do not leak into parent ownText
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  1 !== 3
✖ 76 T-10: nested tags with arrow functions and object braces keep their exact endpoints
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  1 !== 3
✖ 76 T-11: a nested selected button reports R-2 on its own source line
  +     line: 1,
  -     line: 2,
  +     snippet: '<FlashList ListHeaderComponent={<View>'
```

T-11 원본 diff의 정확한 두 줄:

```text
  +     snippet: '<FlashList ListHeaderComponent={<View>'
  -     snippet: '<Pressable accessibilityRole="button" aria-selected={s}>'
```

STEP 2에서 순수 함수만 구현한 뒤 T-1~T-8 **8/8 통과**: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-xh9xvahs/test.log`.

STEP 3에서 중첩 JSX와 `ownText`, R-1/R-2를 구현한 뒤 전체 `npm test`는 **1,832개 중 1,831개 통과·T-16만 실패**, 새 R-2가 정확히 **34건**이었다. T-9~T-14와 허용한 docs/75 기대값 변경도 이때 통과했다. 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-7_z3d0pv/test.log`, 근거 `/tmp/scenenote-76-step3-proof.json`.

실제 T-16 실패 건수와 앞 10개 위치:

```text
AssertionError [ERR_ASSERTION]: ARIA state violations: 34
app/(tabs)/library.tsx:432 R-2 <Pressable
app/(tabs)/library.tsx:481 R-2 <Pressable
app/(tabs)/library.tsx:514 R-2 <Pressable
app/(tabs)/library.tsx:585 R-2 <Pressable
app/(tabs)/library.tsx:640 R-2 <Pressable
app/(tabs)/library.tsx:652 R-2 <Pressable
app/_layout.tsx:199 R-2 <Pressable
app/library/photo-import.tsx:236 R-2 <Pressable
app/library/photo-import.tsx:270 R-2 <Pressable
app/people/[id].tsx:792 R-2 <Pressable
```

### 2. npm test before / after

- 기준선 **1,818/1,818 → 최종 1,832/1,832**, 신규 14개·실패/skip 0. 기존 테스트 수를 줄이지 않았다.
- 기준선 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-hq25a_e3/test.log`.
- 최종 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ea20kxsm/test.log`.
- 최종 T-16 R-1/R-2 위반 0. `accessibilityState`는 app/src 전체 0줄을 유지하고, selectionAria 유틸/테스트를 제외한 직접 `aria-selected`는 `app/people/[id].tsx:535`의 `tab` 1줄뿐이다.

### 3. typecheck / lint 결과와 별도 검증

- `npm run typecheck`, `npm run lint` 모두 **exit 0·오류 0·경고 0**. `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ea20kxsm/{typecheck.log,lint.log,summary.json}`. 속성 타입 단언·any·의존성 변경·검사 완화를 추가하지 않았다.
- 별도 TypeScript AST 비교는 23개 화면/컴포넌트의 34개 선택 값과 역할 인자, 하단 탭 current 예외, 동적 TagChip·조건부 PinListCard를 대조했다. 기존 role/label/hint/liveRegion/다른 ARIA/구조/스타일/콜백은 동일하다. `/tmp/scenenote-76-ast-{verify.cjs,report.json}`.
- 실제 설치 RN-web + ReactDOMServer 격리 검사 **25개 통과**. 실제 SegmentedControl·SeasonSelector·TagChip의 DOM, 선택 true/false, `radio`의 checked, `tab`의 selected, 현재 페이지 예외, 기존 disabled/busy를 확인했다. 외부 fetch 0·브라우저 프로세스 0. 아이콘만 모의 처리했고 화면 이벤트·화면 배치·실제 낭독을 검사한 것은 아니다. `/tmp/scenenote-76-dom-ssr-{fixture.mjs,report.json}`.
- 독립 정적 검토에서도 실제 검색 FlashList 안 role 28개가 개별 추출되고 부모 `ownText`에는 role이 섞이지 않음을 확인했다. 라이브러리·핀의 prop 안 JSX도 별도 추출한다. episodes의 50줄 태그는 prop 안 JSX가 없고 중괄호·화살표를 지나 정상 종결한다.
- `git diff --check` 통과. 빌드·배포·서버 재시작은 이번에 실행하지 않았다.

### 4. 신규 테스트 ID와 이름 / docs/75 기대 변경

| ID | 실제 이름 | 파일 |
|----|-----------|------|
| T-1 | 76 T-1: web buttons expose true and false pressed states | `src/utils/selectionAria.test.ts` |
| T-2 | 76 T-2: iOS and Android buttons preserve true and false selected states | `src/utils/selectionAria.test.ts` |
| T-3 | 76 T-3: current web buttons omit selection and pressed states | `src/utils/selectionAria.test.ts` |
| T-4 | 76 T-4: web radios expose checked state only | `src/utils/selectionAria.test.ts` |
| T-5 | 76 T-5: plain elements omit web state and preserve native selected state | `src/utils/selectionAria.test.ts` |
| T-6 | 76 T-6: macOS and Windows follow the non-web selection contract | `src/utils/selectionAria.test.ts` |
| T-7 | 76 T-7: native radios preserve false selected and checked states | `src/utils/selectionAria.test.ts` |
| T-8 | 76 T-8: current native buttons preserve selected state | `src/utils/selectionAria.test.ts` |
| T-9 | 76 T-9: nested opening tags retain source order and do not leak into parent ownText | `scripts/a11yAriaStateGuard.test.ts` |
| T-10 | 76 T-10: nested tags with arrow functions and object braces keep their exact endpoints | `scripts/a11yAriaStateGuard.test.ts` |
| T-11 | 76 T-11: a nested selected button reports R-2 on its own source line | `scripts/a11yAriaStateGuard.test.ts` |
| T-12 | 76 T-12: a literal tab role may keep direct selected state | `scripts/a11yAriaStateGuard.test.ts` |
| T-13 | 76 T-13: selected state is rejected for buttons, roleless views and dynamic roles | `scripts/a11yAriaStateGuard.test.ts` |
| T-14 | 76 T-14: selection helper spreads and existing disabled state have no violation | `scripts/a11yAriaStateGuard.test.ts` |

기존 테스트 변경은 다음 9개뿐이며, 허용 목록과 독립 대조했다.

- `75 T-1~T-4`: 결과에 `ownText === text` 기대 필드만 추가.
- `75 T-8~T-10`: 기대를 R-2 1건으로 강화하고 이름 끝에 ` (docs/76: R-2 replaced)` 추가.
- `75 T-11`: 라디오 두 입력 모두 R-2 1건으로 강화.
- `75 T-14`: 동적 role의 직접 selected를 R-2 1건으로 강화.
- `75 T-5/6/7/12/13/15/16`과 기존 preamble/저장소 읽기 방식은 그대로. T-16 뒤 신규 테스트 구분용 빈 줄 외 변경 없음. 다른 기존 테스트 파일은 변경하지 않았다.

### 5. 교체 34곳 / Platform import 추가

| 파일:실제 줄 | role 인자·예외 |
|-------------|----------------|
| `app/_layout.tsx:203` | `"button"` · current: true |
| `app/search.tsx:695` | `"button"` |
| `app/search.tsx:896` | `"button"` |
| `app/search.tsx:916` | `"button"` |
| `app/(tabs)/library.tsx:436` | `"button"` |
| `app/(tabs)/library.tsx:483` | `"button"` |
| `app/(tabs)/library.tsx:515` | `"button"` |
| `app/(tabs)/library.tsx:585` | `"button"` |
| `app/(tabs)/library.tsx:639` | `"button"` |
| `app/(tabs)/library.tsx:650` | `"button"` |
| `app/library/photo-import.tsx:239` | `"button"` |
| `app/library/photo-import.tsx:272` | `"button"` |
| `app/people/[id].tsx:797` | `"button"` |
| `src/components/common/GenreFilterChips.tsx:71` | `"button"` |
| `src/components/common/SegmentedControl.tsx:28` | `"button"` |
| `src/components/common/YearSelect.tsx:62` | `"button"` |
| `src/components/content/CastSection.tsx:13` | `"button"` |
| `src/components/content/ContentSearchBar.tsx:377` | `"button"` |
| `src/components/content/ContentSearchBar.tsx:404` | `"button"` |
| `src/components/content/EpisodeProgressCard.tsx:219` | `"button"` |
| `src/components/content/EpisodeProgressCard.tsx:254` | `"radio"` |
| `src/components/content/PopularRecommendationSection.tsx:168` | `"button"` |
| `src/components/content/SeasonSelector.tsx:79` | `"button"` |
| `src/components/content/WatchProviderList.tsx:89` | `"button"` |
| `src/components/content/WatchStatusControl.tsx:14` | `"button"` |
| `src/components/content/WatchStatusControl.tsx:20` | `"button"` |
| `src/components/library/LibraryFilterBottomSheet.tsx:234` | `"button"` |
| `src/components/library/LibraryStatusFilter.tsx:63` | `"button"` |
| `src/components/pins/PinComposer.tsx:305` | `"button"` |
| `src/components/pins/PinDetailPanel.tsx:116` | `"plain"` |
| `src/components/pins/PinFilterPanel.tsx:21` | `"button"` |
| `src/components/pins/PinListCard.tsx:31` | `"button"` · 조건부 스프레드 |
| `src/components/pins/PinViewToggle.tsx:24` | `"button"` |
| `src/components/pins/TagChip.tsx:22` | `onPress ? "button" : "plain"` |

`Platform`을 기존 react-native import에 추가한 파일은 18개다. 나머지 5개 파일은 기존 import를 재사용했다. helper import는 23개 파일에 추가했다.

- `app/people/[id].tsx`
- `src/components/common/GenreFilterChips.tsx`
- `src/components/common/SegmentedControl.tsx`
- `src/components/common/YearSelect.tsx`
- `src/components/content/CastSection.tsx`
- `src/components/content/ContentSearchBar.tsx`
- `src/components/content/EpisodeProgressCard.tsx`
- `src/components/content/PopularRecommendationSection.tsx`
- `src/components/content/SeasonSelector.tsx`
- `src/components/content/WatchProviderList.tsx`
- `src/components/content/WatchStatusControl.tsx`
- `src/components/library/LibraryFilterBottomSheet.tsx`
- `src/components/library/LibraryStatusFilter.tsx`
- `src/components/pins/PinDetailPanel.tsx`
- `src/components/pins/PinFilterPanel.tsx`
- `src/components/pins/PinListCard.tsx`
- `src/components/pins/PinViewToggle.tsx`
- `src/components/pins/TagChip.tsx`

`ContentSearchBar`의 checkbox 속성 사이 빈 줄 하나(F-4)만 제거했다. checkbox/switch의 기존 checked, disabled/busy/expanded/current는 그대로다. TagChip의 `onPress ? "button" : undefined` role도 그대로 유지했다. `/tmp/scenenote-76-{app-report,shared-report,content-report,ast-report}.json`에 상세 근거가 있다.

### 6. 설계 결정 / UI 규칙 / 미충족 완료 조건

- **D-1~D-6의 변경 필요사항 또는 충돌 없음.** non-web에서 기존 selected와 라디오 checked를 유지하고, web만 역할별 속성을 반환한다. 함수는 RN을 import하지 않는다. 중첩 태그는 각각 자기 `ownText`로 판정한다.
- `docs/00_ui_style_rules.md` UI-4.4의 지정 문장 하나만 명세 8.2 그대로 바꿨다. 다른 규칙·AGENTS·문서 목차·명세 74/75/76은 시작 내용 그대로다.
- **전체 파일 UI-13.2 grep 0줄 조건은 미충족이다.** 시작 때부터 이번 대상 23개 화면/컴포넌트에 토큰 위반 212줄과 `Alert.alert` 5줄, 합계 **217줄**이 있었고 수정 후에도 같다. 기존 스타일/Alert 동작은 AST 비교로 동일함을 확인했다. 새 스타일/Alert 변경은 0이며 D-6 및 범위 밖 금지에 따라 기존 항목을 고치지 않았다. 기존 인라인 스타일과 같은 줄의 선택 속성이 바뀐 경우는 줄 diff에 잡힐 수 있으나 스타일 자체는 그대로다. `/tmp/scenenote-76-{preexisting-ui,scope-report}.json`.
- 변경 범위는 명세 11장의 총 29파일(새 2개·기존 27개)뿐이다. 관련 검사기 테스트 외 기존 테스트, DB/Edge, 서비스/훅, 사용자 기록은 변경하지 않았다. 기존 docs/74·75 및 사용자 변경을 보존했다.

### 7. 수동 확인 M-1~M-5 / 사람이 할 후속 작업

| ID | 플랫폼 | 결과·사유와 자동 근거의 한계 |
|----|--------|------------------------------|
| M-1 | 웹 | **미실행.** 로그인 화면·브라우저를 조작하지 않았다. 정적 검사 0 및 실제 일부 컴포넌트 DOM에서 금지 selected 0은 확인했지만 `/library`·`/search`·`/pins`·상세 전체 페이지는 미확인이다. |
| M-2 | 웹 | **미실행.** 실제 클릭 이벤트를 실행하지 않았다. 실제 칩의 true/false 제어 속성별 DOM 스냅샷은 통과했으며 실제 이벤트 전환·낭독은 미확인이다. |
| M-3 | 웹 | **미실행.** 실제 하단 탭·회차 라디오를 조작하지 않았다. 호출부 AST current 예외·기존 current 식 보존과 RN-web DOM의 current/checked는 확인했지만 페이지 탐색은 미확인이다. |
| M-4 | 웹 375·1440 | **미실행.** 시청 환경을 보존하려고 브라우저를 열지 않았다. AST상 스타일·구조는 같지만 실제 배치 비교는 미확인이다. |
| M-5 | iOS 세로 | **미실행.** 기기·시뮬레이터·VoiceOver/Inspector를 실행하지 않았다. 순수 함수의 non-web 계약과 설치 RN의 selected/checked 병합 근거는 확인했지만 실제 낭독은 미확인이다. |

사람이 로그인된 웹에서 M-1~M-4와 iOS에서 M-5를 확인해야 한다. Android 실제 낭독도 미실행이다. 기존 토큰/Alert를 정리하는 작업은 이번의 스타일·동작 보존 범위와 별개다. 운영 DB/Edge 변경이나 배포는 필요 없고 실행하지 않았다.

### 웹 실제 화면 확인 (Claude, 2026-11-18)

로그인된 웹 8081(내장 브라우저, 폭 775px)에서 확인했다. 재실행 결과: `npm test` 1,832 통과, typecheck·lint 통과, `app`·`src`의 직접 `aria-selected`는 `app/people/[id].tsx:535`(tab) 1곳뿐.

| ID | 결과 |
|----|------|
| M-1 | ✓ `/library`(이전 22건)·`/search`·`/pins`·작품 상세·인물 상세 모두 tab/option 외 `aria-selected` 0. 콘솔 오류 0 |
| M-2 | ✓ 라이브러리 "보는 중" 클릭 시 `aria-pressed` 전체 true→false, 보는 중 false→true |
| M-3 | ✓ 사이드 내비 현재 항목 `aria-current="page"`, `aria-pressed`·`aria-selected` 없음. 회차 라디오 12개 `aria-checked="false"` 출력(운영 DB 진행 저장을 피하려고 눌러 바꾸지는 않음). 인물 상세 탭(전체·봤어요·내 작품)은 `aria-selected` 유지 |
| M-4 | 부분 ✓ 775px에서 라이브러리 모양 이상 없음. 375·1440 비교는 미실행(변경이 속성만이라 스타일 영향 없음) |
| M-5 | 미실행(iOS) |

후속 검토 1건: 출연진 카드(`CastSection`)는 누르면 인물 상세로 이동하는 버튼인데, 등록된 인물이면 `aria-pressed="true"`가 붙어 웹 낭독기가 "전환 버튼, 눌림"으로 읽는다. 누를 때 등록이 바뀌지 않으므로 전환 버튼이 아니다. 라벨에 이미 ", 등록됨"이 있으니 `plain`(웹 속성 없음)이 맞다. 명세 76이 이 곳을 button으로 지정했기 때문에 생긴 문제이고, 구현은 명세대로 됐다.


## 웹 접근성 상태 aria-* 정정 (docs/75, 2026-11-18)

- 상태: **코드 검사 통과, 화면 미확인.** [75](75_web_aria_state_fixes_spec.md) 14장의 STEP1→속성 변환→웹 의미 보충→UI 규칙→검증 순서로 진행했다. 시작 root는 `/Users/youngilkim/SceneNote`, `main` `519ddc7`+docs/74 미커밋 변경이다. `/tmp/scenenote-75-start-{snapshot.json,status.txt}`로 시작 소스/사용자 문서를 보존했다. `scenenote-verify`와 Node24를 명령에만 적용했다. 브라우저·기기·서버·운영 DB/Edge/secret·의존성·커밋/푸시는 변경하지 않았다.
- D-1~D-6은 유지했다. 45개 파일의 R-1 **100개 줄**을 모두 정정했다. 실제 상태 객체는101개(한 줄에2개인 `SimilarContentQuickViewModal` 포함), 상태 키 항목139개다. 기존 키의 값은 그대로 유지하고 선택 버튼에 pressed25곳, 라디오에 checked1곳만 보충했다. 재발 검사는 `scripts/a11yAriaStateGuard.ts`·`.test.ts` 두 새 파일에 있다.

### 1. STEP 1 T-16 실제 실패

- 시작 `npm test` **1802/1802**: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ssonz6av/{test.log,summary.json}`.
- 검사기와 T-1~T-16만 먼저 작성한 전체 실행은 **1818개 중1817 통과·1 실패**. T-1~T-15와 기존1802개는 통과하고 **T-16만 R-1 정확히100건**, R-2/R-3은0이었다. 명세의100건과 같음을 확인한 뒤 화면을 수정했다. 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-cutk_80t/{test.log,summary.json}`, 건수/목록 보존 `/tmp/scenenote-75-red-proof.json`.

실제 실패 출력(건수와 앞10개 위치):

```text
  AssertionError [ERR_ASSERTION]: ARIA state violations: 100
  app/(auth)/forgot-password.tsx:70 R-1 accessibilityState={{ disabled: formState.isSubmitting || requestPasswordReset.isPending, busy: formState.isSubmitting |
  app/(auth)/reset-password.tsx:100 R-1 accessibilityState={{ disabled: formState.isSubmitting || updatePassword.isPending, busy: formState.isSubmitting || upda
  app/(auth)/sign-in.tsx:91 R-1 accessibilityState={{ disabled: formState.isSubmitting || signIn.isPending, busy: formState.isSubmitting || signIn.isPen
  app/(auth)/sign-up.tsx:109 R-1 accessibilityState={{ disabled: formState.isSubmitting || signUp.isPending, busy: formState.isSubmitting || signUp.isPen
  app/(tabs)/library.tsx:435 R-1 accessibilityState={{ selected }}
  app/(tabs)/library.tsx:447 R-1 accessibilityState={{ expanded: showFilters }}
  app/(tabs)/library.tsx:483 R-1 accessibilityState={{ selected }}
  app/(tabs)/library.tsx:515 R-1 accessibilityState={{ selected }}
  app/(tabs)/library.tsx:532 R-1 accessibilityState={{ expanded: showFilters }}
  app/(tabs)/library.tsx:585 R-1 accessibilityState={{ selected }}
```

### 2. npm test before / after

- **1802/1802 →1818/1818**, 신규16개·실패0·skip0. 기존 테스트 파일/단언 변경0. 최종 `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-q06pwehg/test.log`.
- `grep -rn "accessibilityState" app src` **출력0줄**(일치 없음 exit1). T-16의 최종 R-1/R-2/R-3 위반0.
- 별도 AST 검증은 실제45파일의101상태 그룹·139키 값이 정확히 이동했는지, 기존 중복8키가 같은 값인지, JSX 구조/역할/라벨/hint/liveRegion/스타일/로직이 유지됐는지 검사해 통과했다. 신규 pressed25/checked1과 조건 스프레드도 검증했다. `/tmp/scenenote-75-ast-{verify.cjs,verify.log,report.json}`. 처음 작성한 ad-hoc 비교기의 중첩 JSX 속성 정규화/SourceFile 경계를 고친 뒤 실행했으며 앱이나 기존 단언을 변경한 것은 아니다.

### 3. typecheck / lint / build

- 최종 `npm run typecheck`, `npm run lint` **exit0·오류0·경고0**. `scenenote-verify-q06pwehg/{typecheck.log,lint.log,summary.json}`.
- 첫 타입 검사에서는 새 ARIA 속성 오류가 아니라 Node `readdirSync`의 `string|Buffer` 추론4건이 나왔다. T-16의 옵션에 기존 기본값과 같은 **`encoding: "utf8"`**을 명시해 문자열 overload를 선택했다. 타입 단언·any·검사 완화는 추가하지 않았다. 최종 테스트/타입/린트를 다시 통과했다. 최초 로그 `scenenote-verify-2erf4qdt/typecheck.log`.
- 웹 `npm run build` export **exit0**: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-2erf4qdt/build.log`. 이후 앱 코드는 바꾸지 않았고 T-16의 encoding 명시와 문서만 정정했다.
- 설치된 실제 RN-web0.21.2 + ReactDOMServer 격리 검증 **27개 통과**. 실제 설정·SegmentedControl·SeasonSelector·LoadingSkeleton의 DOM을 직렬화해 checkbox10개와 true/false, selected+pressed, expanded=false, busy/disabled, current-page 예외, undefined 생략을 확인했다. 기존 grouped state의 웹 DOM 누락도 재현했다. 훅/라우터/아이콘/safearea 경계만 모의로 치환했고 네트워크·브라우저0이다. 실제 이벤트 전환·낭독·시각 QA와는 구분한다. `/tmp/scenenote-75-dom-ssr-{fixture.mjs,final.log,report.json}`. 최종 소스 해시 일치.

### 4. 추가 테스트 ID와 이름

모두 `scripts/a11yAriaStateGuard.test.ts`에 있다. 검사기는 RN/Supabase 모듈을 가져오지 않는 순수 문자열 함수, 저장소 테스트는 node:fs만 읽는다.

| ID | 실제 이름 |
|----|-----------|
| T-1 | 75 T-1: finds an opening tag and its first line |
| T-2 | 75 T-2: arrow functions and comparisons inside braces do not end a tag |
| T-3 | 75 T-3: quoted and template text may contain greater-than characters |
| T-4 | 75 T-4: skips comparisons and closing tags while keeping multiline start lines |
| T-5 | 75 T-5: reports the source line of multiline accessibilityState |
| T-6 | 75 T-6: finds object keys and comments outside JSX once per source line |
| T-7 | 75 T-7: selected buttons need a pressed or current attribute |
| T-8 | 75 T-8: a selected button with pressed state has no violation |
| T-9 | 75 T-9: conditional spread state names satisfy the button guard |
| T-10 | 75 T-10: aria-current exempts the selected button from pressed state |
| T-11 | 75 T-11: selected radios require matching checked state |
| T-12 | 75 T-12: selected tabs already have the intended web state |
| T-13 | 75 T-13: recognizes single-quoted role attributes |
| T-14 | 75 T-14: dynamic roles are not guessed by the static guard |
| T-15 | 75 T-15: diagnostics retain the file and trim snippets to at most 120 characters |
| T-16 | 75 T-16: app and src have no obsolete or incomplete ARIA state props |

### 5. 보충 위치 / E-9 / E-2

신규 `aria-pressed`25곳과 `aria-checked`1곳의 실제 속성 줄이다. 기존 값 표현식과 동일하며 역할·라벨은 바꾸지 않았다.

| 속성 | 위치 |
|------|------|
| `aria-pressed` | `app/(tabs)/library.tsx:484` |
| `aria-pressed` | `app/(tabs)/library.tsx:517` |
| `aria-pressed` | `app/(tabs)/library.tsx:588` |
| `aria-pressed` | `app/(tabs)/library.tsx:643` |
| `aria-pressed` | `app/(tabs)/library.tsx:655` |
| `aria-pressed` | `app/library/photo-import.tsx:239` |
| `aria-pressed` | `app/library/photo-import.tsx:273` |
| `aria-pressed` | `app/people/[id].tsx:796` |
| `aria-pressed` | `app/search.tsx:695` |
| `aria-pressed` | `src/components/common/GenreFilterChips.tsx:70` |
| `aria-pressed` | `src/components/common/SegmentedControl.tsx:27` |
| `aria-pressed` | `src/components/common/YearSelect.tsx:61` |
| `aria-pressed` | `src/components/content/CastSection.tsx:12` |
| `aria-pressed` | `src/components/content/ContentSearchBar.tsx:377` |
| `aria-pressed` | `src/components/content/ContentSearchBar.tsx:404` |
| `aria-pressed` | `src/components/content/EpisodeProgressCard.tsx:217` |
| `aria-pressed` | `src/components/content/PopularRecommendationSection.tsx:167` |
| `aria-pressed` | `src/components/content/SeasonSelector.tsx:78` |
| `aria-pressed` | `src/components/content/WatchProviderList.tsx:88` |
| `aria-pressed` | `src/components/content/WatchStatusControl.tsx:13` |
| `aria-pressed` | `src/components/content/WatchStatusControl.tsx:19` |
| `aria-pressed` | `src/components/pins/PinComposer.tsx:304` |
| `aria-pressed` | `src/components/pins/PinFilterPanel.tsx:20` |
| `aria-pressed` | `src/components/pins/PinListCard.tsx:30` (기존 조건 스프레드 안) |
| `aria-pressed` | `src/components/pins/PinViewToggle.tsx:23` |
| `aria-checked` | `src/components/content/EpisodeProgressCard.tsx:252` |

- **E-9 1곳:** `src/components/pins/TagChip.tsx:20`의 `accessibilityRole={onPress ? "button" : undefined}`를 그대로 유지했다. selected/disabled는 D-2로 옮겼지만, 역할을 추측해 pressed를 보충하지 않았다. 동적 `Container`와 `onPress={disabled ? undefined : onPress}`의 기존 동작도 보존했다. 이 분기의 실제 웹 역할/비활성·선택 낭독은 수동 확인 대상이다.
- **E-2 충돌0:** 같은 의미의 기존 ARIA가 있던8키를 대조해 모두 동일했다. 인증4개 화면의 busy, LoadingSkeleton busy, ContentSearchBar checked/disabled, RecommendationExclusionSheet checked는 기존 속성만 유지하고 중복 추가하지 않았다. 값 불일치로 중단한 곳은 없다.
- 기존 pressed5곳(`app/search.tsx`2, `app/(tabs)/library.tsx`1, LibraryFilterBottomSheet1, LibraryStatusFilter1)과 하단 탭의 current-page1곳은 그대로다. radio는 selected를 유지하면서 checked만 보충했다.
- 전체 근거: `/tmp/scenenote-75-{inventory,app-report,shared-report,content-report,positions,ast-report}.json`.

### 6. 설계 결정과 UI 규칙 / 완료 조건의 한계

- **D-1~D-6 변경 또는 변경 필요사항 없음.** `docs/00_ui_style_rules.md`의 UI-4.4·4.7·13.2·15 해당4문장을 명세8.1 그대로 반영했다(명세의 Markdown 중첩 코드 이스케이프를 해제한 문장과 일치). 다른 규칙/과거 명세는 바꾸지 않았다.
- **명세 DoD의 전체파일 UI-13.2 결과0줄 조건은 미충족이다.** 시작 시 대상45파일에 이미 색·글꼴320줄과 `Alert.alert`7줄, 합계327줄이 있었다. 이후에도 **320/7로 동일**, 이번 추가 위반은0이며 해당 기존 줄의 내용도 바꾸지 않았다. D-4의 스타일·문구·동작 변경 금지와 범위 밖 “김에 고치기” 금지를 지키기 위해 기존 위반을 정리하지 않았다. 이 결과를 전체 검사0이라고 보고하지 않는다.
- 기존 Alert7곳: `app/(tabs)/pins.tsx`2, `app/library/photo-import.tsx`4, `src/components/content/PopularRecommendationSection.tsx`1. 기존 토큰/Alert 목록과 추가줄 검사 `/tmp/scenenote-75-{preexisting-ui,ui-scope-report}.json`.
- 소스 수정은 명세11장의45파일, 새 검사기2파일, 문서2파일뿐이다. 기존 docs/74 작업과 사용자의 AGENTS/목차/명세75는 보존했다. 기존 테스트 파일 변경0, DB/Edge/의존성 변경0. `git diff --check` 통과.

### 7. 수동 확인 M-1~M-7 / 후속 작업

| ID | 플랫폼 | 실행 여부·사유 / 별도 근거 |
|----|--------|----------------------------|
| M-1 | 웹 | **미실행.** 사용자 브라우저·로그인 세션을 조작하지 않았다. 실제 설정 컴포넌트 SSR은 체크박스10개와 선택 true/false를 확인했으나 로그인된 실제 페이지/클릭은 미확인이다. |
| M-2 | 웹 | **미실행.** 브라우저를 열지 않았다. 실제 SegmentedControl SSR의 selected+pressed, 전체 저장소 정적 R-2/R-3 위반0을 확인했지만 /search 이벤트 전환은 미확인이다. |
| M-3 | 웹 | **미실행.** 현재 탭/시즌을 실제 조작하지 않았다. current 예외 소스 보존·SSR current만 출력·SeasonSelector 초기 expanded=false는 확인했으나 펼침 이벤트는 미확인이다. |
| M-4 | 웹 | **미실행.** 브라우저 클릭을 하지 않았다. 실제 스켈레톤 busy와 RN-web disabled/busy DOM, tabIndex=-1은 SSR 확인. 실제 눌림 차단은 미확인이다. |
| M-5 | 웹375·1440 | **미실행.** 화면을 열지 않아 실제 배치/시각 비교를 하지 않았다. 45파일 AST의 스타일·레이아웃·라벨·구조 원형은 확인했다. |
| M-6 | iOS 세로 | **미실행.** 시뮬레이터·VoiceOver·Inspector를 실행하지 않았다. 설치 RN Pressable/View의 ARIA→기존 상태 병합 코드와139개 기존 키의 표현식 동치는 확인했지만 실제 낭독은 미확인이다. |
| M-7 | iOS 세로 | **미실행.** 기기·Inspector를 실행하지 않았다. disabled prop을 그대로 보존했지만 실제 “흐리게 표시됨” 낭독·터치 차단은 미확인이다. |

Android 실기기/낭독도 미실행이다. 로그인된 웹에서 M-1~M-5, iOS에서 M-6~M-7과 E-9의 동적 TagChip을 사람이 확인해야 한다. 기존 토큰/Alert를0으로 만드는 작업에는 이번 D-4와 별개 범위 결정이 필요하다. DB migration·Edge 배포는 필요 없고 실행하지 않았다. 이번 세션에서 브라우저·시청 앱·개발 서버를 열거나 종료하지 않았다.

### 웹 실제 화면 확인 (Claude, 2026-11-18)

로그인된 앱 내 브라우저, 로컬 8081(운영 Supabase)에서 DOM 속성으로 확인했다. 시험 중 바꾼 구독 값은 원래(미설정)로 되돌렸다.

| ID | 결과 | 확인 내용 |
|----|------|-----------|
| M-1 | **통과** | `/settings/subscribed-otts` checkbox 10개 모두 `aria-checked`. 넷플릭스 클릭 시 `"true"`, 다시 클릭 시 `"false"` |
| M-2 | **통과(단서)** | `/search` 보기 전환 "갤러리" `aria-selected="true"`+`aria-pressed="true"`. `/search`에서 `[role=button][aria-selected]:not([aria-pressed]):not([aria-current])` 0개. 단 `/library`에서는 하단 탭의 현재가 아닌 5개(`aria-current` 없음, `aria-selected="false"`)가 이 조회에 걸린다 — 명세 E-4 예외의 의도된 결과이며 결함 아님 |
| M-3 | **통과** | 하단 탭 현재 "라이브러리로 이동" `aria-current="page"`+`aria-selected="true"`, `aria-pressed` 없음. 라이브러리 "필터" `aria-expanded` `false→true` |
| M-4 | **통과(속성)** | `/search`에 `aria-busy` 4개·`aria-disabled="true"` 1개 출력. 비활성 버튼 터치 차단은 기존 `disabled` 속성 유지로 변화 없음 |
| M-5 | 미실행 | 속성만 바뀌어 배치 영향은 없다고 보고 시각 비교는 하지 않음 |
| M-6·M-7 | 미실행 | iOS 시뮬레이터 미실행 |

콘솔 경고·오류 0건. 보완 후보: ① `role="button"`의 `aria-selected`는 ARIA 규격상 허용되지 않는 속성이다(`/library` 22개, axe `aria-allowed-attr` 대상). 낭독기는 무시하고 `aria-pressed`가 상태를 전달하므로 동작 문제는 없다(명세 D-3의 앱 동일성 결정에 따른 결과). ② E-9 `TagChip`은 `onPress`+`selected`로 쓰면 웹에 `aria-pressed`가 없다. 현재 사용처 3곳(`app/pins/[id].tsx:75`, `PinTimelineItem.tsx:70`, `PinComposer.tsx:280`)은 모두 `onPress`·`selected`를 넘기지 않아 실제 영향은 없다. ③ `ContentSearchBar.tsx:68` JSX 속성 사이 빈 줄, 여러 파일에서 `aria-*` 여러 개를 한 줄에 둔 서식 불일치(동작 무관).

## 내 구독 OTT (docs/74, 2026-11-17)

- 상태: **구현·자동 검사 통과. 사용자 승인 후 운영 DB 적용·로컬 웹8081 반영 완료, 웹 화면 검증 완료(11절, 2026-11-18). iOS·Android·M-8 미확인.** [74](74_subscribed_ott_spec.md) 전체와 D-1~D-12를 따라 프로필의 구독 설정, 보러가기 우선 표시/초기 탭, 작품 상세 히어로의 시청 행동만 구현했다. 확인된 구독 제공처가 없을 때 애니의 라프텔은 “찾기”로만 연결한다. 검색·추천·홈·시청 제공처 조회 정책·Edge는 그대로다. 구현 검증 중에는 브라우저·앱·Expo 서버를 실행하거나 조작하지 않았다. 후속 “적용되게 전체 적용해줘” 요청으로 아래 운영 migration과 로컬 서버를 반영했다. 사용자 구독 값·감상 기록·secret·Edge·커밋/푸시는 변경하지 않았다.
- 시작: root `/Users/youngilkim/SceneNote`, `main` `519ddc7`. 시작 변경은 사용자 편집 `AGENTS.md`·`docs/README.md`와 미추적 명세74였다. `/tmp/scenenote-74-start-{snapshot.json,status.txt}`로 시작 상태를 기록하고 해당 변경을 보존했다. `scenenote-verify`와 Node24를 사용했으며 의존성·전역 런타임/환경 파일은 변경하지 않았다.

### 1. STEP 1 실제 실패 출력

- 기준선 **1769/1769**: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-z460h6q0/{test.log,summary.json}`.
- 테스트만 먼저 작성한 전체 실행은 **1802개 중1769 통과·33 실패**였다. 신규 T-1~T-33 모두 모듈 없음으로 각각 실패했고 기존 테스트는 전부 통과했다. 각 테스트 본문에서 dynamic import하여 파일 전체 실패 1개로 축약하지 않았다. `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-tmg4az2w/{test.log,summary.json}`, `/tmp/scenenote-74-red-coverage.json`.

대표 실제 출력(세 테스트 모두 `ERR_MODULE_NOT_FOUND`):

```text
✖ 74 T-1: non-array saved values normalize to an empty subscription
✖ 74 T-16: an actionable subscribed provider supplies the existing link and Korean label
✖ 74 T-32: rapid choices coalesce into the first save and one latest-value save
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/youngilkim/SceneNote/src/utils/subscribedOtt' imported from /Users/youngilkim/SceneNote/src/utils/subscribedOtt.test.ts
```

### 2. 테스트 before / after

- **1769/1769 →1802/1802**, 신규33·실패0·skip0. 기존 테스트 파일 변경0. 명세의 모든 다중 입력·안정 정렬/새 배열·연속3토글 저장2회 사례를 포함했다.
- 최종 전체 검사 로그: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ze72fwti/test.log`, 같은 폴더 `summary.json`.
- 추가 격리 실행(테스트 개수에 합산하지 않음): 실제 service/hook + 설치 QueryCore **60개**, 실제 설정/계정 행/WatchNowButton 렌더 **30개**, 실제 WatchProviderList **44개** 통과. 다중 observer의 단일 저장 큐·마지막 값 병합, 첫/둘째 저장 실패 rollback·한국어 토스트, 세션 대기 중/응답 뒤 계정 변경·cache.clear 방어, 조회 실패 시 캐시가 있어도 groups[], 플래그false/로그아웃 조회·명시refetch·저장0을 확인했다. 원본/현재 WatchProviderList의 기본 속성 **8상태**는 스타일·텍스트·접근성을 포함한 렌더 결과가 동일했다. 각 fixture는 React/RN/SDK 경계를 모의로 격리했고 네트워크0이다. 실제 화면·실기기·운영 저장 증거가 아니다.
- 증거: `/tmp/scenenote-74-{storage,ui,watchproviders}-report.json` 및 같은 이름의 `*-fixture.mjs`/로그. 보고서의 소스 해시가 최종 파일과 일치한다.

### 3. 타입·린트·빌드 / SQL

- 전체 `npm run lint`와 웹 `npm run build` **exit0**. 위 `ze72fwti` 폴더의 `lint.log`, `build.log`. 웹 export는 성공했고 기존 Expo 강제 종료 안내가 있었으며 브라우저/서버를 띄우지 않았다.
- 최초 `typecheck`는 새 설정 경로가 기존 `.expo/types/router.d.ts`에 없어 TS2345 두 건으로 실패했다. 설치된 Expo Router의 실제 `regenerateDeclarations`를 서버 없이 실행해 생성 타입만 갱신했다. 앱에 캐스트/타입 우회를 추가하지 않았다. 이후 `npm run typecheck` **exit0**: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-pngo4f0f/{typecheck.log,summary.json}`. `.expo`는 생성 산출물이며 추적 구현 파일을 추가하지 않았다.
- SQL은 CLI2.75의 `migration new profile_subscribed_otts`로 만든 새 파일을 명세의 `20261117062800_profile_subscribed_otts.sql` 이름에 맞춘 뒤 7장 전문을 그대로 기록했다. **구현 검증 시에는 운영 적용하지 않았고, 이후 사용자 승인으로 아래 9절에서 적용했다.** 임시 PGlite PostgreSQL에서 운영과 같은0001~0022+정합성3개 기반으로 새 SQL **20개** 검증 통과: 기존 프로필/이름/검색필터 보존, 기존/신규 계정 빈 기본값, 소유자 조회/upsert, 타인 쓰기 거절, anon 비공개, 기존 RLS/정책 불변, 20개 허용/21개 거절/null 거절, 미래 키 DB 허용. 실제 Supabase/PostgREST를 대신하지 않는다. `/tmp/scenenote-74-sql-{fixture.mjs,fixture.log,report.json}`.

### 4. 추가 테스트 ID와 이름

이름은 `src/utils/subscribedOtt.test.ts`의 실제 이름이다.

| ID | 이름 |
|----|------|
| T-1 | 74 T-1: non-array saved values normalize to an empty subscription |
| T-2 | 74 T-2: saved values are trimmed, lowercased, deduplicated and validated |
| T-3 | 74 T-3: subscriptions use the catalog order with Laftel last |
| T-4 | 74 T-4: the ten service groups retain their names, order and matching contract |
| T-5 | 74 T-5: toggling adds or removes a known group and ignores unknown groups |
| T-6 | 74 T-6: provider ids resolve advertising variants and reject unknown ids |
| T-7 | 74 T-7: subscribed services match flatrate and free provider variants |
| T-8 | 74 T-8: rental and purchase do not count as subscribed availability |
| T-9 | 74 T-9: subscription sorting is stable within both groups and does not mutate input |
| T-10 | 74 T-10: rental and unset subscriptions preserve order in a fresh array |
| T-11 | 74 T-11: a subscribed free provider wins over unrelated flatrate providers |
| T-12 | 74 T-12: a subscribed flatrate provider wins over a subscribed free provider |
| T-13 | 74 T-13: unavailable subscriptions retain the existing rental fallback |
| T-14 | 74 T-14: a rental listing cannot select a subscribed provider tab |
| T-15 | 74 T-15: no providers or no subscriptions produce no watch action |
| T-16 | 74 T-16: an actionable subscribed provider supplies the existing link and Korean label |
| T-17 | 74 T-17: missing or malformed links skip candidates and allow a later free service |
| T-18 | 74 T-18: a Disney home link is labeled as opening the service |
| T-19 | 74 T-19: subscribed rental providers do not produce a watch action |
| T-20 | 74 T-20: unavailable matchable subscriptions get a qualified availability note |
| T-21 | 74 T-21: Laftel-only, unset and empty provider results do not assert unavailability |
| T-22 | 74 T-22: an empty subscription summary says unset |
| T-23 | 74 T-23: summaries use catalog order and count services after the first two |
| T-24 | 74 T-24: the summary includes the unmatchable Laftel subscription |
| T-25 | 74 T-25: Laftel uses only the separate search action |
| T-26 | 74 T-26: confirmed subscribed availability wins over Laftel search |
| T-27 | 74 T-27: a Laftel action needs both the subscription and a nonempty anime search URL |
| T-28 | 74 T-28: unrelated providers do not suppress the subscribed Laftel search |
| T-29 | 74 T-29: a pending save prevents another write |
| T-30 | 74 T-30: normalized equal saved and desired sets need no write |
| T-31 | 74 T-31: a changed desired set writes only normalized known groups |
| T-32 | 74 T-32: rapid choices coalesce into the first save and one latest-value save |
| T-33 | 74 T-33: save states use fixed Korean status text |

### 5. UI-13.2와 범위 확인

- 명세의 네 파일 대상 색·글꼴 grep **출력0줄**(일치 없음 exit1), `Alert.alert` grep **출력0줄**. 작품 상세·프로필은 시작 snapshot 대비 추가 줄만 검사해 위반0.
- 명세의 `git status --short supabase/functions app/search.tsx "app/(tabs)/index.tsx" src/components/home src/utils/recommendationPresentation.ts src/utils/watchProviderDisplay.ts src/utils/watchProviderLookup.ts src/hooks/useWatchProviders.ts src/services/profile.ts`는 **출력0줄**. `getProfile` 파일·기존 테스트 파일은 시작 SHA와 같다. `/tmp/scenenote-74-source-audit.json`.
- `git diff --check` 통과. 허용 파일만 구현했고 AGENTS의 사용자 편집은 추가로 고치지 않았다. 프로필 통계 select에 새 칼럼을 넣지 않았다. 새 migration은 명세7장과 전문 일치한다.

### 6. 수동 확인 M-1~M-12

아래는 구현 검증 당시의 결과다. 이후 DB 적용과 로컬 서버 반영을 마쳐도 로그인된 화면·실기기 수동 검증은 실행하지 않았으며, 아래 미실행 상태는 유지한다.

| ID | 플랫폼 | 실행 상태·사유 / 보완 근거 |
|----|--------|---------------------------|
| M-1 | 웹1440 | **화면 미실행.** 운영 migration 미적용, 브라우저/로그인 조작 안 함. 설정 렌더·10칩·직렬 저장은 격리 확인, 실제 저장 유지 미확인. |
| M-2 | 웹1440 | **화면 미실행.** 운영 migration 미적용, 브라우저 안 함. 제공처/링크 선택과 실제 카드 우선 표시 검증, 히어로 클릭/새 탭은 미확인. |
| M-3 | 웹1440 | **화면 미실행.** 운영 migration 미적용. 내 OTT 없음 문구·카드 렌더를 격리 확인, 실제 작품 화면 미확인. |
| M-4 | 웹1440 | **화면 미실행.** 운영 migration 미적용. 기존 시즌 응답 guard와 Laftel-only fallback 유지·렌더 확인, 실제 시즌/라프텔 이동 미확인. |
| M-5 | 웹375 | **화면 미실행.** 브라우저 안 함. 375/768/1440 설정 컨테이너·안전 여백·44터치 스타일은 격리 확인, 실제 넘침/히어로 스크롤 양 미측정. |
| M-6 | 웹1440 | **화면 미실행.** 브라우저 안 함. 새 칼럼 없음·조회 오류의 groups[]와 설정 고정 오류/재시도를 격리 확인, 기존 getProfile 소스 동일. 실제 화면은 미확인. |
| M-7 | 웹1440 | **화면 미실행.** 브라우저/운영 기록 변경 안 함. 첫/둘째 저장 실패에 lastSaved 복구·토스트1회·대기 폐기를 실제 훅 fixture 확인, 실제 오프라인 전환 미확인. |
| M-8 | 웹1440 | **화면 미실행.** 실제 로그아웃/계정 변경 안 함. 세션 대기·cache.clear/이전 응답·다중 observer 계정 격리는 실제 훅/service fixture 확인. |
| M-9 | 웹1440 | **화면 미실행.** 운영 migration 미적용. 준비된 빈 구독의 등록 안내·설정 이동 callback만 카드 fixture 확인. |
| M-10 | 웹1440 | **코드 검사 통과, 화면 미실행.** 검색·추천·홈 파일 변경0, 실제 화면은 브라우저를 열지 않아 미확인. |
| M-11 | iOS 세로 | **미실행.** 실기기/시뮬레이터 실행 안 함, migration 미적용. 실제 홈 인디케이터·글자1.3배·OTT 유니버설 링크 미확인. |
| M-12 | iOS 세로 | **미실행.** 실기기/시뮬레이터 실행 안 함, migration 미적용. 애니에만 Laftel 검색 주소를 전달하는 연결은 코드 확인, 실제 OS 이동 미확인. |

Android 실기기/에뮬레이터도 미실행이며 공유 코드의 타입·스타일/접근성 계약만 확인했다. 수동 시각 검증을 완료로 표시하지 않는다.

### 7. 설계 결정

D-1~D-12 변경 또는 변경 필요사항 **없음**. 저장은 QueryClient+계정+현재 Query 객체별 공유 controller로 직렬화하며 판단은 `nextSubscribedOttWrite`를 사용한다. SDK 세션은 실제 인증을, UI의 시작 계정은 쓰기 문맥 확인만 맡는다. 라프텔은 matchable=false와 찾기 문구를 유지한다. D-8에 따라 첫 조회뿐 아니라 수동 제공처 갱신 중에도 히어로 버튼을 숨긴다.

### 8. 후속 작업 상태

1. 사용자 “적용되게 전체 적용해줘” 승인 후 **운영 DB migration 적용 완료**. 실제 버전 `20261117062800`으로 이번 새 로컬 파일명을 맞췄으며 SQL 전문/SHA256은 변하지 않았다. 0023·0024는 적용하지 않았다.
2. 실제 로그인된 화면 M-1~M-12·Android의 안전 영역·확대·OS 링크 확인은 남아 있다. 브라우저와 시청 앱은 조작하지 않았다.
3. **Edge Function 재배포 불필요, 실행0회.** 로컬 Expo 웹은 아래 9절처럼8081에 반영했다. 별도 운영 웹 호스팅·네이티브 스토어/EAS 연결 설정은 이 저장소에서 확인되지 않아 새 배포 대상을 임의로 만들지 않았다.

### 9. 운영 적용·로컬 앱 반영 (2026-11-17)

- 현재 연결 프로젝트 `pstkeooflscvtaxxrwdf`와 후보 소스/SQL 해시를 확인한 뒤 Supabase 플러그인으로 **`profile_subscribed_otts` 한 개만** 적용했다. 적용 전 칼럼/제약은 없었고 기존 이력은0001~0022+정합성3개였다. 도구가 기록한 운영 버전은 **20261117062800**(KST15:28)이다. 승인 SQL과 운영 `schema_migrations.statements`가 전문 일치한다. SHA256 `693de644dac6d3c0eaf4e49bb8671a901a2cb81cb57edef702745dad53fc5aee`.
- 읽기 전용 운영 사후 검사 **11개 전부 통과**: 이력1개/SQL일치/text[]/NOT NULL/빈 배열 기본값/20개 제한/제약 validated/RLS 켜짐/기존 owner 정책3개 불변/Edge15개 버전·JWT·번들 불변/보안 advisor 전후 동일. 기존 보안 advisor 항목과 링크는 [73 운영 기록](#운영-반영-완료와-남은-설정)에 있다. 새 권한·함수·트리거·secret은 만들지 않았다.
- 실제 PostgREST에 anon 공개 키로 `profiles?select=subscribed_otts&limit=0`를 요청해 **HTTP200·반환 사용자행0**을 확인했다. 새 칼럼이 Data API에 반영됐다는 확인이며 실제 계정의 읽기/저장 성공 검증은 아니다. 사용자 구독/감상/핀 값을 임의로 변경하지 않았다.
- 프런트엔드 대상 확인: `.vercel/project.json`, `.openai/hosting.json`, `eas.json`, GitHub 배포 workflow, EAS projectId가 없었고, 정식 웹 주소도 확인되지 않았다. 기존 실행 경로는 `.vscode/tasks.json`의 로컬 Expo8081이다. 시작 전8081 LISTEN은 없었다.
- 설치된 Expo CLI→better-opn 코드에서 `BROWSER=none`이 브라우저 실행을 건너뛰는 것을 먼저 확인했다. **`PATH=/opt/homebrew/opt/node@24/bin:$PATH BROWSER=none EXPO_NO_TELEMETRY=1 npm run web -- --port 8081 --localhost --clear`**로 로컬 앱 서버만 시작해 계속 실행 중이다. 다른 포트·브라우저·시청 창은 열거나 닫지 않았다. 기존 의존성 버전 안내는 실행 로그에 남았고 이번에 업그레이드하지 않았다.
- headless HTTP 검증: `/status`는 packager running, `/settings/subscribed-otts` **200**, 해당 페이지가 참조하는 현재 앱 번들 **200**. 번들에 “구독 중인 OTT”, `subscribed_otts`, “라프텔에서 찾기”, “구독 OTT 등록”이 포함됐다. JS를 브라우저에서 실행한 화면 확인은 아니다. 실제 사용하는 탭을 새로고침한 뒤 **프로필 → 구독 중인 OTT**에서 설정하면 된다.
- 증거: `/tmp/scenenote-74-{deployment-report,schema-before,schema-after,advisors-before,advisors-after,api-schema-check,live-web}.json`. 코드/SQL 내용은 기존 전체1802개·타입·린트·웹 export·격리 검증 이후 바꾸지 않았으며 이번에는 migration 이름과 적용 기록만 정렬했다. 새 서버는 Node24로 실행하고 전역 설정/환경 파일을 수정하지 않았다.

### 10. 후속 리뷰 — useCallback 의존성 경고 정정 (2026-11-17)

- 리뷰에서 지적한 `src/hooks/useSubscribedOtts.ts:140` 경고를 실제 린트로 재현했다: `React Hook useCallback has a missing dependency: 'query'`(**오류0·경고1**). `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-9_umkab9/lint.log`.
- Query 결과 객체에서 바인딩된 `refetch`를 `refetchQuery`로 분리하고 callback 본문/의존성이 같은 함수 참조를 쓰게 했다. 설치된 QueryObserver의 바인딩 구현을 확인했으며 `enabled` 방어·계정별 키·저장 큐·D-1~D-12는 그대로다. 코드 변경은 이 훅의 해당3줄뿐이고 기존 테스트·화면·서비스·DB·Edge는 변경하지 않았다.
- `scenenote-verify` 재검사: **테스트1802/1802, 타입 통과, 린트 오류0·경고0**. 로그와 실제 명령: `/var/folders/zd/0crxd_2n6hg9wg11kn9b04jw0000gn/T/scenenote-verify-ej4y27bc/{test.log,typecheck.log,lint.log,summary.json}`. 실제 저장 훅/서비스+QueryCore 격리 검증 **60개**도 다시 통과했다(`/tmp/scenenote-74-storage-report.json`, `scenenote-74-storage-lint-followup.log`). 외부 요청0, `git diff --check` 통과.
- 로그인 뒤 화면 M-1~M-12·iOS/Android 실기기는 **여전히 미확인**이다. 이번 후속 작업에서 브라우저·시청 창·서버를 조작하지 않았고 계정에 대신 로그인하거나 기록을 바꾸지 않았다. 이전 웹 export 성공과 실제 화면 검증을 구분한다. (→ 웹 분은 11절에서 확인)

### 11. 웹 실제 화면 검증 (2026-11-18)

사용자가 Claude 앱 내 브라우저 창에서 직접 로그인한 계정으로, 로컬 8081(운영 Supabase 연결)에서 확인했다. 폭은 창 기본 775px과 모바일 375px이다(1440 미측정). 시험 중 바꾼 구독 값은 끝에 **원래 상태(미설정)로 되돌렸다**.

| ID | 결과 | 확인 내용 |
|----|------|-----------|
| M-1 | **통과** | 프로필 "구독 중인 OTT, 미설정" → 설정 화면, 칩 10개. 넷플릭스·티빙 연속 클릭 후 "저장했어요.", 뒤로 가면 "넷플릭스 · 티빙", 새로고침 후 유지 |
| M-2 | **통과** | 오징어 게임 시즌 2: 진입 후 약 2.5초 동안 버튼 없음 → "넷플릭스에서 보기". 누르면 `window.open(넷플릭스 검색 주소, "_blank", "noopener")`. 보러가기 정액제 넷플릭스 + "내 OTT" |
| M-3 | **통과** | 무빙(디즈니+만): 히어로 버튼 없음, "구독 중인 OTT에서는 아직 제공 정보를 찾지 못했어요." |
| M-4 | **통과(라프텔 분)** | 라프텔만 구독, 진격의 거인 시즌 3: 히어로 "라프텔에서 찾기" → `laftel.net/search?keyword=진격의 거인 3기`. 시즌 제공 정보 미확인 작품으로 다른 시즌 제공처 버튼이 생기지 않는지는 별도 작품으로 확인 못 함 |
| M-5 | **통과** | 375: 칩 줄바꿈·넘침 없음, "넷플릭스에서 보기" 하단 403px(스크롤 없이 보임), `scrollWidth` 375. 제공처 이름 줄임표 상황은 재현 작품 없음 |
| M-6 | **해당 없음** | 운영 migration이 이미 적용돼 "적용 전" 상태를 만들 수 없음 |
| M-7 | **통과** | 프로필 쓰기 요청만 실패시키도록 fetch를 가로채고(오프라인 대용) 쿠팡플레이 클릭: 칩 원복, 상태 줄과 오류 토스트 "구독 OTT를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." |
| M-8 | **미실행** | 두 번째 계정 없음 |
| M-9 | **통과** | 구독 전부 해제 후 무빙: 등록 안내 + "구독 OTT 등록" → `/settings/subscribed-otts` |
| M-10 | **부분** | 검색 결과·추천 로딩 화면이 기존과 같게 동작. 홈 이어보기는 보지 않음 |
| M-11 | **미실행** | iOS 시뮬레이터 미실행 |
| M-12 | **웹으로 대체 확인** | 라프텔만 구독 시 애니(진격의 거인)에만 "라프텔에서 찾기", 비애니(무빙)는 버튼 없음. iOS OS 이동은 미확인 |

- 확인 중 발견(이번 기능 결함 아님, 앱 전체 기존 문제): 웹에서 `accessibilityState={{ checked }}`/`{{ selected }}`가 `aria-checked`·`aria-selected`로 출력되지 않는다(react-native-web 0.21, 화면 전체에서 해당 속성 0개). 화면 낭독기가 칩·탭의 선택 상태를 읽지 못한다.
- 콘솔에 400 응답 2건이 기록됐으나 설정·상세·검색 화면을 다시 열어 재현되지 않았고 요청 주소는 특정하지 못했다.

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
