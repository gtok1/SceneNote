# ROLE & GOAL

너는 SceneNote(React Native + Expo + Supabase) 리포의 구현 담당이다. 검색 탭 추천 목록의 추가 작품을 스크롤 끝에서 자동 로딩하도록 복구한다. 계정별 필터 때문에 12개 미만(예: 7개)이 남더라도 버튼 클릭 없이 다음 커서를 탐색할 수 있어야 한다. 단, 진전 없는 반복 요청은 제한한다.

# READ FIRST

1. `AGENTS.md` — 작업 규칙과 테스트 제한.
2. `docs/28_recommendation_scroll_pagination_fixes_spec.md` — D-1~D-6과 RSP-01~10. 설계 결정을 임의로 바꾸지 않는다.
3. `docs/22_search_recommendations_restore_spec.md` — 추천/일반 검색 분리, 기존 cursor·중복 제거·오류 계약.
4. `docs/27_excluded_relationship_themes_spec.md` — 계정별 제외 설정을 유지.
5. `app/search.tsx`, `src/hooks/usePersonalizedRecommendations.ts`, `src/utils/recommendationFeed.ts`, `src/utils/recommendationSession.ts`, `src/components/content/PersonalizedRecommendationGalleryCard.tsx`와 해당 테스트 — 실제 시그니처와 호출 경로를 확인한다.

# 바꾸면 안 되는 설계 결정

- **D-1:** 추천 모드에서 사용자가 하단에 도달하고 유효 커서가 있으면 다음 배치를 자동으로 붙인다. 정상 흐름에서 “추천 더 찾기” 클릭을 요구하지 않는다.
- **D-2:** 요청 중·오류·종료를 구분하고 중복 호출하지 않는다. 오류에는 기존 카드와 다시 시도를 유지한다.
- **D-3:** 12개 미만도 스크롤로 재개할 수 있어야 한다. 무진전 자동 탐색은 횟수/시간 상한을 지키며 실제 새 스크롤 없이 스스로 재시작하지 않는다.
- **D-4:** 현재 계정의 제외 설정 및 화면 문맥을 유지한다. 제목/유사 검색의 자동 로딩은 변경하지 않는다.
- **D-5:** 요소 줄이기 행동 유무에 관계없이 갤러리 카드 footer 아이콘 슬롯·빠른 보기·추가 버튼 위치와 크기를 일관되게 유지한다. 실제 터치 영역은 44×44pt 이상이다.
- **D-6:** 계정별 seen history는 온전히 유지하되 요청의 `exclude_ids`만 최근 고유 ID 최대 200개로 제한한다. 필터로 숨긴 후보가 많아도 Edge의 `MAX_EXCLUSION_IDS=200`을 넘기지 않는다.

# STEP 1 — 회귀 테스트

`src/utils/recommendationFeed.test.ts`에서 RSP-01~08 중 순수 판정 가능한 모든 행을 추가한다. `src/utils/recommendationSession.test.ts`에 200개를 넘는 seen ID가 있어도 전체 기록이 유지되고 요청용 최근 고유 ID만 200개 이내가 되는 RSP-10을 추가한다. 특히 7개+커서+새 하단 스크롤이 허용되는 경우, 같은 스크롤 콜백 반복·요청 중 중복 금지, 무진전 상한, 종료/오류/화면 비활성을 구분한다. 수정 전에 회귀 테스트가 실제로 실패하는지 확인한다. 화면 제스처·수명은 UI QA 항목으로 남기고 실제 검증한다. 테스트에서 React Native·Supabase 모듈을 import하지 않는다.

# STEP 2 — 자동 스크롤 로딩 복구

`app/search.tsx`의 추천 목록 하단 도달을 `src/utils/recommendationFeed.ts`의 순수 판정에 연결한다. `src/hooks/usePersonalizedRecommendations.ts`의 기존 `loadMore`, cursor, `appendRecommendationFeed`, 계정/화면 요청 scope를 재사용한다. 단순히 `visibleCount >= 12` 조건 때문에 짧은 피드를 막지 않는다. 실제 사용자 스크롤 한 번에 하나의 제한된 탐색만 시작하고, 레이아웃 변화로 재발행된 `onEndReached`가 무한 루프를 만들지 않게 한다.

장기 세션에서는 `src/utils/recommendationSession.ts`에 전송용 제외 ID 선택 함수를 두고, hook의 추천 요청 경로에 적용한다. 누적된 canonical/external/title 별칭을 포함한 전체 seen history는 저장·로컬 중복 판정용으로 유지한다. 전송 직전 정규화·중복 제거된 ID의 최근 최대 200개만 `exclude_ids`에 넣는다. 새로고침·빈자리 보충·추가 로딩에서 Edge 400이 재발하지 않게 한다. 200개 밖의 오래된 작품이 반환되면 기존 identity 중복 제거로 화면에 재표시하지 않는다.

# STEP 3 — 하단 상태와 카드 footer 정리

로딩 중 진행 상태, 실패 시 다시 시도, 실제 소진 시 종료 안내를 표시한다. 다음 커서가 있고 정상 로딩 가능한 때는 “추천 더 찾기” 버튼을 요구하지 않는다. 무진전 상한에 닿은 예외 상황에서는 현재 카드와 설명을 유지하고 보조 재시도를 제공할 수 있다. 계정별 제외 설명은 유지한다.

`PersonalizedRecommendationGalleryCard.tsx`에서 `onReduceTheme`이 있는 카드와 없는 카드의 아이콘 슬롯 폭·순서, 빠른 보기, 추가 버튼 정렬을 맞춘다. 테마 행동이 없을 때 빈 슬롯은 접근성 트리에 버튼으로 올리지 않는다. 추가 버튼은 카드마다 동일한 위치·폭으로 보이도록 하고, 모든 실제 행동의 최소 터치 영역 44×44pt를 지킨다. 320폭과 긴 문구·큰 글자에서 줄바꿈/잘림을 확인한다.

# STEP 4 — 검증

`docs/28_recommendation_scroll_pagination_fixes_spec.md`의 **RSP-01~10 전 행**을 자동 테스트 또는 UI QA로 검증하고 결과를 보고한다. 7개가 남는 실제 필터 계정에서 아래로 스크롤해 자동 요청을 확인한다. 요청 실패, 반복 하단 콜백, 계정 전환, 검색 모드 전환도 확인한다. RSP-09는 요소 줄이기 유무가 다른 카드를 같은 행에서 비교한다. RSP-10은 200개 초과 세션에서 실제 요청 body 크기와 HTTP 상태를 확인한다.

```text
npm test
npm run typecheck
npm run lint
```

# DEFINITION OF DONE

- [ ] RSP-01~10을 각각 검증하고 미검증 행을 통과로 표시하지 않았다.
- [ ] 첫 배치 12개 및 필터 후 12개 미만 모두 다음 사용자 스크롤에서 자동으로 이어진다.
- [ ] 정상 흐름에 수동 “더 찾기” 버튼이 없다.
- [ ] 무진전/실패/종료에서 무한 요청·무한 로더가 없다.
- [ ] 요소 줄이기 유무와 관계없이 카드 footer 및 추가 행동이 정렬되고 모든 실제 행동의 터치 영역이 44×44pt 이상이다.
- [ ] 200개 초과 seen 기록을 보존하면서 outgoing `exclude_ids`가 최대 200개이고, 긴 세션의 추가 로딩에서 `INVALID_REQUEST` 400이 없다.
- [ ] 기존 테스트, 타입 검사, 린트가 통과한다.

# 변경 가능 파일

```text
app/search.tsx
src/hooks/usePersonalizedRecommendations.ts
src/utils/recommendationFeed.ts
src/utils/recommendationFeed.test.ts
src/utils/recommendationSession.ts
src/utils/recommendationSession.test.ts
src/components/content/PersonalizedRecommendationGalleryCard.tsx
```

# 보고 항목

실패했던 테스트 출력과 수정 후 결과, RSP-01~10 각각의 검증 상태, `npm test`·`npm run typecheck`·`npm run lint` 결과, 남은 운영 검증 사항을 보고한다.

# 금지사항

Edge Function 배포·DB 마이그레이션·추천 필터 저장 구조 변경·무관한 리팩터링을 하지 않는다. 테스트를 통과시키려고 assertion을 완화하지 않는다. 테스트 표의 행을 줄이지 않는다. 테스트에서 React Native·Supabase 모듈을 import하지 않는다.
