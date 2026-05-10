# SceneNote — 프론트엔드 아키텍처 설계 문서

**버전:** 1.0.0
**작성일:** 2026-05-02
**작성자:** RN Expo UI Architect
**상태:** 확정 (MVP 기준)
**기반 문서:** 01_product_requirements.md, 03_screen_flow.md, 04_architecture.md, 07_edge_functions.md, 09_timeline_pin_ux.md

---

## 목차

1. [Expo Router 화면 구조](#1-expo-router-화면-구조)
2. [상태 관리 구조](#2-상태-관리-구조)
3. [재사용 컴포넌트 구조](#3-재사용-컴포넌트-구조)
4. [TimecodeInput UX 구현](#4-timecodeinput-ux-구현)
5. [PinComposer 구현](#5-pincomposer-구현)
6. [동일 시간대 여러 핀 UI 처리](#6-동일-시간대-여러-핀-ui-처리)
7. [스포일러 핀 UI 처리](#7-스포일러-핀-ui-처리)
8. [TanStack Query Hook 예시](#8-tanstack-query-hook-예시)
9. [에러/로딩/빈 상태 처리 패턴](#9-에러로딩빈-상태-처리-패턴)
10. [영화 핀 처리 (episodeId = null)](#10-영화-핀-처리-episodeid--null)
11. [성능 최적화 방침](#11-성능-최적화-방침)
12. [디자인 토큰 (MVP 최소 정의)](#12-디자인-토큰-mvp-최소-정의)
13. [개발 우선순위 (P0~P3)](#13-개발-우선순위-p0p3)

---

## 1. Expo Router 화면 구조

### 1.1 전체 라우트 트리

```
app/
  _layout.tsx                  — Root layout: Supabase Auth 세션 초기화, authStore 연결
  (auth)/
    _layout.tsx                — 인증 전용 Stack navigator
    onboarding.tsx             — SCR-001: 온보딩 슬라이드
    login.tsx                  — SCR-002: 로그인 / 회원가입 탭 전환
  (tabs)/
    _layout.tsx                — Bottom tab navigator (홈 / 검색 / My Page)
    index.tsx                  — SCR-003: 홈 / 라이브러리
    search.tsx                 — SCR-004 + SCR-005: 검색 + 결과 (단일 화면 상태 전환)
    profile.tsx                — SCR-014: My Page
  content/
    [id]/
      index.tsx                — SCR-006 + SCR-008: 콘텐츠 상세 / 시청 중 상세
      episodes.tsx             — SCR-009: 시즌/에피소드 선택 + 진행률 체크
      pins.tsx                 — SCR-011: 콘텐츠별 핀 타임라인 (작품 단위)
  pins/
    [id].tsx                   — SCR-010: 핀 상세 / 편집
    new.tsx                    — SCR-010: 핀 생성 (contentId, episodeId를 search param으로 수신)
  tags/
    [tagId].tsx                — SCR-013: 태그별 핀 목록
```

**라우팅 파라미터 컨벤션:**

```typescript
// app/content/[id]/index.tsx
// useLocalSearchParams<{ id: string }>()
// id = contents.id (UUID)

// app/pins/[id].tsx
// useLocalSearchParams<{ id: string }>()
// id = timeline_pins.id (UUID)

// app/pins/new.tsx
// useLocalSearchParams<{ contentId: string; episodeId?: string }>()
// episodeId 없을 경우 영화 핀으로 처리

// app/tags/[tagId].tsx
// useLocalSearchParams<{ tagId: string }>()
```

---

### 1.2 각 라우트 상세 정의

#### `app/(auth)/onboarding.tsx` — SCR-001

- **화면 목적:** 신규 사용자에게 앱의 핵심 가치(감상 기록 + 타임라인 핀)를 소개하고 회원가입/로그인으로 유도
- **필요한 데이터:** 없음 (정적 화면)
- **주요 컴포넌트:** `OnboardingSlide`, `SocialLoginButton`, 텍스트 링크
- **로딩/에러/빈 상태:** 해당 없음
- **MVP 포함 여부:** Yes (P0)

#### `app/(auth)/login.tsx` — SCR-002

- **화면 목적:** 이메일/소셜 로그인 및 회원가입
- **필요한 데이터:** 없음 (Supabase Auth 직접 호출)
- **주요 컴포넌트:** React Hook Form + Zod 기반 이메일/비밀번호 폼, `SocialLoginButton`
- **로딩/에러/빈 상태:** 제출 중 버튼 로딩 스피너, 인라인 필드 오류 메시지
- **MVP 포함 여부:** Yes (P0)

#### `app/(tabs)/index.tsx` — SCR-003

- **화면 목적:** 사용자 라이브러리 목록을 감상 상태 탭으로 필터링하여 표시
- **필요한 데이터:** `useLibrary(userId, statusFilter)` — TanStack Query
- **주요 컴포넌트:** `ContentCard` (FlashList), `WatchStatusBadge`, `EmptyState`, `LoadingSkeleton`
- **로딩/에러/빈 상태:**
  - 로딩: `LoadingSkeleton` (카드 3개 플레이스홀더)
  - 빈 상태: "작품을 검색해서 추가해보세요" + 검색 탭 이동 버튼
  - 에러: `ErrorState` + 재시도 버튼
- **MVP 포함 여부:** Yes (P0)

#### `app/(tabs)/search.tsx` — SCR-004 + SCR-005

- **화면 목적:** 외부 API를 통한 콘텐츠 검색 및 결과 목록 표시 (단일 화면 내 상태 전환)
- **필요한 데이터:** `useSearchContent(query, mediaType, page)` — TanStack Query (enabled: query.length > 0)
- **주요 컴포넌트:** `ContentSearchBar`, `SearchResultItem` (FlashList), `WatchStatusBadge`, `EmptyState`, `LoadingSkeleton`
- **로딩/에러/빈 상태:**
  - 검색 전: 안내 문구 (최근 검색어는 P2)
  - 로딩: `LoadingSkeleton` (결과 카드 5개)
  - 결과 없음: `EmptyState` "검색어를 바꿔보세요"
  - 에러: `ErrorState` + 재시도 버튼 + partial 실패 안내 배너
- **MVP 포함 여부:** Yes (P0)

#### `app/(tabs)/profile.tsx` — SCR-014

- **화면 목적:** 사용자 프로필, 감상 통계, 태그 목록 접근, 로그아웃
- **필요한 데이터:** `useProfile(userId)`, `useLibraryStats(userId)` — TanStack Query
- **주요 컴포넌트:** 통계 카드, 메뉴 목록, 로그아웃/탈퇴 버튼
- **로딩/에러/빈 상태:** 통계 로드 실패 시 각 수치 "--" 표시
- **MVP 포함 여부:** Yes (P1)

#### `app/content/[id]/index.tsx` — SCR-006 + SCR-008

- **화면 목적:** 검색 결과에서 선택한 콘텐츠 상세 정보 표시 + 라이브러리 추가 CTA. 이미 라이브러리에 있는 경우 시청 중 상세 뷰로 전환
- **필요한 데이터:**
  - `useContentDetail(apiSource, externalId)` — Edge Function EF-002 호출
  - `useLibraryStatus(userId, externalId, apiSource)` — TanStack Query
- **주요 컴포넌트:** 포스터 이미지 (`expo-image`), `WatchStatusBadge`, 핀 요약 (`PinTimelineItem` 3개), 라이브러리 추가 바텀 시트
- **로딩/에러/빈 상태:**
  - 포스터 없음: 플레이스홀더 이미지
  - 줄거리 없음: "줄거리 정보가 없습니다"
  - 에러: `ErrorState`
- **MVP 포함 여부:** Yes (P0)

#### `app/content/[id]/episodes.tsx` — SCR-009

- **화면 목적:** 시즌 탭 전환, 에피소드 진행률 체크, 에피소드별 핀 추가 진입
- **필요한 데이터:**
  - `useSeasons(contentId)` — Supabase 직접 쿼리
  - `useEpisodes(contentId, seasonId)` — Edge Function EF-004 호출 (lazy)
  - `useEpisodeProgress(userId, contentId)` — Supabase 직접 쿼리
- **주요 컴포넌트:** `SeasonSelector`, `EpisodeSelector` (FlashList), `WatchStatusBadge`, `EmptyState`
- **로딩/에러/빈 상태:**
  - 에피소드 로딩: `LoadingSkeleton` (행 5개)
  - 에러: `ErrorState` + 재시도 버튼
  - 단일 시즌: `SeasonSelector` 탭 미표시
- **MVP 포함 여부:** Yes (P0)

#### `app/content/[id]/pins.tsx` — SCR-011 (작품 단위)

- **화면 목적:** 특정 작품의 전체 핀 타임라인 목록 (에피소드 필터 + 태그 필터 포함)
- **필요한 데이터:**
  - `usePins(contentId, null)` — 작품 전체 핀
  - `useTags(userId)` — 태그 필터 칩용
- **주요 컴포넌트:** `PinTimelineList`, `PinTimelineItem`, `TagChip` (수평 스크롤), `SpoilerToggle`, FAB
- **로딩/에러/빈 상태:**
  - 빈 상태: "아직 핀이 없어요. 에피소드에서 첫 핀을 남겨보세요!" + FAB 강조
  - 에러: `ErrorState` + 재시도
- **MVP 포함 여부:** Yes (P0)

#### `app/pins/[id].tsx` — SCR-010 (편집)

- **화면 목적:** 기존 핀 상세 보기 및 편집, 삭제
- **필요한 데이터:** `usePin(pinId)` — Supabase 직접 쿼리
- **주요 컴포넌트:** `PinComposer` (편집 모드), `TimecodeInput`
- **MVP 포함 여부:** Yes (P1)

#### `app/pins/new.tsx` — SCR-010 (생성)

- **화면 목적:** 새 핀 생성. `contentId`, `episodeId` (optional) search param 수신
- **필요한 데이터:** `useEpisode(episodeId)` (duration 검증용)
- **주요 컴포넌트:** `PinComposer` (생성 모드), `TimecodeInput`
- **MVP 포함 여부:** Yes (P0)

#### `app/tags/[tagId].tsx` — SCR-013

- **화면 목적:** 특정 태그가 달린 핀 목록 (여러 작품 포함)
- **필요한 데이터:** `usePinsByTag(userId, tagId)` — Supabase 직접 쿼리
- **주요 컴포넌트:** `PinTimelineList`, `PinTimelineItem`, `TagChip` 수평 스크롤
- **MVP 포함 여부:** Yes (P1/P2)

---

## 2. 상태 관리 구조

### 2.1 TanStack Query v5 설계

#### Query Key 컨벤션

04_architecture.md에서 확정된 구조를 그대로 사용한다.

```typescript
// lib/queryKeys.ts
export const queryKeys = {
  library: {
    all: (userId: string) => ['library', userId] as const,
    byStatus: (userId: string, status: WatchStatus | 'all') =>
      ['library', userId, 'status', status] as const,
  },
  content: {
    detail: (apiSource: string, externalId: string) =>
      ['content', 'detail', apiSource, externalId] as const,
    libraryStatus: (userId: string, externalId: string, apiSource: string) =>
      ['content', 'library-status', userId, externalId, apiSource] as const,
    seasons: (contentId: string) =>
      ['content', contentId, 'seasons'] as const,
    episodes: (contentId: string, seasonId: string) =>
      ['content', contentId, 'season', seasonId, 'episodes'] as const,
  },
  pins: {
    byContent: (userId: string, contentId: string) =>
      ['pins', userId, 'content', contentId] as const,
    byEpisode: (userId: string, episodeId: string) =>
      ['pins', userId, 'episode', episodeId] as const,
    byTag: (userId: string, tagId: string) =>
      ['pins', userId, 'tag', tagId] as const,
    single: (pinId: string) =>
      ['pins', 'single', pinId] as const,
  },
  tags: {
    all: (userId: string) => ['tags', userId] as const,
  },
  search: {
    results: (query: string, mediaType: string, page: number) =>
      ['search', query, mediaType, page] as const,
  },
  profile: {
    stats: (userId: string) => ['profile', userId, 'stats'] as const,
  },
  progress: {
    byContent: (userId: string, contentId: string) =>
      ['progress', userId, 'content', contentId] as const,
  },
} as const;
```

#### Stale Time 권고값

| 데이터 | staleTime | gcTime | 이유 |
|--------|-----------|--------|------|
| 검색 결과 | 5분 | 10분 | 외부 API 캐시 TTL 1시간 내에서 충분 |
| 콘텐츠 상세 | 10분 | 30분 | 메타데이터 변경 빈도 낮음 |
| 에피소드 목록 | 10분 | 30분 | DB가 캐시 역할 (fetch-episodes lazy) |
| 라이브러리 목록 | 1분 | 5분 | 사용자 데이터, 빠른 반영 필요 |
| 핀 목록 | 30초 | 2분 | 자주 생성/수정됨 |
| 태그 목록 | 2분 | 10분 | 비교적 안정적 |
| 에피소드 진행률 | 30초 | 2분 | 체크박스 토글 후 즉시 반영 |
| My Page 통계 | 5분 | 15분 | 실시간성 낮음 |

#### 캐시 무효화 전략 — 핀 생성/수정/삭제

```typescript
// hooks/mutations/useCreatePin.ts 에서 onSuccess 처리
const invalidatePinCaches = (
  queryClient: QueryClient,
  userId: string,
  contentId: string,
  episodeId: string | null,
  tagIds: string[]
) => {
  // 에피소드별 핀 목록 (가장 빈번한 뷰)
  if (episodeId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.pins.byEpisode(userId, episodeId),
    });
  }
  // 작품별 핀 목록
  queryClient.invalidateQueries({
    queryKey: queryKeys.pins.byContent(userId, contentId),
  });
  // 태그별 핀 목록 (태그가 달린 경우)
  tagIds.forEach((tagId) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.pins.byTag(userId, tagId),
    });
  });
  // 태그 목록 (핀 수 변화)
  queryClient.invalidateQueries({
    queryKey: queryKeys.tags.all(userId),
  });
};
```

#### Optimistic Update 적용 대상 (04_architecture.md 결정 사항)

| 작업 | Optimistic Update | 방법 |
|------|-------------------|------|
| 에피소드 진행률 체크/언체크 | Yes | `setQueryData`로 진행률 즉시 업데이트, 실패 시 `onError`에서 롤백 |
| 핀 삭제 | Yes | 목록에서 즉시 제거, 실패 시 롤백 |
| 감상 상태 변경 | Yes | `WatchStatusBadge` 즉시 변경 |
| 핀 생성 | No (MVP) | 서버 UUID 필요. 로딩 인디케이터로 처리 |
| 라이브러리 추가 | No (MVP) | Edge Function 경유, 로딩 스피너 처리 |

---

### 2.2 Zustand 전역 스토어

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';

interface AuthStore {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      setSession: (session) =>
        set({ session, user: session?.user ?? null }),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ session: null, user: null, isLoading: false }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // session 토큰만 persist — user 객체는 세션에서 파생
      partialize: (state) => ({ session: state.session }),
    }
  )
);
```

```typescript
// store/appUIStore.ts
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppUIStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useAppUIStore = create<AppUIStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
```

**Zustand 사용 원칙:**
- `authStore`: 세션, 유저 정보, 로딩 상태 — 앱 전역에서 접근 필요
- `appUIStore`: 토스트 메시지 큐 — 어느 화면에서든 토스트 발생 가능
- persist: authStore만 AsyncStorage 영속화. appUIStore는 인메모리만.

---

### 2.3 Jotai 화면별 원자 상태

```typescript
// atoms/pinFormAtoms.ts
import { atom } from 'jotai';

export interface PinFormDraft {
  timecodeInput: string;        // UI 표시용 문자열 "14:32"
  timestamp_seconds: number | null;  // DB 저장용 정수
  memo: string;
  tagInputText: string;         // 현재 입력 중인 태그 텍스트
  selectedTagNames: string[];   // 확정된 태그 이름 목록
  emotion: EmotionType | null;
  is_spoiler: boolean;
}

const initialPinFormDraft: PinFormDraft = {
  timecodeInput: '',
  timestamp_seconds: null,
  memo: '',
  tagInputText: '',
  selectedTagNames: [],
  emotion: null,
  is_spoiler: false,
};

export const pinFormDraftAtom = atom<PinFormDraft>(initialPinFormDraft);
export const resetPinFormAtom = atom(null, (get, set) => {
  set(pinFormDraftAtom, initialPinFormDraft);
});

// atoms/pinFilterAtoms.ts
import { atom } from 'jotai';

export const selectedEpisodeFilterAtom = atom<string | null>(null);
export const selectedTagFilterIdsAtom = atom<string[]>([]);

// 파생 원자: 두 필터 모두 초기화
export const resetPinFiltersAtom = atom(null, (get, set) => {
  set(selectedEpisodeFilterAtom, null);
  set(selectedTagFilterIdsAtom, []);
});

// atoms/spoilerAtoms.ts
import { atom } from 'jotai';

// 세션 내 블러 해제된 핀 ID Set (화면 이탈 후 재진입 시 초기화)
export const revealedSpoilerPinIdsAtom = atom<Set<string>>(new Set());

// atoms/libraryAtoms.ts
import { atom } from 'jotai';
import type { WatchStatus } from '../types';

export const libraryStatusFilterAtom = atom<WatchStatus | 'all'>('all');

// atoms/episodeAtoms.ts
import { atom } from 'jotai';

export const selectedSeasonIdAtom = atom<string | null>(null);
export const selectedEpisodeIdAtom = atom<string | null>(null);
```

---

### 2.4 서버 상태와 UI 상태 경계 요약

```
서버 상태 (TanStack Query)             UI 상태 (Zustand / Jotai)
─────────────────────────             ─────────────────────────────
핀 목록 데이터                          핀 목록 필터 (episodeFilterAtom, tagFilterIdsAtom)
라이브러리 데이터                        라이브러리 탭 필터 (libraryStatusFilterAtom)
에피소드 목록                           시즌 탭 선택 (selectedSeasonIdAtom)
태그 목록 (DB)                         핀 편집 폼 입력값 (pinFormDraftAtom)
검색 결과                              검색어 입력 상태 (로컬 useState)
콘텐츠 상세 메타데이터                   스포일러 블러 해제 세트 (revealedSpoilerPinIdsAtom)
에피소드 진행률                         토스트 메시지 큐 (appUIStore)
My Page 통계                           인증 세션 / 유저 (authStore — Zustand persist)
```

---

## 3. 재사용 컴포넌트 구조

### 3.1 디렉터리 구조

```
components/
  content/
    ContentCard.tsx
    SearchResultItem.tsx
    ContentSearchBar.tsx
    WatchStatusBadge.tsx
  episode/
    SeasonSelector.tsx
    EpisodeSelector.tsx
    EpisodeRow.tsx
  pin/
    PinComposer.tsx
    PinTimelineList.tsx
    PinTimelineItem.tsx
    TimecodeInput.tsx
    EmotionSelector.tsx
    TagInput.tsx
    TagChip.tsx
    SpoilerToggle.tsx
  common/
    EmptyState.tsx
    ErrorState.tsx
    LoadingSkeleton.tsx
    BottomSheet.tsx
```

---

### 3.2 콘텐츠 관련 컴포넌트

```typescript
// components/content/ContentCard.tsx

import type { UserLibraryItem } from '../../types';

interface ContentCardProps {
  content: UserLibraryItem;
  onPress: () => void;
  // 리렌더링 최적화: React.memo + onPress는 useCallback으로 전달
}

// UserLibraryItem 타입
interface UserLibraryItem {
  library_item_id: string;
  status: WatchStatus;
  added_at: string;
  content_id: string;
  title_primary: string;
  poster_url: string | null;
  content_type: 'anime' | 'kdrama' | 'jdrama' | 'movie' | 'other';
  air_year: number | null;
  pin_count: number;
}

// WatchStatus — DB enum과 동기
type WatchStatus = 'wishlist' | 'watching' | 'completed' | 'dropped';
```

```typescript
// components/content/SearchResultItem.tsx

import type { ContentSearchResult } from '../../types';

interface SearchResultItemProps {
  result: ContentSearchResult;
  isInLibrary: boolean;                          // 이미 라이브러리에 있는지 여부
  currentStatus?: WatchStatus;                    // 라이브러리에 있을 때 현재 감상 상태
  onAddToLibrary: (result: ContentSearchResult) => void;
  onPress: (result: ContentSearchResult) => void;
}

// ContentSearchResult — 07_edge_functions.md EF-001 응답 타입과 동일
interface ContentSearchResult {
  external_source: 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze';
  external_id: string;
  content_type: 'anime' | 'kdrama' | 'jdrama' | 'movie' | 'other';
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  has_seasons: boolean;
  episode_count: number | null;
}
```

```typescript
// components/content/ContentSearchBar.tsx

interface ContentSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  mediaTypeFilter: 'all' | 'anime' | 'drama' | 'movie';
  onMediaTypeChange: (type: 'all' | 'anime' | 'drama' | 'movie') => void;
  autoFocus?: boolean;
}
```

```typescript
// components/content/WatchStatusBadge.tsx

interface WatchStatusBadgeProps {
  status: WatchStatus;
  size?: 'sm' | 'md';
  // accessibilityLabel은 내부에서 status에 따라 자동 생성
}

// 표시 텍스트 매핑
const STATUS_LABEL: Record<WatchStatus, string> = {
  wishlist: '보고 싶음',
  watching: '보는 중',
  completed: '완료',
  dropped: '드랍',
};
```

---

### 3.3 에피소드/시즌 관련 컴포넌트

```typescript
// components/episode/SeasonSelector.tsx

interface Season {
  id: string;
  season_number: number;
  title: string | null;
  episode_count: number | null;
}

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeasonId: string | null;
  onSelect: (seasonId: string) => void;
  // 단일 시즌이면 이 컴포넌트 자체를 렌더링하지 않음 (부모에서 조건부)
}
```

```typescript
// components/episode/EpisodeSelector.tsx

interface Episode {
  id: string;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  duration_seconds: number | null;
}

interface UserEpisodeProgress {
  episode_id: string;
  watched_at: string;
}

interface EpisodeSelectorProps {
  episodes: Episode[];
  selectedEpisodeId: string | null;
  onSelect: (episodeId: string) => void;
  progress: Record<string, UserEpisodeProgress>;  // key: episode_id
  onToggleProgress: (episodeId: string, contentId: string) => void;
  onAddPin: (episodeId: string) => void;
  pinCounts: Record<string, number>;              // key: episode_id, value: 핀 수
}
// 200+ 에피소드: FlashList 사용, estimatedItemSize={64}
```

---

### 3.4 핀 관련 컴포넌트

```typescript
// components/pin/TimecodeInput.tsx

interface TimecodeInputProps {
  value: string;                           // 표시용 문자열 "14:32" 또는 "1:23:45"
  onChangeSeconds: (seconds: number | null) => void;  // 정수 초로 변환하여 부모에 전달
  maxSeconds?: number | null;              // 에피소드 duration_seconds (초과 경고용)
  placeholder?: string;                    // 기본값: "00:00"
  hasError?: boolean;                      // 외부 에러 상태
  errorMessage?: string;
}
```

```typescript
// components/pin/PinComposer.tsx

interface PinComposerProps {
  contentId: string;
  episodeId: string | null;               // 영화는 null
  episodeDurationSeconds?: number | null; // 타임스탬프 초과 검증용
  defaultValues?: Partial<PinFormValues>; // 편집 모드: 기존 핀 데이터
  mode: 'create' | 'edit';
  pinId?: string;                         // 편집 모드 전용
  onSuccess: (pin: TimelinePin) => void;
  onCancel: () => void;
  onDelete?: () => void;                  // 편집 모드 전용
}
```

```typescript
// components/pin/PinTimelineList.tsx

interface PinTimelineListProps {
  pins: TimelinePin[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  spoilerRevealedIds: Set<string>;        // Jotai revealedSpoilerPinIdsAtom
  onPinPress: (pin: TimelinePin) => void;
  onPinLongPress?: (pin: TimelinePin) => void;
  onRevealSpoiler: (pinId: string) => void;
  ListHeaderComponent?: React.ReactElement;
  onEndReached?: () => void;              // 무한 스크롤 (작품 단위 핀 목록)
}
// FlashList 사용, estimatedItemSize={120}
```

```typescript
// components/pin/PinTimelineItem.tsx

interface TimelinePin {
  id: string;
  content_id: string;
  episode_id: string | null;
  timestamp_seconds: number | null;
  memo: string | null;
  emotion: EmotionType | null;
  is_spoiler: boolean;
  created_at: string;
  tags: Array<{ id: string; name: string }>;
}

interface PinTimelineItemProps {
  pin: TimelinePin;
  isSpoilerRevealed: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onRevealSpoiler: () => void;
}
// React.memo 적용 필수 (FlashList 아이템)
```

```typescript
// components/pin/TagChip.tsx

interface Tag {
  id: string;
  name: string;
}

interface TagChipProps {
  tag: Tag;
  selected?: boolean;                     // 필터 선택 상태
  onPress?: () => void;
  onRemove?: () => void;                  // 핀 편집 중 태그 제거
  size?: 'sm' | 'md';
}
// React.memo 적용 필수
```

```typescript
// components/pin/SpoilerToggle.tsx

interface SpoilerToggleProps {
  isSpoiler: boolean;
  onToggle: (value: boolean) => void;
  // 핀 편집 폼 내 토글 스위치
}
```

```typescript
// components/pin/EmotionSelector.tsx

type EmotionType =
  | 'moved'      // 감동 😭
  | 'excited'    // 설렘 🥰
  | 'nervous'    // 긴장 😰
  | 'surprised'  // 놀람 😮
  | 'happy'      // 즐거움 😄
  | 'sad'        // 슬픔 😢
  | 'angry'      // 분노 😤
  | 'scared'     // 공포 😱
  | 'empathy'    // 공감 🥺
  | 'best';      // 최고 🔥

interface EmotionSelectorProps {
  selected: EmotionType | null;
  onSelect: (emotion: EmotionType | null) => void;
  // 이미 선택된 감정 탭 시 null로 해제
}
// 수평 스크롤 FlatList (아이템 10개 — FlatList로 충분)
```

---

### 3.5 공통 상태 컴포넌트

```typescript
// components/common/EmptyState.tsx

interface EmptyStateProps {
  icon?: string;                          // expo/vector-icons 이름 또는 이모지
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// 화면별 사용 예시:
// <EmptyState title="아직 핀이 없어요" description="에피소드에서 첫 핀을 남겨보세요!" />
// <EmptyState title="검색 결과가 없어요" description="다른 키워드로 검색해 보세요" />
// <EmptyState title="라이브러리가 비어있어요" actionLabel="작품 검색하기" onAction={...} />
```

```typescript
// components/common/ErrorState.tsx

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;                   // 전체 화면 에러 vs 인라인 에러
}
```

```typescript
// components/common/LoadingSkeleton.tsx

type SkeletonVariant = 'content-card' | 'search-result' | 'pin-item' | 'episode-row';

interface LoadingSkeletonProps {
  variant: SkeletonVariant;
  count?: number;                         // 기본값: 3
}
// [선택 검토 필요] expo-linear-gradient 또는 react-native-skeleton-placeholder 사용 여부
// MVP에서는 단순 회색 사각형 플레이스홀더로 대체 가능
```

---

## 4. TimecodeInput UX 구현

### 4.1 시간값 변환 유틸리티 (공유)

```typescript
// lib/timecodeUtils.ts

/**
 * 문자열 타임코드를 정수 초로 변환
 * "14:32" → 872
 * "1:23:45" → 5025
 * 유효하지 않은 입력 → null
 */
export function parseTimecodeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return null;

  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/**
 * 정수 초를 표시용 문자열로 변환
 * 872 → "14:32"
 * 5025 → "1:23:45"
 */
export function formatSecondsToTimecode(seconds: number): string {
  if (seconds < 0) return '00:00';
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 숫자만 입력 시 자동 포맷 (blur 시 적용)
 * "1432"    → "14:32"
 * "132345"  → "1:23:45"
 * "532"     → "05:32"
 * "30"      → "00:30"
 */
export function autoFormatTimecodeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // 콜론이 이미 있는 경우: 그대로 반환 (사용자가 직접 입력)
  if (raw.includes(':')) return raw;

  if (digits.length <= 2) {
    return `00:${digits.padStart(2, '0')}`;
  }
  if (digits.length <= 4) {
    const m = digits.slice(0, digits.length - 2).padStart(2, '0');
    const s = digits.slice(-2);
    return `${m}:${s}`;
  }
  if (digits.length <= 6) {
    const h = digits.slice(0, digits.length - 4);
    const m = digits.slice(-4, -2).padStart(2, '0');
    const s = digits.slice(-2);
    return `${h}:${m}:${s}`;
  }
  // 7자리 이상: 앞 자리를 HH로
  const h = digits.slice(0, digits.length - 4);
  const m = digits.slice(-4, -2).padStart(2, '0');
  const s = digits.slice(-2);
  return `${h}:${m}:${s}`;
}
```

### 4.2 TimecodeInput 컴포넌트 구현

```typescript
// components/pin/TimecodeInput.tsx

import React, { useCallback, useState } from 'react';
import { TextInput, View, Text, StyleSheet } from 'react-native';
import {
  parseTimecodeToSeconds,
  autoFormatTimecodeInput,
  formatSecondsToTimecode,
} from '../../lib/timecodeUtils';
import { tokens } from '../../lib/designTokens';

interface TimecodeInputProps {
  value: string;
  onChangeSeconds: (seconds: number | null) => void;
  maxSeconds?: number | null;
  placeholder?: string;
  hasError?: boolean;
  errorMessage?: string;
}

export const TimecodeInput = React.memo<TimecodeInputProps>(
  ({
    value,
    onChangeSeconds,
    maxSeconds,
    placeholder = '00:00',
    hasError,
    errorMessage,
  }) => {
    const [localValue, setLocalValue] = useState(value);
    const [overflowWarning, setOverflowWarning] = useState<string | null>(null);

    const handleChangeText = useCallback((text: string) => {
      // 숫자와 콜론만 허용
      const filtered = text.replace(/[^0-9:]/g, '');
      setLocalValue(filtered);
      setOverflowWarning(null);

      // 입력 중: 콜론이 있고 유효한 형식이면 실시간으로 seconds 계산하여 부모에 전달
      const seconds = parseTimecodeToSeconds(filtered);
      onChangeSeconds(seconds);
    }, [onChangeSeconds]);

    const handleBlur = useCallback(() => {
      // blur 시: 자동 포맷 적용
      const formatted = autoFormatTimecodeInput(localValue);
      setLocalValue(formatted);

      const seconds = parseTimecodeToSeconds(formatted);
      onChangeSeconds(seconds);

      // 에피소드 길이 초과 경고 (soft warning — hard block은 저장 시 Zod refine에서)
      if (seconds !== null && maxSeconds !== null && maxSeconds !== undefined && seconds > maxSeconds) {
        setOverflowWarning(
          `입력한 시간(${formatted})이 에피소드 길이(${formatSecondsToTimecode(maxSeconds)})를 초과합니다.`
        );
      }
    }, [localValue, onChangeSeconds, maxSeconds]);

    const showError = hasError || !!overflowWarning;
    const displayError = errorMessage ?? overflowWarning;

    return (
      <View>
        <TextInput
          style={[
            styles.input,
            showError && styles.inputError,
          ]}
          value={localValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textTertiary}
          maxLength={8} // "HH:MM:SS"
          returnKeyType="done"
          accessibilityLabel="타임코드 입력"
          accessibilityHint="시간:분:초 형식으로 입력하세요 (예: 14:32 또는 1:23:45)"
          accessibilityRole="text"
        />
        {showError && displayError ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {displayError}
          </Text>
        ) : null}
      </View>
    );
  }
);

TimecodeInput.displayName = 'TimecodeInput';

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing[3],
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textPrimary,
    fontVariant: ['tabular-nums'], // 숫자 너비 고정
  },
  inputError: {
    borderColor: tokens.colors.error,
  },
  errorText: {
    marginTop: tokens.spacing[1],
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.error,
  },
});
```

### 4.3 5가지 시나리오별 동작

| 시나리오 | 입력 | 동작 |
|----------|------|------|
| MM:SS 입력 | "12:30" | blur 시 그대로 유지, seconds = 750 |
| HH:MM:SS 입력 | "1:02:30" | blur 시 그대로 유지, seconds = 3750 |
| 타임코드 0:00 | "0:00" 또는 빈 값 | seconds = 0 (onChangeSeconds(0)), 유효한 핀 |
| 에피소드 정보 없음 | 어떤 값이든 | maxSeconds = null → 초과 경고 없음, 저장 허용 |
| 메모만 작성 (타임코드 없음) | 빈 값 | onChangeSeconds(null), 메모가 있으면 저장 허용 |

---

## 5. PinComposer 구현

### 5.1 Zod 스키마 및 타입

```typescript
// lib/schemas/pinSchema.ts

import { z } from 'zod';

export const emotionValues = [
  'moved', 'excited', 'nervous', 'surprised', 'happy',
  'sad', 'angry', 'scared', 'empathy', 'best',
] as const;

export type EmotionType = typeof emotionValues[number];

export const pinSchema = z.object({
  // UI 입력용 — DB에는 저장하지 않음
  timecodeInput: z.string().optional(),

  // DB 저장용 — 정수 초
  timestamp_seconds: z.number().int().min(0).nullable(),

  memo: z.string().max(500, '메모는 500자 이하로 입력해 주세요').nullable(),

  // 태그 이름 목록 (태그 find-or-create는 저장 시 처리)
  tagNames: z.array(z.string().max(20)).max(10, '태그는 최대 10개까지 입력할 수 있어요'),

  emotion: z.enum(emotionValues).nullable(),

  is_spoiler: z.boolean().default(false),
}).refine(
  (data) => data.timestamp_seconds !== null || (data.memo !== null && data.memo.trim().length > 0),
  {
    message: '타임코드 또는 메모 중 하나는 입력해야 합니다',
    path: ['timecodeInput'],
  }
);

export type PinFormValues = z.infer<typeof pinSchema>;
```

### 5.2 PinComposer 컴포넌트 구현

```typescript
// components/pin/PinComposer.tsx

import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pinSchema, type PinFormValues, type EmotionType } from '../../lib/schemas/pinSchema';
import { TimecodeInput } from './TimecodeInput';
import { EmotionSelector } from './EmotionSelector';
import { TagInput } from './TagInput';
import { SpoilerToggle } from './SpoilerToggle';
import { useCreatePin } from '../../hooks/mutations/useCreatePin';
import { useUpdatePin } from '../../hooks/mutations/useUpdatePin';
import { useDeletePin } from '../../hooks/mutations/useDeletePin';
import { formatSecondsToTimecode } from '../../lib/timecodeUtils';
import { tokens } from '../../lib/designTokens';
import type { TimelinePin } from '../../types';

interface PinComposerProps {
  contentId: string;
  episodeId: string | null;
  episodeDurationSeconds?: number | null;
  defaultValues?: Partial<PinFormValues>;
  mode: 'create' | 'edit';
  pinId?: string;
  onSuccess: (pin: TimelinePin) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PinComposer({
  contentId,
  episodeId,
  episodeDurationSeconds,
  defaultValues,
  mode,
  pinId,
  onSuccess,
  onCancel,
  onDelete,
}: PinComposerProps) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<PinFormValues>({
    resolver: zodResolver(pinSchema),
    defaultValues: {
      timecodeInput: defaultValues?.timecodeInput ?? '',
      timestamp_seconds: defaultValues?.timestamp_seconds ?? null,
      memo: defaultValues?.memo ?? '',
      tagNames: defaultValues?.tagNames ?? [],
      emotion: defaultValues?.emotion ?? null,
      is_spoiler: defaultValues?.is_spoiler ?? false,
    },
  });

  const createPinMutation = useCreatePin();
  const updatePinMutation = useUpdatePin();
  const deletePinMutation = useDeletePin();

  // 뒤로 가기 시 변경 사항 경고
  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        '저장되지 않은 내용',
        '저장되지 않은 내용이 있습니다. 나가시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '나가기', style: 'destructive', onPress: onCancel },
        ]
      );
    } else {
      onCancel();
    }
  }, [isDirty, onCancel]);

  const onSubmit = useCallback(
    async (data: PinFormValues) => {
      const payload = {
        content_id: contentId,
        episode_id: episodeId,
        timestamp_seconds: data.timestamp_seconds,
        memo: data.memo?.trim() || null,
        tagNames: data.tagNames,
        emotion: data.emotion,
        is_spoiler: data.is_spoiler,
      };

      if (mode === 'create') {
        createPinMutation.mutate(payload, {
          onSuccess: (pin) => onSuccess(pin),
        });
      } else if (mode === 'edit' && pinId) {
        updatePinMutation.mutate(
          { pinId, ...payload },
          { onSuccess: (pin) => onSuccess(pin) }
        );
      }
    },
    [contentId, episodeId, mode, pinId, createPinMutation, updatePinMutation, onSuccess]
  );

  const handleDelete = useCallback(() => {
    if (!pinId) return;
    Alert.alert('핀 삭제', '이 핀을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deletePinMutation.mutate(pinId, {
            onSuccess: () => onDelete?.(),
          });
        },
      },
    ]);
  }, [pinId, deletePinMutation, onDelete]);

  const isSubmitting =
    createPinMutation.isPending || updatePinMutation.isPending;

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {/* 타임코드 입력 */}
      <View style={styles.field}>
        <Text style={styles.label}>타임코드</Text>
        <Controller
          control={control}
          name="timecodeInput"
          render={({ field: { value } }) => (
            <TimecodeInput
              value={value ?? ''}
              onChangeSeconds={(seconds) => {
                setValue('timestamp_seconds', seconds, { shouldDirty: true });
                // 표시용 문자열도 동기
                if (seconds !== null) {
                  setValue('timecodeInput', formatSecondsToTimecode(seconds));
                }
              }}
              maxSeconds={episodeDurationSeconds}
              placeholder="00:00"
              hasError={!!errors.timecodeInput}
              errorMessage={errors.timecodeInput?.message}
            />
          )}
        />
      </View>

      {/* 메모 입력 */}
      <View style={styles.field}>
        <Text style={styles.label}>메모 (선택)</Text>
        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.memoInput, errors.memo && styles.inputError]}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="이 장면에 대한 메모를 남겨보세요"
              placeholderTextColor={tokens.colors.textTertiary}
              multiline
              maxLength={500}
              returnKeyType="default"
              accessibilityLabel="메모 입력"
              accessibilityHint="최대 500자까지 입력할 수 있습니다"
            />
          )}
        />
        {errors.memo && (
          <Text style={styles.errorText}>{errors.memo.message}</Text>
        )}
      </View>

      {/* 태그 입력 */}
      <View style={styles.field}>
        <Text style={styles.label}>태그 (선택, 최대 10개)</Text>
        <Controller
          control={control}
          name="tagNames"
          render={({ field: { value, onChange } }) => (
            <TagInput
              tags={value}
              onChangeTags={onChange}
              maxTags={10}
              hasError={!!errors.tagNames}
              errorMessage={errors.tagNames?.message}
            />
          )}
        />
      </View>

      {/* 감정 선택 */}
      <View style={styles.field}>
        <Text style={styles.label}>감정 (선택)</Text>
        <Controller
          control={control}
          name="emotion"
          render={({ field: { value, onChange } }) => (
            <EmotionSelector selected={value} onSelect={onChange} />
          )}
        />
      </View>

      {/* 스포일러 토글 */}
      <View style={[styles.field, styles.row]}>
        <Text style={styles.label}>스포일러 포함</Text>
        <Controller
          control={control}
          name="is_spoiler"
          render={({ field: { value, onChange } }) => (
            <SpoilerToggle isSpoiler={value} onToggle={onChange} />
          )}
        />
      </View>

      {/* 전체 폼 에러 (refine 메시지) */}
      {errors.timecodeInput && (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errors.timecodeInput.message}
        </Text>
      )}

      {/* 액션 버튼 */}
      <TouchableOpacity
        style={[styles.saveButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityLabel="핀 저장"
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.saveButtonText}>
          {isSubmitting ? '저장 중...' : mode === 'create' ? '핀 저장' : '수정 완료'}
        </Text>
      </TouchableOpacity>

      {mode === 'edit' && pinId && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deletePinMutation.isPending}
          accessibilityLabel="핀 삭제"
          accessibilityRole="button"
        >
          <Text style={styles.deleteButtonText}>핀 삭제</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={handleCancel}
        accessibilityLabel="취소"
        accessibilityRole="button"
      >
        <Text style={styles.cancelButtonText}>취소</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing[4], paddingBottom: tokens.spacing[8] },
  field: { marginBottom: tokens.spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing[2],
  },
  memoInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing[3],
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textPrimary,
    textAlignVertical: 'top',
  },
  inputError: { borderColor: tokens.colors.error },
  errorText: {
    marginTop: tokens.spacing[1],
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.error,
  },
  saveButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
    marginTop: tokens.spacing[4],
    minHeight: 44,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: {
    fontSize: tokens.fontSizes.md,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deleteButton: {
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
    marginTop: tokens.spacing[2],
    minHeight: 44,
  },
  deleteButtonText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.error,
  },
  cancelButton: {
    paddingVertical: tokens.spacing[3],
    alignItems: 'center',
    minHeight: 44,
  },
  cancelButtonText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
  },
});
```

---

## 6. 동일 시간대 여러 핀 UI 처리

### 6.1 기본 원칙

- 동일 `timestamp_seconds`를 가진 핀은 경고 없이 허용하며 목록에 나란히 나열한다.
- `timestamp_seconds ASC NULLS LAST, created_at ASC` 정렬로 동일 시간대 핀은 생성 순서대로 배치된다.
- 그룹핑 UI는 MVP에서 구현하지 않는다.

### 6.2 목록 표시 예시

```
[핀 목록 — 14:32에 핀 2개]

 ● 14:32
   "리바이가 등장하는 첫 장면"
   [명장면] [액션]  😮

 ● 14:32                  ← 동일 타임스탬프, 구분선 없이 연속 나열
   "BGM이 너무 잘 어울림"
   [음악]  ❤️

 ● 23:15
   ...
```

### 6.3 FlashList 성능 (20개+ 핀)

```typescript
// components/pin/PinTimelineList.tsx (핵심 부분)

import { FlashList } from '@shopify/flash-list';
import type { TimelinePin } from '../../types';

// FlashList 설정
<FlashList
  data={pins}
  renderItem={({ item }) => (
    <PinTimelineItem
      pin={item}
      isSpoilerRevealed={spoilerRevealedIds.has(item.id)}
      onPress={() => onPinPress(item)}
      onLongPress={onPinLongPress ? () => onPinLongPress(item) : undefined}
      onRevealSpoiler={() => onRevealSpoiler(item.id)}
    />
  )}
  keyExtractor={(item) => item.id}    // 안정적인 UUID 사용, 배열 인덱스 금지
  estimatedItemSize={120}             // 핀 카드 예상 높이
  ListHeaderComponent={ListHeaderComponent}
  ListEmptyComponent={
    <EmptyState
      title="아직 핀이 없어요"
      description="에피소드에서 첫 핀을 남겨보세요!"
    />
  }
  onEndReached={onEndReached}
  onEndReachedThreshold={0.3}
/>
```

---

## 7. 스포일러 핀 UI 처리

### 7.1 핀 카드에서의 블러 처리

```typescript
// components/pin/PinTimelineItem.tsx (핵심 부분)

export const PinTimelineItem = React.memo<PinTimelineItemProps>(
  ({ pin, isSpoilerRevealed, onPress, onLongPress, onRevealSpoiler }) => {
    const showMemo = !pin.is_spoiler || isSpoilerRevealed;

    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={
          pin.is_spoiler && !isSpoilerRevealed
            ? `스포일러 핀. ${pin.timestamp_seconds !== null ? formatSecondsToTimecode(pin.timestamp_seconds) : '시간 미지정'}. 탭하여 편집`
            : `핀. ${pin.timestamp_seconds !== null ? formatSecondsToTimecode(pin.timestamp_seconds) : '시간 미지정'}. ${pin.memo ?? ''}`
        }
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        {/* 타임스탬프 + 감정 행 */}
        <View style={styles.header}>
          <Text style={styles.timestamp}>
            {pin.timestamp_seconds !== null
              ? formatSecondsToTimecode(pin.timestamp_seconds)
              : '시간 미지정'}
          </Text>
          {pin.emotion && (
            <Text style={styles.emotion}>{EMOTION_EMOJI[pin.emotion]}</Text>
          )}
          {pin.is_spoiler && (
            <Text style={styles.spoilerBadge}>스포일러</Text>
          )}
        </View>

        {/* 메모 영역 — 스포일러 블러 처리 */}
        {pin.memo && (
          <View style={styles.memoContainer}>
            {showMemo ? (
              <Text style={styles.memo} numberOfLines={3}>
                {pin.memo}
              </Text>
            ) : (
              <View style={styles.blurContainer}>
                {/* [선택 검토 필요] expo-blur 또는 단순 회색 오버레이 */}
                <View style={styles.blurOverlay} />
                <TouchableOpacity
                  onPress={onRevealSpoiler}
                  style={styles.revealButton}
                  accessibilityLabel="스포일러 내용 보기"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.revealButtonText}>보기</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 태그 칩 */}
        {pin.tags.length > 0 && (
          <View style={styles.tags}>
            {pin.tags.slice(0, 5).map((tag) => (
              <TagChip key={tag.id} tag={tag} size="sm" />
            ))}
            {pin.tags.length > 5 && (
              <Text style={styles.moreTags}>+{pin.tags.length - 5}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }
);
```

### 7.2 스포일러 블러 상태 관리

```typescript
// 스포일러 해제: 화면 내 세션 유지 (Jotai atom)
// 화면 이탈(unmount) 시 자동 초기화됨

// app/content/[id]/pins.tsx 또는 해당 화면에서 사용
import { useAtom } from 'jotai';
import { revealedSpoilerPinIdsAtom } from '../../atoms/spoilerAtoms';

const [revealedIds, setRevealedIds] = useAtom(revealedSpoilerPinIdsAtom);

const handleRevealSpoiler = useCallback((pinId: string) => {
  setRevealedIds((prev) => new Set([...prev, pinId]));
}, [setRevealedIds]);

// 화면 unmount 시 초기화 (useEffect cleanup)
useEffect(() => {
  return () => {
    setRevealedIds(new Set());
  };
}, [setRevealedIds]);
```

---

## 8. TanStack Query Hook 예시

### 8.1 `usePins` — 핀 목록 조회

```typescript
// hooks/queries/usePins.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../store/authStore';
import type { TimelinePin } from '../../types';

interface UsePinsOptions {
  contentId: string;
  episodeId: string | null;  // null = 작품 전체 핀 (영화 포함)
  tagId?: string | null;     // 태그 필터
}

export function usePins({ contentId, episodeId, tagId }: UsePinsOptions) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const queryKey = episodeId
    ? queryKeys.pins.byEpisode(userId, episodeId)
    : queryKeys.pins.byContent(userId, contentId);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<TimelinePin[]> => {
      let query = supabase
        .from('timeline_pins')
        .select(`
          id,
          content_id,
          episode_id,
          timestamp_seconds,
          memo,
          emotion,
          is_spoiler,
          created_at,
          updated_at,
          timeline_pin_tags (
            tags ( id, name )
          )
        `)
        .eq('user_id', userId)
        .order('timestamp_seconds', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (episodeId) {
        query = query.eq('episode_id', episodeId);
      } else {
        // 작품 전체 핀 (영화 포함)
        query = query.eq('content_id', contentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // timeline_pin_tags → tags 중첩 구조 정규화
      return (data ?? []).map((pin) => ({
        ...pin,
        tags: pin.timeline_pin_tags
          .flatMap((tpt: { tags: { id: string; name: string } | null }) =>
            tpt.tags ? [tpt.tags] : []
          ),
      }));
    },
    enabled: !!userId && !!contentId,
    staleTime: 30_000,
    gcTime: 120_000,
  });
}
```

### 8.2 `useCreatePin` — 핀 생성 (Optimistic Update 없음, MVP)

```typescript
// hooks/mutations/useCreatePin.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../store/authStore';
import { useAppUIStore } from '../../store/appUIStore';
import type { TimelinePin } from '../../types';

interface CreatePinInput {
  content_id: string;
  episode_id: string | null;
  timestamp_seconds: number | null;
  memo: string | null;
  tagNames: string[];
  emotion: string | null;
  is_spoiler: boolean;
}

export function useCreatePin() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const addToast = useAppUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: async (input: CreatePinInput): Promise<TimelinePin> => {
      const userId = user?.id;
      if (!userId) throw new Error('로그인이 필요합니다');

      // 1. 태그 find-or-create
      const tagIds: string[] = [];
      for (const name of input.tagNames) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('user_id', userId)
          .eq('name', name.trim())
          .maybeSingle();

        if (existingTag) {
          tagIds.push(existingTag.id);
        } else {
          const { data: newTag, error: tagError } = await supabase
            .from('tags')
            .insert({ user_id: userId, name: name.trim() })
            .select('id')
            .single();
          if (tagError) throw tagError;
          tagIds.push(newTag.id);
        }
      }

      // 2. 핀 생성
      const { data: pin, error: pinError } = await supabase
        .from('timeline_pins')
        .insert({
          user_id: userId,
          content_id: input.content_id,
          episode_id: input.episode_id,
          timestamp_seconds: input.timestamp_seconds,
          memo: input.memo,
          emotion: input.emotion,
          is_spoiler: input.is_spoiler,
        })
        .select('id, content_id, episode_id, timestamp_seconds, memo, emotion, is_spoiler, created_at, updated_at')
        .single();

      if (pinError) throw pinError;

      // 3. 태그 연결 (timeline_pin_tags)
      if (tagIds.length > 0) {
        const { error: tagLinkError } = await supabase
          .from('timeline_pin_tags')
          .insert(tagIds.map((tagId) => ({ pin_id: pin.id, tag_id: tagId })));
        if (tagLinkError) throw tagLinkError;
      }

      return { ...pin, tags: input.tagNames.map((name, i) => ({ id: tagIds[i], name })) };
    },

    onSuccess: (pin) => {
      const userId = user?.id ?? '';
      // 캐시 무효화
      if (pin.episode_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pins.byEpisode(userId, pin.episode_id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.pins.byContent(userId, pin.content_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tags.all(userId),
      });
      addToast({ message: '핀을 저장했습니다', type: 'success' });
    },

    onError: (error) => {
      addToast({ message: '저장에 실패했습니다. 다시 시도해 주세요.', type: 'error' });
      console.error('createPin error:', error);
    },
  });
}
```

### 8.3 `useLibrary` — 라이브러리 목록

```typescript
// hooks/queries/useLibrary.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../store/authStore';
import type { UserLibraryItem, WatchStatus } from '../../types';

export function useLibrary(statusFilter: WatchStatus | 'all' = 'all') {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: queryKeys.library.byStatus(userId, statusFilter),
    queryFn: async (): Promise<UserLibraryItem[]> => {
      let query = supabase
        .from('user_library_items')
        .select(`
          id,
          status,
          added_at,
          updated_at,
          contents!inner (
            id,
            title_primary,
            poster_url,
            content_type,
            air_year
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // pin_count는 별도 조회 후 merge (또는 DB View 활용)
      const contentIds = (data ?? []).map((item) => (item.contents as { id: string }).id);
      const { data: pinCounts } = await supabase
        .from('timeline_pins')
        .select('content_id')
        .eq('user_id', userId)
        .in('content_id', contentIds);

      const pinCountMap: Record<string, number> = {};
      (pinCounts ?? []).forEach((p) => {
        pinCountMap[p.content_id] = (pinCountMap[p.content_id] ?? 0) + 1;
      });

      return (data ?? []).map((item) => {
        const content = item.contents as {
          id: string;
          title_primary: string;
          poster_url: string | null;
          content_type: string;
          air_year: number | null;
        };
        return {
          library_item_id: item.id,
          status: item.status as WatchStatus,
          added_at: item.added_at,
          updated_at: item.updated_at,
          content_id: content.id,
          title_primary: content.title_primary,
          poster_url: content.poster_url,
          content_type: content.content_type,
          air_year: content.air_year,
          pin_count: pinCountMap[content.id] ?? 0,
        };
      });
    },
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
```

### 8.4 `useSearchContent` — 콘텐츠 검색 (Edge Function 호출)

```typescript
// hooks/queries/useSearchContent.ts

import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import type { ContentSearchResult } from '../../types';

type MediaTypeFilter = 'all' | 'anime' | 'drama' | 'movie';

interface SearchResponse {
  results: ContentSearchResult[];
  total: number;
  page: number;
  has_next: boolean;
  from_cache: boolean;
  partial: boolean;
}

export function useSearchContent(query: string, mediaType: MediaTypeFilter = 'all') {
  return useInfiniteQuery({
    queryKey: queryKeys.search.results(query, mediaType, 1),
    queryFn: async ({ pageParam = 1 }): Promise<SearchResponse> => {
      const { data, error } = await supabase.functions.invoke('search-content', {
        body: { query, media_type: mediaType, page: pageParam },
      });
      if (error) throw error;
      return data as SearchResponse;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.has_next ? lastPage.page + 1 : undefined,
    enabled: query.trim().length > 0,
    staleTime: 300_000,
    gcTime: 600_000,
  });
}
```

---

## 9. 에러/로딩/빈 상태 처리 패턴

### 9.1 화면별 스켈레톤 정의

```typescript
// components/common/LoadingSkeleton.tsx

// content-card: 라이브러리 목록 아이템 스켈레톤
// - 포스터 사각형 (60×80) + 텍스트 라인 2개 + 배지 사각형

// search-result: 검색 결과 아이템 스켈레톤
// - 포스터 사각형 (50×70) + 텍스트 라인 3개 + 출처 배지

// pin-item: 핀 목록 아이템 스켈레톤
// - 타임스탬프 라인 + 메모 라인 2개 + 태그 칩 2개

// episode-row: 에피소드 행 스켈레톤
// - 체크박스 + 에피소드 번호/제목 라인 + 런타임 라인
```

### 9.2 전체 처리 패턴 — 화면 레벨

```typescript
// 표준 패턴 (모든 데이터 조회 화면에서 사용)

const { data, isLoading, isError, refetch } = usePins({ contentId, episodeId: null });

if (isLoading) {
  return <LoadingSkeleton variant="pin-item" count={5} />;
}

if (isError) {
  return (
    <ErrorState
      message="핀 목록을 불러오지 못했습니다"
      onRetry={refetch}
      fullScreen
    />
  );
}

if (!data || data.length === 0) {
  return (
    <EmptyState
      title="아직 핀이 없어요"
      description="에피소드에서 첫 핀을 남겨보세요!"
      actionLabel="에피소드로 이동"
      onAction={() => router.push(`/content/${contentId}/episodes`)}
    />
  );
}

return (
  <PinTimelineList
    pins={data}
    isLoading={false}
    hasError={false}
    onRetry={refetch}
    spoilerRevealedIds={revealedIds}
    onPinPress={handlePinPress}
    onRevealSpoiler={handleRevealSpoiler}
  />
);
```

### 9.3 오프라인 상태 처리

```typescript
// TanStack Query의 networkMode 설정
// lib/queryClient.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst', // 캐시 데이터 우선 반환 후 백그라운드 갱신
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      networkMode: 'always', // mutation은 네트워크 있을 때만 실행
      retry: 1,
    },
  },
});
// MVP: 오프라인 완전 지원은 Phase 2. 현재는 캐시된 데이터 표시 + 오류 토스트.
```

---

## 10. 영화 핀 처리 (episodeId = null)

### 10.1 PinComposer에서의 처리

```typescript
// app/pins/new.tsx
// search params: { contentId, episodeId? }

const { contentId, episodeId } = useLocalSearchParams<{
  contentId: string;
  episodeId?: string;
}>();

// episodeId가 없거나 "undefined" 문자열인 경우 null로 처리
const resolvedEpisodeId = episodeId && episodeId !== 'undefined' ? episodeId : null;

// episodeDurationSeconds도 episodeId가 있을 때만 조회
const { data: episode } = useQuery({
  queryKey: ['episode', resolvedEpisodeId],
  queryFn: () =>
    supabase
      .from('episodes')
      .select('duration_seconds')
      .eq('id', resolvedEpisodeId!)
      .single()
      .then(({ data }) => data),
  enabled: !!resolvedEpisodeId,
});

<PinComposer
  contentId={contentId}
  episodeId={resolvedEpisodeId}               // null이면 영화 핀
  episodeDurationSeconds={episode?.duration_seconds ?? null}
  mode="create"
  onSuccess={...}
  onCancel={...}
/>
// PinComposer 내부에서 episodeId가 null이면 에피소드 컨텍스트 표시 없음
```

### 10.2 usePins에서 영화 핀 조회

```typescript
// episodeId = null → content_id 기반 조회 (episode_id IS NULL 조건 포함)

if (episodeId === null) {
  query = query
    .eq('content_id', contentId)
    .is('episode_id', null);  // 영화 핀만
}
// 시리즈의 작품 전체 핀 조회(에피소드 구분 없이)는 episodeId를 undefined로 구분
```

### 10.3 영화 콘텐츠 UI 조건부 렌더링

```typescript
// app/content/[id]/index.tsx

const isMovie = content?.content_type === 'movie';

// 에피소드 버튼 미표시
{!isMovie && (
  <TouchableOpacity onPress={() => router.push(`/content/${contentId}/episodes`)}>
    <Text>에피소드 목록</Text>
  </TouchableOpacity>
)}

// 영화는 콘텐츠 상세에서 직접 핀 추가
{isMovie && (
  <TouchableOpacity
    onPress={() => router.push({ pathname: '/pins/new', params: { contentId } })}
  >
    <Text>핀 추가</Text>
  </TouchableOpacity>
)}
```

---

## 11. 성능 최적화 방침

### 11.1 FlashList vs FlatList 선택 기준

| 컴포넌트 | 사용 리스트 | estimatedItemSize | 이유 |
|----------|------------|-------------------|------|
| FlashList | 핀 목록 (PinTimelineList) | 120 | 핀이 20개+, 스크롤 성능 중요 |
| FlashList | 라이브러리 목록 | 88 | 100개+ 가능 |
| FlashList | 검색 결과 | 80 | 무한 스크롤 |
| FlashList | 에피소드 목록 | 64 | 200+ 에피소드 가능 |
| FlatList | 감정 선택 (EmotionSelector) | — | 10개, 수평 고정 크기 |
| FlatList | 태그 칩 수평 스크롤 | — | 소규모, 간단한 레이아웃 |

### 11.2 React.memo 적용 대상

```typescript
// FlashList/FlatList 아이템 컴포넌트: 필수
export const PinTimelineItem = React.memo<PinTimelineItemProps>(...);
export const ContentCard = React.memo<ContentCardProps>(...);
export const SearchResultItem = React.memo<SearchResultItemProps>(...);
export const TagChip = React.memo<TagChipProps>(...);
export const EpisodeRow = React.memo<EpisodeRowProps>(...);
```

### 11.3 useMemo / useCallback 적용 원칙

```typescript
// 이벤트 핸들러가 자식 컴포넌트에 전달될 때: useCallback
const handlePinPress = useCallback((pin: TimelinePin) => {
  router.push(`/pins/${pin.id}`);
}, [router]);

// 파생 데이터 (필터링, 정렬): useMemo
const filteredPins = useMemo(() => {
  if (selectedTagIds.length === 0) return pins;
  return pins.filter((pin) =>
    pin.tags.some((tag) => selectedTagIds.includes(tag.id))
  );
}, [pins, selectedTagIds]);
```

### 11.4 이미지 로딩

```typescript
// expo-image 사용 (FlatList/FlashList 아이템 내 포스터)
import { Image } from 'expo-image';

<Image
  source={{ uri: posterUrl ?? undefined }}
  placeholder={POSTER_BLURHASH}  // 블러해시 플레이스홀더
  contentFit="cover"
  transition={200}
  style={styles.poster}
  accessibilityLabel={`${title} 포스터`}
/>
```

### 11.5 폼 리렌더링 최소화

```typescript
// Controller를 필드별로 분리하여 전체 폼 watch 방지
// 나쁜 예: const formValues = watch();  — 모든 필드 변경마다 전체 리렌더
// 좋은 예:
<Controller
  control={control}
  name="memo"           // 해당 필드만 구독
  render={({ field }) => <TextInput {...field} />}
/>
```

---

## 12. 디자인 토큰 (MVP 최소 정의)

```typescript
// lib/designTokens.ts

export const tokens = {
  colors: {
    primary: '#5B4FF5',          // 포인트 컬러 (보라)
    background: '#FFFFFF',
    surface: '#F8F8FB',          // 카드 배경
    border: '#E5E5EA',
    textPrimary: '#1A1A1E',
    textSecondary: '#6E6E7A',
    textTertiary: '#AEAEB8',
    error: '#FF3B30',
    success: '#34C759',
    spoilerOverlay: '#2C2C2E',
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
  },
  fontSizes: {
    sm: 13,
    md: 15,
    lg: 17,
    xl: 22,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
} as const;
```

**터치 타겟 원칙:** 모든 터치 가능한 요소는 `minHeight: 44`를 보장한다. 아이콘 버튼은 `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`를 추가한다.

---

## 13. 개발 우선순위 (P0~P3)

### P0 — 앱이 존재하기 위한 최소 조건

| 화면/컴포넌트 | 설명 |
|--------------|------|
| `app/(auth)/login.tsx` | 이메일 로그인/회원가입 |
| `app/(tabs)/index.tsx` | 라이브러리 목록 |
| `app/(tabs)/search.tsx` | 콘텐츠 검색 |
| `app/content/[id]/index.tsx` | 콘텐츠 상세 + 라이브러리 추가 |
| `app/content/[id]/episodes.tsx` | 에피소드 선택 |
| `app/pins/new.tsx` | 핀 생성 |
| `app/content/[id]/pins.tsx` | 핀 목록 |
| `TimecodeInput` | 타임코드 입력 |
| `PinComposer` (create mode) | 핀 생성 폼 |
| `PinTimelineList` + `PinTimelineItem` | 핀 목록 |
| `useCreatePin` | 핀 생성 mutation |
| `usePins` | 핀 목록 query |
| `useLibrary` | 라이브러리 query |
| `useSearchContent` | 검색 query |
| `authStore` (Zustand) | 세션 관리 |

### P1 — MVP 핵심 가치 구현에 필수

| 화면/컴포넌트 | 설명 |
|--------------|------|
| `app/pins/[id].tsx` | 핀 편집 |
| `app/(tabs)/profile.tsx` | My Page |
| `PinComposer` (edit mode) | 핀 편집 폼 |
| `EmotionSelector` | 감정 선택 |
| `TagInput` + `TagChip` | 태그 입력/표시 |
| `SpoilerToggle` + 블러 처리 | 스포일러 UI |
| `WatchStatusBadge` | 감상 상태 배지 |
| `SeasonSelector` + `EpisodeSelector` | 에피소드/시즌 선택 |
| `useUpdatePin`, `useDeletePin` | 핀 수정/삭제 |
| 에피소드 진행률 Optimistic Update | 체크박스 즉시 반영 |
| `revealedSpoilerPinIdsAtom` (Jotai) | 스포일러 해제 상태 |
| Apple/Google 소셜 로그인 | 인증 |

### P2 — MVP 품질을 높이는 기능

| 화면/컴포넌트 | 설명 |
|--------------|------|
| `app/tags/[tagId].tsx` | 태그별 핀 목록 |
| 라이브러리 정렬 옵션 | 추가일/이름/활동순 |
| 검색 최근 검색어 | 로컬 AsyncStorage 저장 |
| `LoadingSkeleton` 세분화 | 화면별 정확한 스켈레톤 |
| 태그 자동완성 (기존 태그 제안) | 태그 입력 UX 개선 |
| My Page 통계 상세화 | 감상 통계 카드 |

### P3 — 이후 Phase

| 기능 | 설명 |
|------|------|
| 진행바형 타임라인 | 에피소드 런타임 기반 시각화 |
| 태그 이름 수정/삭제 | 태그 관리 화면 |
| 핀 Export | CSV/PDF 내보내기 |
| 오프라인 모드 | 캐시 기반 완전 오프라인 지원 |
| Highlight Reel | 명장면 모음 (소셜 요소) |
| 다크 모드 | 테마 전환 |

---

## 부록: 미결정 사항 (FE 관련)

| 번호 | 사항 | 현재 방향 | 결정 필요 시점 |
|------|------|-----------|---------------|
| FE-TBD-001 | 타임스탬프 입력 중 실시간 콜론 자동 삽입 여부 | blur 시 자동 포맷 (입력 중 삽입 미수행) | TimecodeInput 구현 시 |
| FE-TBD-002 | 스포일러 블러 구현 방법 | expo-blur vs 단순 오버레이 | [선택 검토 필요] expo-blur 현재 Expo SDK 호환성 확인 필요 |
| FE-TBD-003 | 태그 구분자 스페이스 허용 여부 | Enter/쉼표만 허용 (스페이스 미허용) | TagInput 구현 시 |
| FE-TBD-004 | 검색 화면과 라이브러리 화면 탭 구조 (분리 vs 통합) | 현재 분리 (탭 2개) | 라우터 설계 시 |
| FE-TBD-005 | 핀 목록 페이지네이션 방식 | cursor 기반 (useInfiniteQuery) | 작품 단위 핀 목록 구현 시 |
| FE-TBD-006 | `expo-image` vs React Native Image | expo-image 사용 (blurhash 지원) | 이미지 컴포넌트 구현 시 |
| FE-TBD-007 | Bottom Tab FAB 위치 (핀 추가 FAB) | 핀 목록 화면 우하단 고정 | 탭 레이아웃 확정 시 |
| FE-TBD-008 | 에피소드 진행률 Optimistic Update 롤백 UX | 실패 시 토스트 + 체크 원복 | 에피소드 화면 구현 시 |
