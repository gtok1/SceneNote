# 53. 추천 이어 찾기 스켈레톤 정렬 정정

작성일: 2026-10-10
대상 브랜치 기준: `main` (`c6a0e7e`) + 미커밋 작업(`docs/48`~`52` 구현). 이 시점 `npm test` 1067개 중 1066개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/52`(이어 찾기 중 스켈레톤 D-4)

> **근거.** 사용자 캡처(웹, 갤러리 6열). 실제 추천 카드 줄 아래 회색 스켈레톤 두 줄이 좌우로 안쪽에 들어가 있고 카드 폭이 좁다.
> 사용자 요청: "정렬 수정 명세서랑 짧은 프롬프트 작성해줘."

---

## 1. 문제 정의
| ID | 증상 |
|----|------|
| A-1 | 이어 찾기 스켈레톤이 실제 카드 열과 맞지 않는다. 좌우가 각 약 24px 안쪽이고 카드 폭이 좁다(갤러리). |

## 2. 근본 원인
`app/search.tsx` 1122~1126행. 스켈레톤이 추천 피드 `ListFooterComponent` 안의 `View style={[styles.loadMoreFooter, styles.topUpFooter]}`에 들어 있다.

| 요소 | 좌우 여백 |
|------|----------|
| 실제 카드 셀(`PersonalizedRecommendationGalleryCard` `cell`) | 셀 안쪽 `spacing.sm`(8)만 |
| `styles.loadMoreFooter`(1755행) | `paddingHorizontal: spacing.lg`(16). `topUpFooter`가 이를 지우지 않음 |
| `LoadingSkeleton` 추천 격자(`recommendationGrid`) | 격자 바깥 `padding: spacing.sm`(8) + 셀 안쪽 8 |

결과: 스켈레톤 셀은 실제 셀보다 좌우 16 + 8 = **24px씩 안쪽**에서 시작하고, 퍼센트 폭이 줄어든 폭 기준이라 더 좁다.

첫 로딩 스켈레톤(915행)은 정렬이 맞다. 목록 머리글의 `paddingHorizontal: displayedAsGallery ? spacing.sm : spacing.lg` 안에서 `styles.sharedInset`(`marginHorizontal: -spacing.lg`)으로 감싸, 격자 바깥 여백을 상쇄하기 때문이다.

## 3. 재현
1. 웹 1440, 검색 탭 추천을 갤러리로 둔다.
2. 아래로 스크롤해 다음 묶음을 부른다(또는 첫 화면이 12개 미만일 때).
3. 스켈레톤 첫 카드의 왼쪽 끝이 위 실제 카드 왼쪽 끝보다 약 24px 오른쪽에 있다.

## 4. 설계 결정
- **D-1.** 이어 찾기 스켈레톤은 **첫 로딩 스켈레톤과 같은 감싸기**를 쓴다. 바깥에 `paddingHorizontal: displayedAsGallery ? spacing.sm : spacing.lg`, 그 안에 `styles.sharedInset`, 그 안에 `LoadingSkeleton`이다. 실측으로 맞는 기존 구성을 재사용해 갤러리·목록(자세히) 보기 모두 첫 로딩과 같은 위치가 된다.
- **D-2.** 이어 찾기 꼬리말의 바깥 `View`에는 좌우 여백을 주지 않는다(`loadMoreFooter`를 쓰지 않는다). 상하 여백 `spacing.md`는 유지한다. 안내 줄("추천을 더 찾고 있어요 · n/목표")만 기존 `loadMoreFooter` 모양(가운데 정렬, 좌우 `spacing.lg`)으로 스켈레톤 아래에 둔다.
- **D-3.** `LoadingSkeleton` 공용 컴포넌트는 바꾸지 않는다(13곳에서 쓴다). `styles.loadMoreFooter`도 다른 꼬리말이 쓰므로 바꾸지 않는다.
- **D-4.** 스켈레톤 개수·표시 조건·문구(`recommendationTopUpStatus`, `docs/52`)는 바꾸지 않는다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 5. 기각한 대안
| 대안 | 기각 이유 |
|------|----------|
| `LoadingSkeleton`에 여백 없는 옵션 추가 | 공용 컴포넌트 변경. 이미 맞는 감싸기(D-1)가 화면에 있다 |
| `loadMoreFooter`의 좌우 여백 제거 | 다른 꼬리말(종료·오류·로딩 문구)의 모양이 바뀐다 |
| 스켈레톤을 FlashList 데이터에 가짜 항목으로 넣기 | 셀 재사용·키·추가 잠금(`docs/43`) 로직에 섞인다 |

## 6. 계약 (화면)
`app/search.tsx` 추천 피드 `ListFooterComponent`의 `topUp.active` 분기를 아래 구조로 바꾼다.
```tsx
<View accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.topUpFooter}>
  <View style={{ paddingHorizontal: displayedAsGallery ? spacing.sm : spacing.lg }}>
    <View style={styles.sharedInset}>
      <LoadingSkeleton variant="recommendation-card" count={topUp.placeholderCount} columns={displayedAsGallery ? galleryColumns : 1} />
    </View>
  </View>
  <View style={styles.loadMoreFooter}>
    <Text accessibilityLiveRegion="polite" style={styles.loadMoreText}>{topUp.text}</Text>
  </View>
</View>
```
- `styles.topUpFooter`는 `{ paddingVertical: spacing.md }`로 바꾼다. 다른 곳에서 쓰지 않으면 기존 `alignItems`·`flexDirection` 값은 지운다.
- 접근성 속성(`progressbar`·`busy`·`polite`)은 그대로다.

## 7~8. 데이터·화면 명세
데이터 변경 없음. 화면은 6장 그대로다.

## 9. 엣지 케이스
| # | 상황 | 기대 |
|---|------|------|
| E-1 | 갤러리 6열(웹 1440) | 스켈레톤 각 칸의 왼쪽·오른쪽 끝이 위 실제 카드와 1px 안쪽으로 일치 |
| E-2 | 갤러리 2열(웹 375) | 같음 |
| E-3 | 목록(자세히) 보기 | 첫 로딩 스켈레톤과 같은 위치·폭 |
| E-4 | 앱(iOS) 갤러리 | E-1과 같음, 가로 넘침 없음 |
| E-5 | 안내 줄 | 스켈레톤 아래 가운데, 글자 1.3배에서 잘림 없음 |

## 10. 테스트 표
스타일 구성만 바뀌어 새 단위 테스트는 없다. 기존 테스트(특히 `docs/52` U-1~U-7)는 수정 없이 통과해야 한다.

### 수동 확인 (UI-14.3)
| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 갤러리 | 개발자 도구에서 마지막 실제 카드 줄 첫 카드와 스켈레톤 첫 카드의 `getBoundingClientRect().left`·`width` 차이가 각 1px 이하 |
| M-2 | 웹 375 갤러리·목록 | M-1과 같은 비교, 가로 스크롤 없음 |
| M-3 | 앱(iOS 세로) | 정렬 일치, 안내 줄 잘림 없음 |

## 11. 변경 파일
| 파일 | 변경 |
|------|------|
| `app/search.tsx` | 6장 분기 구조, `topUpFooter` 스타일 |

## 12. 범위 밖
| 항목 | 이유 |
|------|------|
| `LoadingSkeleton` 내부·다른 사용처 | D-3 |
| 스켈레톤 카드 높이가 실제 카드와 다른 점 | 모양 근사치. 별도 |
| 이어 찾기 대기 시간 자체 | `docs/52` 진단 값으로 별도 판단 |

## 13. 확실하지 않음
- 목록(자세히) 보기의 실제 행 위치는 첫 로딩 스켈레톤 기준과 같다고 판단했다. M-2에서 확인한다.

## 14. Codex 실행 지시

# ROLE & GOAL
너는 SceneNote(React Native + Expo Router) 리포의 구현 담당이다.
검색 탭 추천의 이어 찾기 스켈레톤(`docs/52` D-4)이 실제 카드 열보다 좌우 24px 안쪽에 그려진다. 이를 첫 로딩 스켈레톤과 같은 감싸기로 정렬한다. 스타일 정정 작업이다.

# READ FIRST
1. `docs/00_ui_style_rules.md` — 웹·앱 공통 UI 규칙.
2. 이 명세서 1~13장(원인 2장, D-1~D-4, 6장 구조).
3. `app/search.tsx` 912~925행(첫 로딩 스켈레톤 감싸기), 691행(`ListHeaderComponent` 좌우 여백), 1116~1135행(추천 꼬리말), 1448행(`sharedInset`), 1751~1763행(`topUpFooter`·`loadMoreFooter`).
4. `src/components/common/LoadingSkeleton.tsx`(읽기만, `recommendationGrid` 여백).

# 시작 상태 (반드시 유지)
- `git status`와 `npm test`를 기록한다. 기준선은 1067개 중 1066개 통과다(기존 실패 1개는 무관, 건드리지 않음). 그 외 실패가 있으면 멈추고 보고한다.
- 다른 미커밋 변경을 되돌리거나 포맷하지 않는다.

# 바꾸면 안 되는 설계 결정
- **D-1 (최우선).** 스켈레톤 감싸기는 첫 로딩과 같다: `paddingHorizontal: displayedAsGallery ? spacing.sm : spacing.lg` → `styles.sharedInset` → `LoadingSkeleton`.
- **D-2.** 꼬리말 바깥 `View`에는 좌우 여백이 없다(`styles.topUpFooter = { paddingVertical: spacing.md }`). 안내 줄만 `styles.loadMoreFooter` 안에 둔다.
- **D-3.** `LoadingSkeleton`·`styles.loadMoreFooter`·다른 꼬리말 분기는 바꾸지 않는다.
- **D-4.** `recommendationTopUpStatus`와 그 사용(개수·조건·문구)은 바꾸지 않는다.

# STEP 1 — 수정
`app/search.tsx`의 `topUp.active ? (...)` 분기를 6장 구조로 교체하고 `topUpFooter` 스타일을 고친다. 새 스타일은 토큰만 쓴다.

# STEP 2 — 확인
- 웹 8081(로그인 대행 금지)에서 확인할 수 있으면 M-1·M-2를 측정한다. 할 수 없으면 사유를 보고한다.

# 엣지 케이스
9장 E-1~E-5 전부.

# 검증 명령
```
npm test
npm run typecheck
npm run lint
git diff -U0 -- app/search.tsx | grep -E '^\+' | grep -nE "#[0-9A-Fa-f]{3,6}\b|rgba?\(|fontWeight: \"|fontSize: [0-9]|Alert\.alert"
```
- `npm test`: 기준선 1066개 통과에서 줄지 않음, 기존 실패 1개 외 실패 0.
- 마지막 grep(추가한 줄) 0줄.

# DEFINITION OF DONE
- [ ] `topUp.active` 분기가 6장 구조다(첫 로딩과 같은 감싸기)
- [ ] `topUpFooter`에 좌우 여백이 없고, 안내 줄은 `loadMoreFooter` 안에 있다
- [ ] `LoadingSkeleton`·`loadMoreFooter`·다른 분기 diff가 없다
- [ ] `typecheck`·`lint` 통과, 토큰 grep 0줄
- [ ] 웹·앱 수동 확인 결과(또는 못 한 사유)를 보고했다

# 변경해야 할 파일 (이 외 파일 수정 금지)
```
app/search.tsx
```

# 보고 항목
1. 변경한 분기·스타일 diff 요약
2. `npm test` before / after, `typecheck`·`lint` 결과, 토큰 grep 결과
3. M-1~M-3 결과(웹/앱 구분, 못 한 항목과 사유)
4. D-N 중 문제가 있다고 판단한 항목(바꾸지 말고 보고만)

# 금지사항
- 배포 명령(`npx supabase functions deploy` 등)을 실행하지 않는다. 배포는 사람이 한다.
- DB 마이그레이션 파일을 만들지 않는다.
- 공용 컴포넌트·다른 꼬리말·스켈레톤 표시 조건을 바꾸지 않는다. 리팩터링·"김에 고치기" 금지.
- 로그인 대행 금지.
