# SceneNote — Codex 구현 프롬프트 (복사해서 Codex에 붙여넣기)

아래 **전체 블록**을 Codex 에이전트 첫 메시지로 사용하세요.

---

## ROLE & GOAL

You are implementing **design-compliance fixes** for **SceneNote**, an Expo (React Native) + TypeScript + Supabase app. Paths use **`@/*` → `src/*`** (`tsconfig.json`). **Do not add new product features** beyond what the checklist requires. **Never commit API keys or secrets**; client code must only use `EXPO_PUBLIC_*` env vars.

---

## READ FIRST (source of truth)

1. `docs/10_mvp_integration_plan.md`
2. `docs/08_frontend_architecture.md`
3. `docs/09_timeline_pin_ux.md` (TimecodeInput — critical)
4. `docs/07_edge_functions.md`
5. `docs/cursor_verification_prompt.md` (full checklist + Rule 1–8)

---

## CURRENT CODE FACTS (do not regress)

- Supabase client & QueryClient already live under **`src/lib/`** (`supabase.ts`, **`src/lib/query.ts`** exports `queryClient` + `queryKeys`). Prefer **extending** these files rather than creating duplicate root-level `lib/`.
- Hooks live under **`src/hooks/`** (`useTimelinePins.ts`, `useLibrary.ts`, `useContentSearch.ts`, …).
- Pin CRUD uses **`src/services/pins.ts`** — pin ordering **must stay**:
  `.order('timestamp_seconds', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })`.
- **`app/pins/[id].tsx`** handles **new pins** when `id === "new"` with `contentId` / optional `episodeId` params — behavior is valid; if docs demand `app/pins/new.tsx`, you may add a **thin route** that redirects to the same flow **without** duplicating screens.
- Edge function: `supabase/functions/search-content/index.ts` — **MVP must not call Kitsu/TVmaze by default** (see below).

---

## IMPLEMENTATION ORDER

### 1) Dependency

- Run: `npm install jotai`
- Use Jotai **only** for: pin form draft, per-screen spoiler reveal set, tag filter set — per `docs/08_frontend_architecture.md`. **Do not** put auth in Jotai.

### 2) Jotai atoms (create `src/atoms/`)

Add (or align names with the design doc):

- `pinFormAtom.ts` — `pinFormDraftAtom` with `timecodeDisplay`, `timestamp_seconds`, `memo`, `tags`, `emotion`, `is_spoiler` (see `docs/cursor_verification_prompt.md` §2-E).
- `spoilerAtom.ts` — `revealedSpoilerPinIdsAtom: Set<string>`
- `tagFilterAtom.ts` — `selectedTagFilterIdsAtom: Set<string>`

**Migration:** Replace overlapping state in `src/stores/pinComposerStore.ts` (and any duplicate spoiler `useState` in lists) with these atoms where it reduces duplication. Keep changes minimal and consistent with existing components.

### 3) Zustand — global only

- Add **`src/stores/appUIStore.ts`** (toast queue: `addToast`, `removeToast`, `toasts[]`) as in `docs/cursor_verification_prompt.md` §2-D.
- **`src/stores/authStore.ts`:** Add **`persist` + `createJSONStorage` + AsyncStorage** for `session`/`user` **if** it matches app bootstrap in `app/_layout.tsx` / `AppProviders`. Preserve existing fields (`isLoading`, `setLoading`, `reset`) and ensure **AuthGate** still works — adjust initialization so loading/session hydration is correct.

### 4) Pin list — Rule 7 (`docs/cursor_verification_prompt.md`)

- Use **`revealedSpoilerPinIdsAtom`** for spoiler reveal IDs (not local `useState` inside the list if the design says Jotai).
- On **`app/content/[id]/pins.tsx`** unmount, reset revealed IDs:

```ts
const setRevealedIds = useSetAtom(revealedSpoilerPinIdsAtom);
useEffect(() => () => setRevealedIds(new Set()), [setRevealedIds]);
```

### 5) `PinTimelineList` — FlashList

- Add **`estimatedItemSize`** (and any props FlashList needs per `@shopify/flash-list` docs) so the list matches the verification checklist.

### 6) Routing — tabs search

- Design target: **`app/(tabs)/search.tsx`** (not root `app/search.tsx`).
- Move or re-export search screen into `(tabs)`, wire **`app/(tabs)/_layout.tsx`** with a **Search** tab, and remove/adjust the duplicate **`Stack.Screen name="search"`** in `app/_layout.tsx` so navigation is not broken.
- Keep deep-link behavior consistent.

### 7) Onboarding P0

- Add **`app/(auth)/onboarding.tsx`**: simple **3-slide** onboarding leading into login/sign-up, per `docs/10_mvp_integration_plan.md`.
- Wire **`app/(auth)/_layout.tsx`** and auth flow so first-time users can reach it without breaking existing `sign-in` / `sign-up`.

### 8) Edge Function — MVP search sources

- In `supabase/functions/search-content/index.ts`, **`getTargetSources`** must return **only `tmdb` and `anilist`** for MVP defaults (`all`, `anime`, `drama`, etc. per product decision in `docs/10_mvp_integration_plan.md`).
- **Do not delete** `adapters/kitsu.ts` or `adapters/tvmaze.ts`. Add at the **top of each file**:

```ts
// Phase 2 — not active in MVP. Kitsu/TVmaze integration deferred.
// See docs/10_mvp_integration_plan.md §1.3 MVP 제외 목록
```

- Optionally gate Kitsu/TVmaze behind **`Deno.env.get("ENABLE_PHASE2_SEARCH_SOURCES") === "true"`** (or similar) if you need them for later testing — **default off**.

---

## NON-NEGOTIABLE RULES (verify before finishing)

| Rule | Check |
|------|--------|
| **1** | All DB writes: `timestamp_seconds` is `number \| null`, never a display string. |
| **2** | No `UNIQUE (user_id, episode_id, timestamp_seconds)` on `timeline_pins` in migrations. |
| **3** | Movie pins: `episode_id: null` when no episode — no dummy episode rows. |
| **4** | RLS remains on user data tables (do not weaken policies). |
| **5** | `grep -rE 'TMDB_API_KEY|ANILIST_API_KEY|service_role' app/ src/` → **0 matches** in app/src client code. |
| **6** | Pin queries keep the **two `.order()`** calls as above. |
| **7** | Spoiler revealed-set resets on pins screen unmount (after Jotai migration). |
| **8** | Jotai = screen-local; Zustand = global (auth, UI toasts). |

---

## VERIFICATION COMMANDS (run and fix failures)

```bash
npm run typecheck
npm run lint
grep -rE 'TMDB_API_KEY|ANILIST_API_KEY|service_role' app/ src/ --include='*.ts' --include='*.tsx' || true
grep -c 'CREATE POLICY' supabase/migrations/0001_initial_schema.sql
grep 'timestamp_seconds' supabase/migrations/0001_initial_schema.sql
```

---

## DELIVERABLE

- One PR-sized change set: **all checklist items in `docs/cursor_verification_prompt.md` Step 4** satisfied or explicitly reconciled (e.g. `pins/new` as alias).
- Short summary of files touched and any auth/session hydration decisions.

---

**END OF PROMPT**
