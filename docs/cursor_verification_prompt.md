# SceneNote — Design Compliance Verification & Fix Prompt (Cursor)

## Context

This is a mobile app (Expo + React Native + TypeScript + Supabase) for tracking anime/drama/movie viewing history. The core feature is timeline pins — timestamped notes at a specific episode moment.

All design documents are in `docs/`. The app was partially implemented but has critical gaps. Your job is to **verify compliance with the design and fix all gaps**. Do NOT add new features.

---

## Step 1: Read These Files First

Before doing anything, read:
1. `docs/10_mvp_integration_plan.md` — final decisions, MVP scope, 4-week checklist
2. `docs/08_frontend_architecture.md` — full file structure, component specs, hook patterns
3. `docs/09_timeline_pin_ux.md` — TimecodeInput UX spec (critical)
4. `docs/07_edge_functions.md` — Edge Function contracts

---

## Step 2: Known Gaps to Fix

The following are confirmed missing or wrong. Fix them in order.

### 2-A. Install missing dependency

```bash
npm install jotai
```

`jotai` is required for screen-local state (pin form draft, tag filter, spoiler reveal). It is listed as non-negotiable in `docs/08_frontend_architecture.md`.

---

### 2-B. Create `lib/` directory

**`lib/supabase.ts`**
```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**`lib/queryClient.ts`**
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
```

---

### 2-C. Create `types/database.ts`

Write TypeScript types matching the Supabase schema in `supabase/migrations/0001_initial_schema.sql`. Include:
- `WatchStatus = 'wishlist' | 'watching' | 'completed' | 'dropped'`
- `ContentType = 'anime' | 'kdrama' | 'jdrama' | 'movie' | 'other'`
- `ExternalSource = 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze' | 'manual'`
- `EmotionType = 'excited' | 'moved' | 'funny' | 'sad' | 'surprised' | 'angry' | 'scared' | 'love' | 'boring' | 'none'`
- `TimelinePin` interface with `timestamp_seconds: number | null` and `episode_id: string | null`
- All other table row types

---

### 2-D. Create `stores/` directory

**`stores/authStore.ts`** — Zustand store
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';

interface AuthStore {
  user: User | null;
  session: Session | null;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      setSession: (session) => set({ session, user: session?.user ?? null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**`stores/appUIStore.ts`** — Toast queue, global UI
```typescript
import { create } from 'zustand';

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

interface AppUIStore {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useAppUIStore = create<AppUIStore>()((set) => ({
  toasts: [],
  addToast: (message, type = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now().toString(), message, type }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

---

### 2-E. Create `atoms/` directory (Jotai)

**`atoms/pinFormAtom.ts`**
```typescript
import { atom } from 'jotai';
import type { EmotionType } from '@/types/database';

export interface PinFormDraft {
  timecodeDisplay: string;         // "12:34" — UI only
  timestamp_seconds: number | null;
  memo: string;
  tags: string[];
  emotion: EmotionType;
  is_spoiler: boolean;
}

export const pinFormDraftAtom = atom<PinFormDraft>({
  timecodeDisplay: '',
  timestamp_seconds: null,
  memo: '',
  tags: [],
  emotion: 'none',
  is_spoiler: false,
});
```

**`atoms/spoilerAtom.ts`**
```typescript
import { atom } from 'jotai';

// Set of pin IDs the user has tapped to reveal
export const revealedSpoilerPinIdsAtom = atom<Set<string>>(new Set<string>());
```

**`atoms/tagFilterAtom.ts`**
```typescript
import { atom } from 'jotai';

export const selectedTagFilterIdsAtom = atom<Set<string>>(new Set<string>());
```

---

### 2-F. Create `hooks/` directory

Create these TanStack Query hooks. Each must use the query key convention from `docs/08_frontend_architecture.md`:

**Query key constants (put at top of each hook file or a shared `hooks/queryKeys.ts`):**
```typescript
export const queryKeys = {
  library: (userId: string) => ['library', userId] as const,
  libraryItem: (userId: string, contentId: string) => ['library', userId, contentId] as const,
  pins: (userId: string, contentId: string, episodeId: string | null) =>
    ['pins', userId, contentId, episodeId] as const,
  episodes: (seasonId: string) => ['episodes', seasonId] as const,
  search: (query: string) => ['search', query] as const,
  contentDetail: (contentId: string) => ['content', contentId] as const,
};
```

**`hooks/usePins.ts`** — fetch pins for a content/episode, sorted by `timestamp_seconds ASC NULLS LAST, created_at ASC`

**`hooks/useCreatePin.ts`** — mutation, invalidates `queryKeys.pins(...)` on success

**`hooks/useUpdatePin.ts`** — mutation for editing a pin

**`hooks/useDeletePin.ts`** — mutation, invalidates pins query on success

**`hooks/useLibrary.ts`** — fetch `user_library_items` with `contents` joined, accepts optional `status` filter

**`hooks/useSearchContent.ts`** — calls `search-content` Edge Function, staleTime 300_000

**`hooks/useEpisodeProgress.ts`** — fetch + upsert/delete `user_episode_progress`

**staleTime values (from design):**
- pins: `30_000`
- library: `60_000`
- search: `300_000`
- content detail: `600_000`

---

### 2-G. Create `components/` directory

Read `docs/08_frontend_architecture.md §3` for the full Props interfaces. Create these components:

**`components/pin/TimecodeInput.tsx`** — CRITICAL. Read `docs/09_timeline_pin_ux.md §2` first.

Key behavior:
- `keyboardType="numeric"`, only digits allowed
- Auto-format on blur: `"1234"` → `"12:34"`, `"123456"` → `"1:23:45"`, `"12"` → `"00:12"`
- Converts to seconds and calls `onChangeSeconds(number | null)`
- Empty → `onChangeSeconds(null)`
- If `maxSeconds` provided and input exceeds it: show inline warning text (soft warning, NOT hard block)

```typescript
interface TimecodeInputProps {
  value: string;
  onChangeSeconds: (seconds: number | null) => void;
  maxSeconds?: number;
  placeholder?: string;
}
```

**`components/pin/PinComposer.tsx`** — Full pin creation/edit form using React Hook Form + Zod

Zod schema:
```typescript
const createPinSchema = z.object({
  timecodeDisplay: z.string().optional(),
  timestamp_seconds: z.number().int().min(0).nullable(),
  memo: z.string().max(500).nullable(),
  tags: z.array(z.string().min(1).max(20)).max(10).default([]),
  emotion: z.enum(['excited','moved','funny','sad','surprised','angry','scared','love','boring','none']).default('none'),
  is_spoiler: z.boolean().default(false),
}).refine(
  (d) => d.timestamp_seconds !== null || (d.memo !== null && d.memo.trim().length > 0),
  { message: '타임스탬프 또는 메모 중 하나는 필수입니다', path: ['memo'] }
);
```

**`components/pin/PinTimelineList.tsx`** — FlashList-based, accepts `spoilerBlurred: boolean`, `onPinPress`, `onPinLongPress`

**`components/pin/PinTimelineItem.tsx`** — Single pin card. If `pin.is_spoiler && !isRevealed`: blur memo text, show "스포일러 — 탭하여 보기" overlay. Read `docs/09_timeline_pin_ux.md §6`.

**`components/pin/SpoilerToggle.tsx`** — Toggle button for global spoiler reveal

**`components/content/ContentCard.tsx`** — Library list item with `WatchStatusBadge`

**`components/content/SearchResultItem.tsx`** — Search result with source label (TMDB / AniList badge)

**`components/content/ContentSearchBar.tsx`** — Search input

**`components/content/WatchStatusBadge.tsx`** — Status pill (색상 구분)

**`components/episode/SeasonSelector.tsx`** — Season tab bar

**`components/episode/EpisodeSelector.tsx`** — Episode list with progress checkbox and pin count badge

**`components/ui/TagChip.tsx`** — Tag pill with optional remove button

**`components/ui/EmptyState.tsx`** — `message: string`, `actionLabel?: string`, `onAction?: () => void`

**`components/ui/ErrorState.tsx`** — With retry button

**`components/ui/LoadingSkeleton.tsx`** — Accept `variant: 'pin' | 'library' | 'search'` prop

---

### 2-H. Route fixes

**Fix: `app/search.tsx` is in wrong location**

Design requires `app/(tabs)/search.tsx`. Move or recreate it there. The bottom tab navigator in `app/(tabs)/_layout.tsx` should have a Search tab pointing to `search`.

**Fix: `app/pins/new.tsx` is missing**

Create `app/pins/new.tsx` — pin creation screen. It receives `contentId` and optional `episodeId` via `useLocalSearchParams()`. When `episodeId` is absent → movie pin mode (hide episode selector in `PinComposer`).

**Verify: `app/(auth)/onboarding.tsx`**

Check if onboarding exists. If not, create a simple 3-slide onboarding screen that leads to login. It is P0 per `docs/10_mvp_integration_plan.md §5`.

---

### 2-I. Phase 2 adapters — flag but do not remove

`supabase/functions/search-content/adapters/kitsu.ts` and `tvmaze.ts` were implemented ahead of schedule (Phase 2). Do NOT delete them. Add a comment at the top of each:

```typescript
// Phase 2 — not active in MVP. Kitsu/TVmaze integration deferred.
// See docs/10_mvp_integration_plan.md §1.3 MVP 제외 목록
```

Also verify that `search-content/index.ts` only calls TMDB and AniList by default in MVP. Kitsu/TVmaze should be behind an opt-in flag or not called at all.

---

## Step 3: Verify These Non-Negotiable Rules

After fixing all gaps, verify each rule is implemented correctly:

### Rule 1: timestamp_seconds stored as INT
```bash
grep -r "timestamp_seconds" app/ --include="*.tsx" --include="*.ts"
```
All DB writes must use `number` type. No string storage. Verify `PinComposer` passes `timestamp_seconds: number | null` to insert, not the display string.

### Rule 2: Multiple pins at same timestamp — no unique constraint
```bash
grep "timestamp_seconds" supabase/migrations/0001_initial_schema.sql
```
Confirm there is **no** `UNIQUE (user_id, episode_id, timestamp_seconds)` constraint. If one exists, remove it via a new migration.

### Rule 3: Movie pin — episode_id = null
Check `app/pins/new.tsx` (after creating it): when `episodeId` param is absent, the insert must include `episode_id: null`. No dummy episode creation.

### Rule 4: RLS on all user data tables
```bash
grep -c "CREATE POLICY" supabase/migrations/0001_initial_schema.sql
```
Must have policies for: `profiles`, `user_library_items`, `user_episode_progress`, `timeline_pins`, `tags`, `timeline_pin_tags`. Minimum 6 tables × 3-4 policies each.

### Rule 5: No API keys in client code
```bash
grep -r "TMDB_API_KEY\|ANILIST_API_KEY\|service_role" app/ lib/ --include="*.ts" --include="*.tsx"
```
Must return 0 matches. API keys only in `supabase/functions/` via `Deno.env.get()`.

### Rule 6: Pin sort order
In `hooks/usePins.ts`, the Supabase query must include:
```typescript
.order('timestamp_seconds', { ascending: true, nullsFirst: false })
.order('created_at', { ascending: true })
```

### Rule 7: Spoiler atom resets on unmount
In the pin list screen (`app/content/[id]/pins.tsx`), add:
```typescript
const setRevealedIds = useSetAtom(revealedSpoilerPinIdsAtom);
useEffect(() => () => setRevealedIds(new Set()), []);
```

### Rule 8: Jotai for screen-local state, Zustand for global
- `pinFormDraftAtom`, `revealedSpoilerPinIdsAtom`, `selectedTagFilterIdsAtom` → Jotai
- `authStore`, `appUIStore` → Zustand
- No Zustand atoms for per-screen state. No Jotai for auth.

---

## Step 4: Final Checklist

Run through each item. Mark any that fail and create a fix.

- [ ] `npm install jotai` done, `package.json` updated
- [ ] `lib/supabase.ts` exists and uses `AsyncStorage` session persistence
- [ ] `lib/queryClient.ts` exists with correct staleTime defaults
- [ ] `types/database.ts` has `TimelinePin` with `timestamp_seconds: number | null` and `episode_id: string | null`
- [ ] `stores/authStore.ts` uses Zustand with AsyncStorage persist
- [ ] `atoms/spoilerAtom.ts`, `atoms/pinFormAtom.ts`, `atoms/tagFilterAtom.ts` exist
- [ ] All 7 hooks exist in `hooks/`
- [ ] `TimecodeInput` auto-formats on blur, calls `onChangeSeconds(number | null)`
- [ ] `PinComposer` Zod schema has `.refine()` requiring at least one of timestamp/memo
- [ ] `PinTimelineList` uses `FlashList` with `estimatedItemSize`
- [ ] `PinTimelineItem` blurs memo when `is_spoiler=true` and not revealed
- [ ] `app/(tabs)/search.tsx` exists (not `app/search.tsx`)
- [ ] `app/pins/new.tsx` exists, handles `episodeId` absent = movie pin
- [ ] `app/(auth)/onboarding.tsx` exists
- [ ] `supabase/functions/search-content/index.ts` only calls TMDB + AniList by default
- [ ] Kitsu/TVmaze adapters have Phase 2 comment
- [ ] No `UNIQUE(user_id, episode_id, timestamp_seconds)` in migration
- [ ] No API keys in `app/` or `lib/`
- [ ] RLS policies exist for all 6 user data tables
- [ ] Pin query uses `.order('timestamp_seconds', { ascending: true, nullsFirst: false })`
- [ ] Spoiler atom resets on screen unmount
