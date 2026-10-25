# 63. 시청 진행 회차 선택 — API 화수가 있으면 항상 회차 버튼

작성일: 2026-10-18
대상 브랜치 기준: `main` (`bfcc3fd`) + 미커밋 작업. 작성 시점 마지막 기록 `npm test`는 1235/1236 통과다(`docs/development_next_steps.md` 2026-10-16). 실패 1개("uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함이다.
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/48_content_detail_completed_progress_fixes_spec.md`(진행 카드 완료 모드), `docs/development_next_steps.md`의 "총 화수 미정 작품의 회차 선택 복구"·"회차 선택을 실제 공개 에피소드 목록으로 전환"(2026-10-16)

> **근거.** 사용자 캡처(웹, 작품 상세 "추방당한 전생 중기사는 게임 지식으로 무쌍한다", 애니, 2026.07·26화, 보는 중). 시청 진행 카드에 회차 버튼이 없다. "API에서 공개 에피소드 목록을 제공하지 않아요. 본 회차는 직접 입력할 수 있어요." 문구와 숫자 입력(15화)만 있다.
> 사용자 요청: "시청진행이 라디오 버튼이였는데 API에서 몇화까지 있는지를 못찾겠다며 갑자기 이렇게 변경해버렸어 API로 공개된 화수를 표시해주고 없을때에만 입력하는 방식으로 변경해줘 있으면 무조건 api공개된 작품 화수를 보여주는거야"

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| P-1 | 작품의 총 화수(26화)를 API가 알려 주는데도 회차 버튼(1~26화)이 사라지고 숫자 입력만 남았다 |
| P-2 | 문구가 "API에서 공개 에피소드 목록을 제공하지 않아요"라서, 화수 정보가 없는 것처럼 보인다 |

## 2. 근본 원인
`src/components/content/EpisodeProgressCard.tsx`의 회차 버튼 조건이 2026-10-16 작업에서 바뀌었다(미커밋 diff).

| 시점 | 회차 버튼 조건 | 버튼 번호 |
|------|---------------|----------|
| 이전(`bfcc3fd`) | `totalEpisodes !== null && upperBound <= 200` | `1..upperBound`(시즌 화수 또는 총 화수) |
| 현재(69행, 226행) | `choices.length > 0` | `episodeChoiceNumbers(availability.data?.releasedEpisodes)`: fetch-episodes `availability_only`의 **공개된 에피소드 행**만 |

- 2026-10-16 기록: "빈 목록에 총 화수나 추정 수치를 넣지 않는다."
- AniList 작품은 `streamingEpisodes`가 비어 있는 경우가 많다(예: 185756 실측 `[]`). 이때 공개 목록이 비어, 총 화수(`totalEpisodes` 26)가 있어도 버튼이 사라진다.
- 문구(178~189행)도 공개 목록 기준이라, 화수가 있는데도 "제공하지 않아요"라고 한다.
- 숫자 입력(257~299행)은 버튼이 있어도 없어도 항상 보인다.

## 3. 재현 시나리오
1. 웹 8081에 로그인한 뒤 AniList 출처이고 공개 에피소드 목록이 빈 작품(예: 추방당한 전생 중기사, 26화)의 상세를 연다.
2. 상태가 "보는 중"이면 시청 진행 카드에 회차 버튼이 없고 숫자 입력만 있다.

## 4. 설계 결정

### D-1 (최우선). API가 화수를 주면 무조건 회차 버튼이다
버튼 번호는 아래 순서로 처음 해당하는 것을 쓴다.

| 순서 | 조건 | 버튼 |
|------|------|------|
| 1 | 화수가 있음: 선택 시즌의 `episode_count`, 없으면 `totalEpisodes`(1 이상) | `1..화수` |
| 2 | 화수가 없고 공개 목록(`releasedEpisodes`)이 있음 | 공개 목록 번호(2026-10-16 복구 동작 유지) |
| 3 | 둘 다 없음 | 버튼 없음 → 직접 입력 |

- 2026-10-16의 "빈 목록에 총 화수를 넣지 않는다" 결정은 사용자 요청(2026-10-18)으로 **화수가 있을 때는 화수 기준**으로 바뀐다.
- 공개 목록은 화수가 없을 때만 버튼에 쓴다.

### D-2. 직접 입력은 버튼이 없을 때만 보인다
- 버튼이 있으면 숫자 입력·± 단추(스테퍼)를 그리지 않는다.
- "아직 안 봄"(0화)·"전부 봤음"·"되돌리기"·저장은 그대로다. 0화는 "아직 안 봄"으로 고른다.

### D-3. 버튼 수 상한은 200이다
- 화수가 200을 넘으면 1번 대신 2번(공개 목록), 그것도 없으면 직접 입력이다.
- 이전 동작(`upperBound <= 200`)과 같다. 1,000화 이상 장편에서 버튼 수백 개를 그리지 않기 위해서다.
- 공개 목록도 기존 `episodeChoiceNumbers`가 200개로 자른다.

### D-4. 안내 문구
| 상태 | 문구 |
|------|------|
| 1번(화수) | 없음 |
| 2번(공개 목록) | 기존 `API 공개 회차 N개 · 최근 M화 · 총 화수 미정` |
| 3번 + 공개 목록 조회 중 | `공개된 회차를 확인하고 있어요.` |
| 3번 + 조회 실패 | `공개 회차를 불러오지 못했어요.` + 다시 시도(기존) |
| 3번 + 목록 없음 | `API에서 이 작품의 화수를 알려 주지 않아요. 본 회차를 직접 입력해 주세요.` |

- 진행 막대·`15 / 26화` 요약·완료 모드(docs/48)는 바꾸지 않는다.

### D-5. 판정은 순수 함수로 둔다
- `resolveEpisodeChoiceMode`와 `episodeChoiceInfoText`(`src/utils/contentDetailView.ts`)가 판정한다.
- 카드는 결과대로 그리기만 한다.
- 기존 `episodeChoiceNumbers`·`episodeChoiceSeasonNumber`는 바꾸지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| 공개 목록만 사용(현재) | 화수가 있어도 버튼이 사라진다(P-1) |
| 버튼과 숫자 입력을 함께 표시 | 사용자 요청: "없을 때에만 입력" |
| 공개 목록과 화수를 합쳐 방영 전 회차를 흐리게 | 공개 목록이 비는 작품이 많아 대부분 전부 흐려진다. 사용자 요청은 화수 표시다 |
| 상한 없이 화수만큼 버튼 | 장편에서 수백~수천 개를 그린다 |

## 6. 계약

### 6.1 `src/utils/contentDetailView.ts` (추가)
```ts
export const EPISODE_CHOICE_MAX = 200;
export type EpisodeChoiceMode =
  | { kind: "count"; numbers: number[] }
  | { kind: "released"; numbers: number[] }
  | { kind: "manual" };
export function resolveEpisodeChoiceMode(input: {
  seasonEpisodeCount: number | null | undefined;
  totalEpisodes: number | null;
  releasedEpisodes: readonly { episode_number: number }[];
}): EpisodeChoiceMode;
export function episodeChoiceInfoText(input: {
  mode: EpisodeChoiceMode;
  totalEpisodes: number | null;
  isFetching: boolean;
  isError: boolean;
}): string | null;
export const EPISODE_CHOICE_MANUAL_COPY = "API에서 이 작품의 화수를 알려 주지 않아요. 본 회차를 직접 입력해 주세요.";
```
**`resolveEpisodeChoiceMode` 판정 순서**
1. `count = seasonEpisodeCount ?? totalEpisodes`. 정수이고 `1 ≤ count ≤ EPISODE_CHOICE_MAX`이면 `{ kind: "count", numbers: [1..count] }`다.
2. 아니면 `released = episodeChoiceNumbers(releasedEpisodes)`가 비어 있지 않으면 `{ kind: "released", numbers: released }`다.
3. 그 밖에는 `{ kind: "manual" }`이다.

**`episodeChoiceInfoText` 판정 순서**
1. `count` → `null`
2. `released` → `` `API 공개 회차 ${n}개 · 최근 ${last}화${totalEpisodes === null ? " · 총 화수 미정" : ""}` ``(기존 문구와 같음)
3. `manual` + `isError` → `"공개 회차를 불러오지 못했어요."`
4. `manual` + `isFetching` → `"공개된 회차를 확인하고 있어요."`
5. `manual` → `EPISODE_CHOICE_MANUAL_COPY`

### 6.2 `src/components/content/EpisodeProgressCard.tsx`
- 69행 `choices` 대신 `const choiceMode = resolveEpisodeChoiceMode({ seasonEpisodeCount: selectedSeason?.episode_count, totalEpisodes, releasedEpisodes: availability.data?.releasedEpisodes ?? [] })`를 쓴다.
- 공개 목록 조회(`useEpisodeAvailability`)는 그대로 부른다. 2번과 안내에 필요하다.
- 안내(178~189행): `episodeChoiceInfoText(...)`가 `null`이면 그리지 않는다. 다시 시도 단추는 `manual` + `isError`일 때만 둔다.
- 회차 버튼(225~255행): `choiceMode.kind !== "manual"`일 때 `choiceMode.numbers`로 그린다. 접근성 `radiogroup`/`radio`, 선택 표시, `HorizontalChoiceRail`은 그대로다.
  - `selectedIndex`는 `max(0, numbers.indexOf(draftEpisodeNumber))`다. 0화(아직 안 봄)이면 0이다.
- 스테퍼(257~299행, ± 단추·숫자 입력·"화")는 `choiceMode.kind === "manual"`일 때만 그린다. 오류 문구(300행)는 그대로 둔다.
- `upperBound`, 저장(`normalizeManualEpisodeInput`), 빠른 동작, 완료 모드, 진행 요약은 바꾸지 않는다.
- 새 스타일이 필요하면 토큰만 쓴다.

## 7. 데이터 모델 / SQL
변경 없음. 서버(`fetch-episodes`) 변경 없음.

## 8. 화면 명세
UI 규칙 준수(UI-1~UI-13). 시청 진행 카드("보는 중" 등 완료 모드가 아닐 때)의 섹션 순서는 아래다.

| 모드 | 순서 |
|------|------|
| `count`·`released` | 제목·요약 → 진행 막대 → (`released`만) 안내 → (시즌 선택) → "여기까지 봤어요" + 회차 버튼 → "다음에 볼 화" → 빠른 동작 → 저장 |
| `manual` | 제목·요약 → (진행 막대) → 안내 → (시즌 선택) → "여기까지 봤어요" + 스테퍼 → … (지금과 같음) |

## 9. 엣지 케이스
| # | 상황 | 기대 동작 | 테스트 |
|---|------|-----------|--------|
| E-1 | 총 26화, 공개 목록 빈 값(이번 작품) | 1~26화 버튼, 입력 없음, 안내 없음 | EC-1, EI-1, M-1 |
| E-2 | 시즌 선택: 시즌 2 화수 12, 총 24 | 시즌 2의 1~12화 | EC-2 |
| E-3 | 화수 없음, 공개 목록 [1,2,3] | 1·2·3화 버튼 + "API 공개 회차 3개 · 최근 3화 · 총 화수 미정" | EC-3, EI-2 |
| E-4 | 화수 없음, 공개 목록 [1,3] | 1·3화(중간 생성 안 함, 기존 규칙) | EC-3 |
| E-5 | 화수 없음, 목록 없음 | 입력만, 안내 `EPISODE_CHOICE_MANUAL_COPY` | EC-4, EI-3 |
| E-6 | 화수 없음, 목록 조회 중/실패 | 입력 + "확인하고 있어요"/"불러오지 못했어요"+다시 시도 | EI-4 |
| E-7 | 화수 1,100 | 목록 있으면 목록 버튼, 없으면 입력 | EC-5 |
| E-8 | 화수 0 또는 음수·소수 | 화수 없음으로 본다 | EC-6 |
| E-9 | 저장된 진행 0화(아직 안 봄) | 버튼 선택 없음, "아직 안 봄"으로 0 저장 가능 | 수동 M-2 |
| E-10 | 완료 상태 | 완료 모드 그대로(docs/48), 버튼·입력 없음 | 기존 테스트 |
| E-11 | 화수 1 | 1화 버튼 하나 | EC-1 |

## 10. 테스트 표
**모든 행을 테스트로 옮긴다. 줄이지 않는다.** 기존 테스트(특히 `contentDetailView.test.ts`의 `episodeChoiceNumbers`·`episodeChoiceSeasonNumber`·완료 모드)는 고치지 않는다. 보존 테스트는 없다. 새 행은 새 export가 없어 구현 전에 모두 실패해야 한다.

### `src/utils/contentDetailView.test.ts` (추가)
| ID | 입력 | 기대 |
|----|------|------|
| EC-1 | `resolveEpisodeChoiceMode({ seasonEpisodeCount: null, totalEpisodes: 26, releasedEpisodes: [] })` / `totalEpisodes: 1` | `{ kind: "count", numbers: [1..26] }`(길이 26) / `{ kind: "count", numbers: [1] }` |
| EC-2 | `{ seasonEpisodeCount: 12, totalEpisodes: 24, releasedEpisodes: [{episode_number: 1}] }` | `kind "count"`, 길이 12 |
| EC-3 | `{ null, null, [{3},{1},{3}] }` / `{ null, null, [{1},{3}] }` | `{ kind: "released", numbers: [1,3] }` 둘 다 |
| EC-4 | `{ null, null, [] }` | `{ kind: "manual" }` |
| EC-5 | `{ null, 1100, [{1},{2}] }` / `{ null, 1100, [] }` | `{ kind: "released", numbers: [1,2] }` / `{ kind: "manual" }` |
| EC-6 | `totalEpisodes`가 `0`, `-3`, `2.5`(공개 목록 빈 값) | 모두 `{ kind: "manual" }` |
| EI-1 | `episodeChoiceInfoText({ mode: count 모드, totalEpisodes: 26, isFetching: true, isError: true })` | `null` |
| EI-2 | released `[1,2,3]`, `totalEpisodes: null` / released `[1,2]`, `totalEpisodes: 1100`(상한 초과로 released 모드) | `"API 공개 회차 3개 · 최근 3화 · 총 화수 미정"` / `"API 공개 회차 2개 · 최근 2화"` |
| EI-3 | manual, `isFetching: false`, `isError: false` | `EPISODE_CHOICE_MANUAL_COPY` |
| EI-4 | manual + `isError: true` / manual + `isFetching: true` | `"공개 회차를 불러오지 못했어요."` / `"공개된 회차를 확인하고 있어요."` |

### 수동 확인 (UI-14.3)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 8081 1440 | "추방당한 전생 중기사…" 상세: 1~26화 버튼, 15화 선택 표시, 숫자 입력 없음, 안내 문구 없음 |
| M-2 | 웹 8081 | 버튼으로 16화 선택 → 저장 → 요약 `16 / 26화`. "아직 안 봄" → 0 저장 가능(확인 후 원래 값 복원) |
| M-3 | 웹 8081 | 화수 없는 방영 중 작품: 공개 목록 버튼 또는 직접 입력과 해당 안내 |
| M-4 | 웹 375 | 버튼 가로 스크롤, 문서 가로 넘침 없음 |
| M-5 | 앱(iOS 세로) | M-1·M-2와 같음, 버튼 터치 44 이상, 글자 1.3배에서 잘림 없음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `src/utils/contentDetailView.ts` | 6.1 |
| `src/utils/contentDetailView.test.ts` | EC-1~EC-6, EI-1~EI-4 |
| `src/components/content/EpisodeProgressCard.tsx` | 6.2 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| `fetch-episodes`의 공개 목록 산출 방식 | 서버 변경 없음 |
| 방영 전 회차 구분 표시 | 5장 기각 |
| 에피소드 체크 화면(`episodes.tsx`) | 별도 화면 |
| 완료 모드 | docs/48 그대로 |

## 13. 확실하지 않음
- `totalEpisodes`(`resolvedEpisodeCount`)는 방영 예정 화수일 수 있다(방영 중 작품). 사용자 요청대로 화수가 있으면 전부 버튼으로 보여 준다. 아직 방영 전인 회차도 고를 수 있다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo) 리포의 구현 담당이다. UI 정정 작업이다.
- 시청 진행 카드의 회차 버튼이 2026-10-16 변경으로 "API 공개 에피소드 목록"이 있을 때만 나오게 됐다. 그래서 총 화수(예: 26화)를 알아도 목록이 비면 버튼이 사라지고 숫자 입력만 남는다.
- API가 화수를 주면 무조건 1~화수 버튼을 보여 준다. 화수가 없으면 공개 목록 버튼, 그것도 없을 때만 직접 입력을 보여 준다.

| ID | 증상 |
|----|------|
| P-1 | 26화 작품인데 회차 버튼 없이 숫자 입력만 있다 |
| P-2 | 화수가 있는데도 "API에서 공개 에피소드 목록을 제공하지 않아요" 안내 |

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. 이 명세서 1~13장. 원인은 2장, 결정은 D-1~D-5, 계약은 6장, 테스트는 10장이다.
3. `docs/development_next_steps.md`의 2026-10-16 항목 두 개(공개 목록 전환·총 화수 미정 복구). 이번 D-1이 그중 "빈 목록에 총 화수를 넣지 않는다"를 바꾼다.
4. 고칠 파일과 위치:
   - `src/components/content/EpisodeProgressCard.tsx`: 64~73행, 176~190행, 222~300행
   - `src/utils/contentDetailView.ts`: 66~79행(+test)
5. `AGENTS.md` — 테스트 규칙.

# 시작 상태 (반드시 유지)
- `git status`와 `npm test` 결과를 기록한다. 마지막 기록 기준선은 1235/1236이고, 기존 실패 1개는 무관하다. 숫자가 다르면 시작 시점 값을 기준선으로 보고한다. 그 밖의 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 버튼 번호는 화수(선택 시즌 `episode_count` → `totalEpisodes`, 1~200) → 공개 목록 → 없음 순서다. 화수가 있으면 공개 목록이 비어도 `1..화수` 버튼이다.
- **D-2.** 버튼이 있으면 숫자 입력·± 단추를 그리지 않는다. 빠른 동작·저장은 그대로다.
- **D-3.** 상한은 200이다.
- **D-4.** 안내 문구는 6.1 표 그대로다(화수 모드에서는 없음).
- **D-5.** 판정은 `resolveEpisodeChoiceMode`·`episodeChoiceInfoText` 순수 함수다. 기존 `episodeChoiceNumbers`·`episodeChoiceSeasonNumber`는 바꾸지 않는다.

# STEP 1 — 실패하는 테스트부터
- 10장 EC-1~EC-6, EI-1~EI-4를 `src/utils/contentDetailView.test.ts`에 추가한다.
- `npm test`로 새 테스트가 전부 실패(새 export 없음)하는지 확인한다. 하나라도 통과하면 멈추고 보고한다.

# STEP 2 — 순수 함수
6.1을 추가한다. 새 테스트와 기존 테스트가 통과해야 한다.

# STEP 3 — 카드
- 6.2대로 `EpisodeProgressCard`를 고친다. 새 스타일은 토큰만 쓴다.
- 웹 8081에서 로그인된 화면을 쓸 수 있으면 M-1·M-4를 확인한다. 저장은 하지 않거나 원래 값으로 복원한다. 로그인 대행은 금지다. 못 하면 사유를 보고한다.

# 엣지 케이스
9장 E-1~E-11 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
git diff -U0 -- src/components/content/EpisodeProgressCard.tsx | grep -E '^\+' | grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]|Alert\.alert"
```
- `npm test`: 기준선 통과 개수 + 새 테스트 10개. 기존 실패 1개 외 실패는 0이어야 한다.
- 마지막 grep(추가한 줄)은 0줄이어야 한다(UI-13.2).

# DEFINITION OF DONE
- [ ] EC-1~EC-6, EI-1~EI-4가 수정 전에 실패했고 수정 후 통과한다
- [ ] 기존 테스트 diff가 없고, 테스트 개수가 줄지 않았다
- [ ] 화수가 있으면(1~200) 공개 목록과 무관하게 `1..화수` 버튼이 보이고 숫자 입력이 없다
- [ ] 숫자 입력은 `manual` 모드에서만 보인다
- [ ] `typecheck`·`lint` 통과, UI-13.2 grep 0줄
- [ ] 웹·앱 수동 확인 결과(또는 못 한 사유)를 M-1~M-5 표로 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
src/utils/contentDetailView.ts
src/utils/contentDetailView.test.ts
src/components/content/EpisodeProgressCard.tsx
```

# 보고 항목
1. STEP 1에서 실패한 테스트의 실제 출력(요약)
2. `npm test` before / after 통과 개수, `typecheck`·`lint`·토큰 grep 결과
3. 추가한 테스트 ID와 이름
4. M-1~M-5 결과(웹/앱 구분, 못 한 항목과 사유)
5. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)

# 금지사항
- 배포 명령을 실행하지 않는다(이번 작업은 앱만이다).
- DB 마이그레이션 파일을 만들지 않는다. 서버(`fetch-episodes`)를 바꾸지 않는다.
- 테스트 표의 행을 임의로 줄이지 않는다. **테스트를 통과시키려고 assertion을 완화하지 않는다. 구현을 고친다.**
- 리팩터링·포맷팅·"김에 고치기"를 하지 않는다.
- 테스트 파일에서 React Native 모듈(`react-native`, `expo-*`)이나 Supabase 클라이언트를 import하지 않는다.
- 사용자 진행 기록을 저장한 채로 두지 않는다. 로그인 대행 금지.
