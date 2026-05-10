# SceneNote MVP — Codex Implementation Prompt

아래 프롬프트를 Codex에 그대로 붙여넣어 사용하세요.

---

## PROMPT START

You are implementing **SceneNote**, a mobile app for tracking anime, Korean drama, Japanese drama, and movie viewing history. The core feature is **timeline pins** — timestamped notes users drop at a specific season/episode/timecode, e.g. "S3E12 14:32 — Levi action scene".

All design documents are in `/docs/`. Read them before writing any code.

**Design docs to read first:**
- `docs/10_mvp_integration_plan.md` — final scope, decisions, 4-week plan, checklist (start here)
- `docs/04_architecture.md` — system architecture, state management, tech decisions
- `docs/06_backend_schema.sql` — full Supabase migration SQL (copy this verbatim)
- `docs/07_edge_functions.md` — Edge Function specs with TypeScript examples
- `docs/08_frontend_architecture.md` — Expo Router structure, component types, TanStack Query hooks
- `docs/09_timeline_pin_ux.md` — timecode input UX, spoiler handling, pin rules

---

## Tech Stack (non-negotiable)

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK (latest stable) + Expo Router (file-based) |
| Language | TypeScript — strict mode, no `any` |
| Backend | Supabase (Auth, PostgreSQL, RLS, Edge Functions / Deno) |
| Server state | TanStack Query v5 |
| Global UI state | Zustand |
| Screen-local state | Jotai |
| Forms | React Hook Form + Zod |
| Lists | FlashList (`@shopify/flash-list`) |
| External APIs | TMDB (REST), AniList (GraphQL) |

---

## Project Initialization

```bash
# 1. Create Expo project
npx create-expo-app@latest SceneNote --template blank-typescript
cd SceneNote

# 2. Install dependencies
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-secure-store
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
npm install @tanstack/react-query zustand jotai
npm install react-hook-form @hookform/resolvers zod
npm install @shopify/flash-list
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler

# 3. Local Supabase
npx supabase init
npx supabase start

# 4. Run the full DB migration
# Copy docs/06_backend_schema.sql into Supabase SQL editor or:
npx supabase db push
```

---

## Non-Negotiable Design Decisions

Read these carefully. Do not deviate.

### Data

- `timestamp_seconds` is stored as `INT` (seconds since episode start). **Never store as string.**
- `MM:SS` / `HH:MM:SS` is UI-only formatting. Convert in the client.
- Multiple pins on the same episode at the same timestamp are **all allowed**. No unique constraint on `(user_id, episode_id, timestamp_seconds)`.
- Pin sort order: `timestamp_seconds ASC NULLS LAST, created_at ASC`
- Movie pins: `episode_id = NULL`. Do NOT create dummy episode records.
- A pin requires at least one of `timestamp_seconds` or `memo` (DB CHECK enforces this).
- Only save content to DB when user explicitly adds it to library. No bulk API caching.

### Security

- **RLS is mandatory from day one.** Do not skip it. See `docs/06_backend_schema.sql` for all RLS policies.
- **Never expose API keys to the client.** All external API calls (TMDB, AniList) go through Supabase Edge Functions.
- `service_role` is server-only. Never use it in the Expo app.
- Extract `user_id` from JWT on the server, never trust client-passed user IDs.

### Architecture

- State split: TanStack Query for server data, Zustand for global auth/UI, Jotai for screen-local atoms.
- Edge Functions only when: (a) external API call needed, or (b) `service_role` write to content tables needed.
- Direct Supabase client for: pin CRUD, library status changes, episode progress, tags — all governed by RLS.

---

## File Structure

```
SceneNote/
├── app/
│   ├── _layout.tsx              ← Root layout, auth guard, Supabase init
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── onboarding.tsx
│   │   └── login.tsx            ← Email login + register + social login buttons
│   └── (tabs)/
│       ├── _layout.tsx          ← Bottom tab navigator (Library / Search / Profile)
│       ├── index.tsx            ← Home / Library (FlashList, status filter tabs)
│       ├── search.tsx           ← Content search + results (same screen)
│       └── profile.tsx          ← My Page (stats, logout, delete account)
├── app/
│   ├── content/
│   │   └── [id]/
│   │       ├── index.tsx        ← Content detail + watching detail
│   │       ├── episodes.tsx     ← Season tabs + episode checklist
│   │       └── pins.tsx         ← Pin timeline list for this content
│   └── pins/
│       ├── new.tsx              ← Pin composer (create mode)
│       └── [id].tsx             ← Pin detail / edit
├── components/
│   ├── content/
│   │   ├── ContentCard.tsx
│   │   ├── SearchResultItem.tsx
│   │   ├── ContentSearchBar.tsx
│   │   └── WatchStatusBadge.tsx
│   ├── episode/
│   │   ├── SeasonSelector.tsx
│   │   └── EpisodeSelector.tsx
│   ├── pin/
│   │   ├── TimecodeInput.tsx    ← CRITICAL: see UX spec below
│   │   ├── PinComposer.tsx
│   │   ├── PinTimelineList.tsx
│   │   ├── PinTimelineItem.tsx
│   │   └── SpoilerToggle.tsx
│   └── ui/
│       ├── TagChip.tsx
│       ├── EmptyState.tsx
│       ├── ErrorState.tsx
│       └── LoadingSkeleton.tsx
├── lib/
│   ├── supabase.ts              ← Supabase client init
│   └── queryClient.ts           ← TanStack Query client
├── hooks/
│   ├── usePins.ts
│   ├── useCreatePin.ts
│   ├── useLibrary.ts
│   ├── useSearchContent.ts
│   └── useEpisodeProgress.ts
├── stores/
│   ├── authStore.ts             ← Zustand (user, session, setSession)
│   └── appUIStore.ts            ← Zustand (toast queue)
├── atoms/
│   ├── pinFormAtom.ts           ← Jotai (draft form state)
│   ├── tagFilterAtom.ts         ← Jotai (selected tag IDs)
│   └── spoilerAtom.ts           ← Jotai (revealed spoiler pin IDs)
├── types/
│   └── database.ts              ← Generated or hand-written Supabase types
├── supabase/
│   ├── functions/
│   │   ├── search-content/index.ts
│   │   ├── add-to-library/index.ts
│   │   ├── get-content-detail/index.ts
│   │   └── fetch-episodes/index.ts
│   └── migrations/
│       └── 20260502000000_initial.sql   ← Copy from docs/06_backend_schema.sql
└── docs/                        ← Design documents (already exist, do not modify)
```

---

## Implementation Order (Week by Week)

Implement **in this exact order**. Do not skip ahead.

### Week 1 — Foundation

1. `lib/supabase.ts` — Supabase client with `AsyncStorage` session persistence
2. `stores/authStore.ts` — Zustand store with `persist` middleware
3. `app/_layout.tsx` — Root layout: auth state listener, route protection (`(auth)` vs `(tabs)`)
4. `app/(auth)/login.tsx` — Email sign-in / sign-up with React Hook Form + Zod
5. `app/(tabs)/_layout.tsx` — Bottom tabs shell (Library, Search, Profile)
6. Run `docs/06_backend_schema.sql` in Supabase — verify all tables and RLS created

**Verify:** User can sign up, log in, session persists on app restart, tabs visible.

### Week 2 — Content Search and Library

7. `supabase/functions/search-content/index.ts` — TMDB + AniList parallel search, TTL cache. See `docs/07_edge_functions.md §3` for full TypeScript example.
8. `app/(tabs)/search.tsx` + `components/content/SearchResultItem.tsx` — search input, results list with source API label (TMDB / AniList badge)
9. `supabase/functions/add-to-library/index.ts` — upsert contents, create user_library_items. See `docs/07_edge_functions.md §4`.
10. Library add bottom sheet — watch status picker (wishlist / watching / completed / dropped)
11. `app/(tabs)/index.tsx` + `components/content/ContentCard.tsx` — library list, status filter tabs, FlashList
12. `supabase/functions/get-content-detail/index.ts`
13. `app/content/[id]/index.tsx` — content detail with library status CTA

**Verify:** Search returns results, add to library works, library list shows items with status.

### Week 3 — Timeline Pins (Core)

14. `supabase/functions/fetch-episodes/index.ts` — lazy load episodes from TMDB/AniList
15. `app/content/[id]/episodes.tsx` — season tabs, episode checklist, pin count badge
16. `components/pin/TimecodeInput.tsx` — **read `docs/09_timeline_pin_ux.md` §2 before writing this**
17. `app/pins/new.tsx` + `components/pin/PinComposer.tsx` — full pin creation form
18. `app/content/[id]/pins.tsx` + `components/pin/PinTimelineList.tsx` — pin list sorted by timestamp_seconds ASC NULLS LAST
19. `app/pins/[id].tsx` — pin edit mode
20. Tag input, `tags` find-or-create, `timeline_pin_tags` insert
21. Emotion selector (10 options: 감동/설렘/긴장/놀람/즐거움/슬픔/분노/공포/공감/최고)
22. Spoiler blur + `atoms/spoilerAtom.ts` — per-pin reveal state, reset on screen unmount

**Verify:** Create pin with timecode, view sorted list, spoiler blurs correctly, movie pin (no episode) works.

### Week 4 — Polish, QA, Deploy

23. `app/(tabs)/profile.tsx` — stats query, logout, delete account (with warning)
24. Social login — Google + Apple OAuth via Supabase Auth
25. Error / empty / loading states — apply to all screens
26. RLS security test — query other user's data, confirm blocked
27. FlashList perf test — 20+ pins scenario
28. EAS Build setup (`eas.json`, `app.json`)
29. TestFlight / Play Store internal test submission

---

## Critical Component: TimecodeInput

Read `docs/09_timeline_pin_ux.md §2` fully. Key behavior:

```typescript
// Behavior spec:
// - keyboardType="numeric", numbers only
// - On blur: auto-format input
//   "1234"   → "12:34"   (754 seconds)
//   "123456" → "1:23:45" (5025 seconds)
//   "12"     → "00:12"   (12 seconds)
// - Calls onChangeSeconds(number | null)
//   empty input → onChangeSeconds(null)
// - If maxSeconds provided and input exceeds it:
//   show inline warning on blur (soft warning only, NOT a hard block)
//   hard block happens in Zod schema at save time
// - Component never stores seconds internally — only the formatted string
// - Parent (PinComposer) stores timestamp_seconds as number | null via RHF

interface TimecodeInputProps {
  value: string;                            // display string "12:34"
  onChangeSeconds: (s: number | null) => void;
  maxSeconds?: number;                      // episode duration for validation
  placeholder?: string;
}
```

---

## Critical Component: PinComposer Zod Schema

```typescript
import { z } from 'zod';

export const createPinSchema = z.object({
  timecodeDisplay: z.string().optional(),   // UI only, not sent to DB
  timestamp_seconds: z.number().int().min(0).nullable(),
  memo: z.string().max(500).nullable(),
  tags: z.array(z.string().min(1).max(20)).max(10).default([]),
  emotion: z.enum([
    'excited', 'moved', 'funny', 'sad', 'surprised',
    'angry', 'scared', 'love', 'boring', 'none'
  ]).default('none'),
  is_spoiler: z.boolean().default(false),
}).refine(
  (data) => data.timestamp_seconds !== null || (data.memo !== null && data.memo.trim().length > 0),
  { message: '타임스탬프 또는 메모 중 하나는 필수입니다', path: ['memo'] }
);
```

---

## TanStack Query Key Conventions

```typescript
// Query keys — use these exact patterns for consistent cache invalidation
const queryKeys = {
  library: (userId: string) => ['library', userId] as const,
  libraryItem: (userId: string, contentId: string) => ['library', userId, contentId] as const,
  pins: (userId: string, contentId: string, episodeId: string | null) =>
    ['pins', userId, contentId, episodeId] as const,
  episodes: (seasonId: string) => ['episodes', seasonId] as const,
  search: (query: string) => ['search', query] as const,
  contentDetail: (contentId: string) => ['content', contentId] as const,
};

// staleTime settings
// pins: 30_000 (30s)
// library: 60_000 (1min)
// search results: 300_000 (5min)
// content detail: 600_000 (10min)
```

---

## Supabase Client Setup

```typescript
// lib/supabase.ts
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

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# Do NOT put service_role key here — server only
```

---

## Edge Function: search-content (Key Points)

Full implementation is in `docs/07_edge_functions.md §3`. Summary:

- POST `/functions/v1/search-content`
- Body: `{ query: string, media_type?: 'anime'|'movie'|'tv', page?: number }`
- Calls TMDB + AniList in parallel via `Promise.allSettled`
- Checks `external_search_cache` first (SHA-256 key, 1hr TTL)
- Returns `{ results: ContentSearchResult[], partial: boolean }`
- `ContentSearchResult` must include `source: 'tmdb' | 'anilist'` field for UI label
- API keys from `Deno.env.get('TMDB_API_KEY')`, `Deno.env.get('ANILIST_API_KEY')`

---

## Edge Function: add-to-library (Key Points)

Full implementation is in `docs/07_edge_functions.md §4`. Summary:

- POST `/functions/v1/add-to-library`
- Extract `user_id` from JWT: `const { data: { user } } = await supabase.auth.getUser()`
- **Never trust client-passed user_id**
- Steps: check duplicate → upsert `contents` → upsert `content_external_ids` → upsert `seasons` (not episodes) → INSERT `user_library_items` → INSERT `metadata_sync_logs`
- Return 409 if already in library
- `service_role` client for content table writes

---

## Movie Pin Flow (episodeId = null)

```typescript
// Navigation to pin creation for a movie
router.push({
  pathname: '/pins/new',
  params: { contentId: content.id }  // no episodeId
});

// In pins/new.tsx
const { contentId, episodeId } = useLocalSearchParams();
// episodeId will be undefined for movies

// In PinComposer
// When episodeId is null/undefined: hide episode selector entirely
// Pass episodeId: null to the insert query

// Supabase insert
const { error } = await supabase.from('timeline_pins').insert({
  user_id: session.user.id,
  content_id: contentId,
  episode_id: episodeId ?? null,   // null for movies
  timestamp_seconds: formData.timestamp_seconds,
  // ...
});

// Query pins for a movie (episode_id IS NULL)
const { data } = await supabase
  .from('timeline_pins')
  .select('*, timeline_pin_tags(tag_id, tags(name))')
  .eq('user_id', session.user.id)
  .eq('content_id', contentId)
  .is('episode_id', null)
  .order('timestamp_seconds', { ascending: true, nullsFirst: false })
  .order('created_at', { ascending: true });
```

---

## Spoiler Handling

```typescript
// atoms/spoilerAtom.ts (Jotai)
import { atom } from 'jotai';
export const revealedSpoilerPinIdsAtom = atom<Set<string>>(new Set());

// In PinTimelineItem
const [revealedIds, setRevealedIds] = useAtom(revealedSpoilerPinIdsAtom);
const isRevealed = revealedIds.has(pin.id);

const revealSpoiler = () => {
  setRevealedIds(prev => new Set([...prev, pin.id]));
};

// Reset on screen unmount
useEffect(() => {
  return () => setRevealedIds(new Set());
}, []);

// Blur implementation — if expo-blur is unavailable, use opacity overlay
// View with opacity 0.1 + "스포일러 — 탭하여 보기" text overlay
```

---

## Cache Invalidation Pattern

```typescript
// After creating a pin
const queryClient = useQueryClient();

// Invalidate the pin list for this episode/content
await queryClient.invalidateQueries({
  queryKey: queryKeys.pins(userId, contentId, episodeId)
});

// After changing library status
await queryClient.invalidateQueries({
  queryKey: queryKeys.library(userId)
});
await queryClient.invalidateQueries({
  queryKey: queryKeys.libraryItem(userId, contentId)
});
```

---

## What NOT to Build

- No dark mode (Phase 2)
- No push notifications (Phase 2)
- No Highlight Reel / public pins (Phase 2)
- No recommendation engine (Phase 3)
- No social features / follow system (Phase 3)
- No Kitsu or TVmaze API integration (Phase 2)
- No offline mode (Phase 2)
- No pin export (Phase 2)
- No timeline progress-bar view — list view only (Phase 2)
- Do NOT create dummy episodes for movies — use `episode_id = NULL`
- Do NOT bulk-cache search results into contents table
- Do NOT put service_role key in the Expo app

---

## QA Checklist (Run Before Marking Done)

- [ ] Sign up → log in → session persists on restart
- [ ] Search returns results with TMDB and AniList source labels
- [ ] Add to library → appears in library list with correct status
- [ ] Create pin with timecode on an episode → appears in pin list sorted by time
- [ ] Create movie pin (no episode) → episode selector hidden, pin saved with episode_id = null
- [ ] Two pins at same timestamp on same episode → both appear (no error)
- [ ] Spoiler pin → memo blurred → tap to reveal → works
- [ ] Spoiler state resets when navigating away and back
- [ ] Try to access another user's pins via direct Supabase query → blocked by RLS
- [ ] FlashList with 20+ pins → no jank
- [ ] `timestamp_seconds` with negative value → rejected by Zod + DB CHECK
- [ ] Pin with no timestamp AND no memo → rejected by form + DB CHECK
- [ ] EAS build succeeds for iOS and Android

## PROMPT END
