# 83. 쓰지 않는 상태 파일 4개 삭제 명세

작성일: 2026-11-19
대상 브랜치 기준: main (519ddc7) + docs/74~82 미커밋 변경
선행 문서: [docs/08](08_frontend_architecture.md)(현재 구현 안내 표 "정의만 남은 상태"), [docs/04](04_architecture.md), [docs/69](69_persistent_public_metadata_cache_fixes_spec.md)(보러가기 캐시), [docs/80](80_popular_recommendation_leftovers_and_exclusion_label_spec.md)(같은 방식의 잔여 코드 삭제)

## 1. 문제 정의

| ID | 증상 |
|----|------|
| F-1 | 첫 커밋(b3f4ba7)부터 있던 상태 파일 4개를 앱 어디에서도 불러오지 않는다. 핀 작성 폼·회차 선택·보러가기·태그 필터의 상태가 여기 있다고 오해하기 쉽다. 그래서 문서 3곳(docs/08, docs/04, AGENTS.md)이 "미사용이니 오인하지 말라"는 경고를 따로 들고 있다 |

| 파일 | 줄 수 | 내보내는 것 | 실제 상태 원천(문서 기준) |
|------|------|------------|--------------------------|
| `src/stores/pinComposerStore.ts` | 47 | `usePinComposerStore` | `src/atoms/pinFormAtom.ts`의 `pinFormDraftAtom` + `PinComposer` 로컬 상태 |
| `src/stores/episodeSelectionStore.ts` | 17 | `useEpisodeSelectionStore` | 작품 상세·회차 화면의 로컬 상태 |
| `src/atoms/watchProvidersAtom.ts` | 15 | `watchProvidersAtom`, `WatchProvidersAtomState` | `src/hooks/useWatchProviders.ts`(TanStack Query) + DB(docs/69) |
| `src/atoms/tagFilterAtom.ts` | 3 | `selectedTagFilterIdsAtom` | 없음(태그 필터는 핀 화면 UI 상태가 맡는다) |

- 2026-11-19 grep 결과: 위 내보내기 이름을 쓰는 파일은 `app`·`src`·`scripts`·`supabase`에서 각 파일 자신뿐이다. 테스트도 없다.

## 2. 근본 원인

- 초기 설계(`docs/codex_prompt.md`, `docs/codex_implementation_prompt.md`)가 이 파일들을 만들었다. 이후 구현이 다른 상태 원천으로 옮겨 갔지만 파일은 지우지 않았다.
- docs/08 표는 "제거/재사용은 별도 변경으로 검토한다"고 적어 두었다. 이 명세가 그 별도 변경이다.

## 3. 재현 시나리오

1. `grep -rn "usePinComposerStore\|useEpisodeSelectionStore\|watchProvidersAtom\|selectedTagFilterIdsAtom" app src scripts supabase`
2. 결과는 각 정의 파일 자신뿐이다.

## 4. 설계 결정

### D-1. 4개 파일만 지운다. 쓰는 상태 파일은 건드리지 않는다 (최우선)

- 지우는 것: 1장 표의 4개 파일.
- **남기는 것:** `src/atoms/pinFormAtom.ts`, `src/atoms/spoilerAtom.ts`, `src/stores`의 나머지 8개(`appUIStore`, `authStore`, `libraryUiStore`, `listScrollStore`, `pinsUiStore`, `recommendationUiStore`, `searchHistoryStore`, `searchUiStore`).
- `jotai`·`zustand` 의존성은 그대로다. 남은 파일이 계속 쓴다.

### D-2. 현재 안내 문서 3곳에서 이 파일 이름을 뺀다

문서의 경고는 파일이 있을 때만 의미가 있다. 파일을 지우면 경고가 없는 파일을 가리키게 된다. 바꿀 문장은 6.2에 그대로 적는다.

### D-3. 과거 프롬프트·명세 본문은 고치지 않는다

`docs/codex_prompt.md`, `docs/codex_implementation_prompt.md`, `docs/cursor_verification_prompt.md`, `docs/11_screen_implementation_spec.md`는 당시 기록이다. CLAUDE.md 규칙대로 보존하고 현재 코드와 대조해서 읽는다.

### D-4. 판정은 소스 검사 테스트로 한다

docs/78·80과 같은 방식이다. 지운 파일이 없고, 다른 곳이 참조하지 않고, 남길 파일은 남아 있는지를 `node:fs`로 확인한다.

> D-N은 Codex가 임의로 바꾸면 안 되는 항목이다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| 그대로 두고 문서 경고만 유지 | 경고 3곳을 계속 관리해야 하고, 새로 읽는 사람이 경고를 놓치면 오해한다 |
| `pinComposerStore`를 살려 `pinFormAtom`을 대체 | 동작 변경이다. AGENTS.md는 "기존 Jotai 기반 폼 상태는 관련 작업 없이 이관하지 않는다"고 한다 |
| 과거 프롬프트 문서까지 고치기 | 당시 기록을 바꾸게 된다(D-3) |
| `src/atoms` 폴더를 Zustand로 통일 | 범위 밖. 리팩터링이다 |

## 6. 계약

### 6.1 삭제

```
src/stores/pinComposerStore.ts
src/stores/episodeSelectionStore.ts
src/atoms/watchProvidersAtom.ts
src/atoms/tagFilterAtom.ts
```

### 6.2 문서 문장 교체

`docs/08_frontend_architecture.md` "현재 구현 안내" 표(101~102행):

- 시청처 캐시 줄의 셋째 칸을 다음으로 바꾼다.
  > docs/69의 수동 갱신 캐시다. 서버 상태를 Jotai·Zustand에 복제하지 않는다.
- "정의만 남은 상태" 줄을 지운다.

`docs/04_architecture.md` 28행 셋째 칸:

> 실제 사용처는 08 현황 표 참조. 보러가기는 TanStack Query와 DB 저장 경로다(docs/69).

`AGENTS.md` 161행:

> - 기존 Jotai 기반 폼·스포일러 상태는 관련 작업 없이 이관하지 않는다. 보러가기 서버 응답은 docs/69의 TanStack Query·DB 저장 경로를 쓴다. Jotai로 새 서버 캐시를 만들지 않는다.

행 번호가 달라졌으면 같은 문장을 찾아 바꾼다. 그 밖의 문장은 바꾸지 않는다.

## 7. 데이터 모델 / SQL

해당 없음. DB 마이그레이션을 만들지 않는다.

## 8. 화면 명세

화면 변경은 없다. 지운 파일을 쓰는 화면이 없으므로 모든 화면이 전과 같이 열려야 한다.

## 9. 엣지 케이스

| # | 상황 | 기대 동작 | 테스트 |
|---|------|----------|--------|
| E-1 | 지운 4개 파일 | 존재하지 않는다 | T-1 |
| E-2 | `app`·`src`·`scripts`의 다른 파일 | 지운 파일 경로·내보내기 이름을 참조하지 않는다 | T-2 |
| E-3 | 남길 상태 파일 10개 | 모두 남는다 | T-3 |
| E-4 | 현재 안내 문서 3곳 | 지운 파일 이름이 없다 | T-4 |
| E-5 | 핀 작성·작품 상세·핀 목록 화면 | 콘솔 오류 없이 열린다 | M-1 |
| E-6 | 과거 프롬프트 문서 | 그대로다(D-3) | — |

## 10. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다.**

- 새 파일은 `scripts/unusedStateFilesCleanup.test.ts`다. `node:test`의 `it`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`만 import한다.
- 파일 목록 읽기는 docs/80 가드(`scripts/popularRecommendationsCleanup.test.ts` T-2)와 같은 방식이다.

| ID | 테스트 이름 | 기대 | STEP 1 직후 |
|----|------------|------|------------|
| T-1 | `83 T-1: unused state files are removed` | 6.1의 4개 파일이 모두 없다 | **실패** |
| T-2 | `83 T-2: no source references the removed state files` | `app`·`src`·`scripts`의 `.ts`·`.tsx` 중 이 테스트 파일을 뺀 모든 파일에 `pinComposerStore`, `episodeSelectionStore`, `watchProvidersAtom`, `tagFilterAtom`, `usePinComposerStore`, `useEpisodeSelectionStore`, `selectedTagFilterIdsAtom` 문자열이 0회 | **실패**(정의 파일 자신이 포함) |
| T-3 | `83 T-3: state files in use are kept` | `src/atoms/pinFormAtom.ts`, `src/atoms/spoilerAtom.ts`와 D-1의 `src/stores` 8개 파일이 모두 있다 | 통과(보호 테스트) |
| T-4 | `83 T-4: current guidance docs no longer name the removed files` | `docs/08_frontend_architecture.md`, `docs/04_architecture.md`, `AGENTS.md`에 `pinComposerStore`, `episodeSelectionStore`, `watchProvidersAtom`, `tagFilterAtom` 문자열이 0회 | **실패** |

개수:
- 다른 작업이 같은 작업 트리에서 테스트를 늘리고 있으므로, 시작할 때 `npm test` 통과 개수 N을 기록한다(2026-11-19 작성 시점 1,866개).
- STEP 1 직후에는 N+4개 중 N+1개 통과·3개 실패(T-1, T-2, T-4)다.
- 목표는 **N+4개 모두 통과**다. 지운 파일에는 테스트가 없어서 빠지는 테스트는 없다.

## 11. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/stores/pinComposerStore.ts` | 삭제 |
| `src/stores/episodeSelectionStore.ts` | 삭제 |
| `src/atoms/watchProvidersAtom.ts` | 삭제 |
| `src/atoms/tagFilterAtom.ts` | 삭제 |
| `scripts/unusedStateFilesCleanup.test.ts` | 새 파일. T-1~T-4 |
| `docs/08_frontend_architecture.md` | 6.2 표 두 줄 |
| `docs/04_architecture.md` | 6.2 한 칸 |
| `AGENTS.md` | 6.2 한 줄(161행). 작업 표의 83번 줄은 명세 작성 때 이미 추가했으므로 건드리지 않는다 |
| `docs/development_next_steps.md` | 맨 위에 docs/83 절 추가 |
| `docs/README.md` | 83번 줄 상태 갱신 |

## 12. 범위 밖

- 남은 상태 파일의 구조 변경, Jotai↔Zustand 통일.
- `jotai`·`zustand` 의존성 변경.
- 과거 프롬프트·명세 본문(D-3).
- 다른 미사용 export 전수 정리. 이번에는 파일 단위로 아무도 불러오지 않는 4개만 다룬다(2026-11-19 `src` 전체 점검에서 이 4개만 나왔다).

## 13. 확실하지 않음 — 별도 검증 필요

- 동적 import나 문자열 경로로 이 파일을 부르는 곳은 grep에서 찾지 못했다. `typecheck`와 웹 M-1로 다시 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 이번 작업은 **정리 작업**이다. 앱 어디에서도 불러오지 않는 상태 파일 4개를 지우고, 그 파일을 "미사용"이라고 경고하던 현재 안내 문서 3곳의 문장을 정리한다. 동작은 바뀌지 않는다.

| ID | 결함 |
|----|------|
| F-1 | `pinComposerStore`, `episodeSelectionStore`, `watchProvidersAtom`, `tagFilterAtom`이 쓰이지 않은 채 남아 실제 상태 원천으로 오해된다 |

# READ FIRST
1. `docs/83_unused_state_files_cleanup_spec.md` — 이 명세. D-1~D-4, 6장 계약(삭제 목록·문서 문장), E-1~E-6, T-1~T-4.
2. `AGENTS.md` — 테스트 규칙. **테스트 파일에서 React Native나 Supabase 모듈을 import하면 실행이 깨진다.**
3. `docs/08_frontend_architecture.md` "현재 구현 안내" 표.
4. `scripts/popularRecommendationsCleanup.test.ts` — 같은 방식의 가드 테스트 예.

# 시작 상태 (반드시 유지)
- `npm test` 전부 통과, `typecheck`·`lint` 통과. 통과 개수 N을 기록한다.
- 작업 트리에는 docs/74~82의 미커밋 변경이 있고 다른 작업이 진행 중일 수 있다. 되돌리거나 정리하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 6.1의 4개 파일만 지운다. `pinFormAtom.ts`, `spoilerAtom.ts`와 `src/stores`의 나머지 8개는 **바꾸지 않는다.** `package.json`도 바꾸지 않는다.
- **D-2.** 문서는 6.2의 문장만 바꾼다.
- **D-3.** 과거 프롬프트·명세(`docs/codex_prompt.md`, `docs/codex_implementation_prompt.md`, `docs/cursor_verification_prompt.md`, `docs/11_screen_implementation_spec.md`)는 고치지 않는다.
- **D-4.** 판정은 `node:fs` 소스 검사 테스트로 한다.
- DB 마이그레이션을 만들지 않는다.

# STEP 1 — 실패하는 테스트부터
1. `scripts/unusedStateFilesCleanup.test.ts`에 10장 T-1~T-4를 그대로 옮긴다.
2. `npm test`를 돌려 **T-1, T-2, T-4만 실패**하는지(N+4개 중 N+1개 통과) 눈으로 확인한다. 다르면 멈추고 보고한다.

# STEP 2 — 삭제
6.1의 4개 파일을 지운다. `npm test`에서 T-4만 실패하고 `npm run typecheck`가 통과하는지 확인한다.

# STEP 3 — 문서 문장 정리
6.2대로 `docs/08_frontend_architecture.md`, `docs/04_architecture.md`, `AGENTS.md`를 고친다. `npm test` N+4개가 모두 통과하는지 확인한다.

# STEP 4 — 기록
- `docs/development_next_steps.md` 맨 위에 `## 쓰지 않는 상태 파일 삭제 (docs/83, <날짜>)` 절을 추가한다. 상태, 테스트 before/STEP 1/after, 수동 확인 결과 또는 미실행 사유를 적는다.
- `docs/README.md`의 83번 줄 상태를 "구현, 화면 미확인"으로 바꾼다. 화면을 실제로 봤다면 그 결과대로 적는다.

# 엣지 케이스 (전부 처리, 명세서 9장)
E-1~E-6 전부. E-6은 고치지 않는 것이 기대 동작이다.

# 수동 확인
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 | 홈, 핀 탭, 작품 상세(회차 선택 포함), 핀 작성 화면이 열리고 콘솔 오류가 0건이다. 저장 버튼은 누르지 않는다 |
| M-2 | 앱(iOS 세로) | 같은 화면이 열린다 |

8081 서버가 이미 떠 있으면 그대로 쓰되, 예전 번들이 의심되면 재시작한다.

# 검증 명령
순서대로 전부 통과해야 한다.
```
npm test
npm run typecheck
npm run lint
```
목표는 시작 기준선 N + 4개 통과다. 기존 테스트는 하나도 깨지지 않아야 한다.

# DEFINITION OF DONE
- [ ] STEP 1에서 T-1, T-2, T-4가 실패하고 T-3이 통과하는 것을 확인했고, STEP 3 뒤 T-1~T-4가 모두 통과한다
- [ ] `npm test` N+4개 통과, 기존 테스트 개수가 줄지 않았다
- [ ] `typecheck`·`lint` 통과
- [ ] 지운 파일은 6.1의 4개뿐이고 `package.json` diff가 없다
- [ ] 과거 프롬프트 문서 4개의 diff가 없다
- [ ] 웹·앱 수동 확인 표(M-1·M-2) 결과 또는 미실행 사유를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/stores/pinComposerStore.ts          (삭제)
src/stores/episodeSelectionStore.ts     (삭제)
src/atoms/watchProvidersAtom.ts         (삭제)
src/atoms/tagFilterAtom.ts              (삭제)
scripts/unusedStateFilesCleanup.test.ts (새 파일)
docs/08_frontend_architecture.md
docs/04_architecture.md
AGENTS.md
docs/development_next_steps.md
docs/README.md
```

# 보고 항목
1. STEP 1에서 실패한 T-1, T-2, T-4의 실제 출력(요약 가능)
2. `npm test` 결과 (before N / STEP 1 / STEP 2 / after 통과·실패 개수)
3. `npm run typecheck`, `npm run lint` 결과
4. 추가한 테스트 ID와 이름
5. 문서 3곳의 diff
6. 수동 확인 M-1·M-2 결과 또는 미실행 사유
7. D-1~D-4 중 문제가 있다고 판단한 항목 (바꾸지는 말고 보고만)
8. 사람이 해야 할 후속 작업

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다.
- **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다. 명시된 변경만 한다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
