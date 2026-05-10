---
name: SceneNote FE 아키텍처 결정 사항
description: 08_frontend_architecture.md에서 확정된 라우트 구조, 상태관리 분리, 컴포넌트 API, 성능 패턴
type: project
---

## 라우트 구조 (확정)

```
app/
  _layout.tsx              — Root layout, Supabase Auth 초기화
  (auth)/
    onboarding.tsx         — SCR-001
    login.tsx              — SCR-002
  (tabs)/
    index.tsx              — SCR-003 라이브러리
    search.tsx             — SCR-004+005 검색
    profile.tsx            — SCR-014 My Page
  content/[id]/
    index.tsx              — SCR-006+008 콘텐츠 상세
    episodes.tsx           — SCR-009
    pins.tsx               — SCR-011 작품 단위 핀
  pins/
    [id].tsx               — SCR-010 편집
    new.tsx                — SCR-010 생성 (contentId, episodeId? search params)
  tags/[tagId].tsx         — SCR-013
```

## Query Key 컨벤션 (확정)

```typescript
queryKeys.pins.byEpisode(userId, episodeId)
queryKeys.pins.byContent(userId, contentId)
queryKeys.pins.byTag(userId, tagId)
queryKeys.pins.single(pinId)
queryKeys.library.byStatus(userId, status)
queryKeys.content.detail(apiSource, externalId)
queryKeys.content.episodes(contentId, seasonId)
queryKeys.tags.all(userId)
queryKeys.search.results(query, mediaType, page)
```

## Stale Time 확정값

| 데이터 | staleTime |
|--------|-----------|
| 핀 목록 | 30초 |
| 라이브러리 | 1분 |
| 태그 목록 | 2분 |
| 검색 결과 | 5분 |
| 콘텐츠 상세 | 10분 |
| 에피소드 목록 | 10분 |

## 상태관리 분리 (확정)

- Zustand: authStore (session, user, setSession, reset) — AsyncStorage persist
- Zustand: appUIStore (toasts, addToast, removeToast) — 인메모리
- Jotai: pinFormDraftAtom, selectedEpisodeFilterAtom, selectedTagFilterIdsAtom, revealedSpoilerPinIdsAtom, libraryStatusFilterAtom, selectedSeasonIdAtom

## Optimistic Update 대상 (확정, 04_architecture.md)

- Yes: 에피소드 진행률 체크/언체크, 핀 삭제, 감상 상태 변경
- No (MVP): 핀 생성, 라이브러리 추가

## 컴포넌트 API 결정 (확정)

- PinComposer: `mode: 'create' | 'edit'`, `episodeId: string | null` (null = 영화)
- TimecodeInput: `onChangeSeconds: (seconds: number | null) => void` — 정수 초로 변환하여 콜백
- PinTimelineList: FlashList 기반, `estimatedItemSize={120}`
- 스포일러 블러: `isSpoilerRevealed` prop으로 전달, Jotai `revealedSpoilerPinIdsAtom`으로 관리
- 화면 unmount 시 `revealedSpoilerPinIdsAtom` 초기화 (useEffect cleanup)

## FlashList estimatedItemSize 값

- 핀 목록: 120
- 라이브러리 목록: 88
- 검색 결과: 80
- 에피소드 목록: 64

## 디자인 토큰 (확정)

```typescript
colors.primary = '#5B4FF5'
colors.background = '#FFFFFF'
colors.surface = '#F8F8FB'
colors.border = '#E5E5EA'
colors.error = '#FF3B30'
spacing: 4/8/12/16/20/24/32
fontSizes: sm=13, md=15, lg=17, xl=22
radii: sm=8, md=12, lg=16
```

터치 타겟: 모든 요소 minHeight 44, 아이콘 버튼 hitSlop 8

## 영화 핀 처리 (확정)

- episode_id = null (가상 에피소드 레코드 생성 안 함)
- usePins에서 episodeId = null이면 `.eq('content_id', contentId).is('episode_id', null)`
- PinComposer에서 episodeId prop이 null이면 에피소드 컨텍스트 UI 미표시

## 타임코드 유틸 함수 위치

`lib/timecodeUtils.ts` — parseTimecodeToSeconds, formatSecondsToTimecode, autoFormatTimecodeInput

## React.memo 적용 필수 컴포넌트

PinTimelineItem, ContentCard, SearchResultItem, TagChip, EpisodeRow (FlashList 아이템 전체)

**How to apply:** 새 컴포넌트/화면 설계 시 이 결정들을 기본값으로 사용. 변경 전 문서 업데이트 필요.
