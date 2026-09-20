# Architecture & Code Review — Character Relations Canvas

**Scope reviewed:** full `src/` tree (app router pages, `src/app/api/characters/{jikan,tvmaze}/route.ts`, all 7 components, `src/lib/{api,store,types,relationships,export}.ts`), `package.json` (Next 16.3.1, React 19.2, `@xyflow/react` 12.x, Zustand 5, Tailwind 4), `next.config.ts` (default/empty).
**Out of scope / not verifiable:** see the "Missing files & context" list at the end of §1.

---

## 1. Executive Summary

This is a clean, well-organized codebase for its stage — typed end-to-end, stable `nodeTypes`/`edgeTypes` references, debounced search with race protection (`requestId`), sensible normalize-at-the-edge shapes, and a correct Server-Component shell around a client-only editor. The problems are architectural debt that will compound, not sloppiness.

**Blunt assessment:** the app currently works *because* it is small. Every one of the three core decisions (monolithic localStorage persistence, hardcoded per-provider route handlers, per-frame store writes) is load-bearing and all three fail in the same direction: degradation is gradual, then sudden (quota error, jank wall, API shutdown).

### Top 3 risks

1. **The persistence layer is the app's single point of failure — and it's synchronously hot.** Zustand's `persist` middleware writes the *entire* `boards` record to `localStorage` on **every** `set()`, and `applyNodeChanges` fires a `set()` on every pointer-move frame during node drags (`store.ts` → `applyNodeChanges` sets `updatedAt: Date.now()` unconditionally). That means: full `JSON.stringify` of all boards + a synchronous main-thread `setItem` **on every mousemove**, growing linearly with total data across *all* boards. There is no `version`, no `partialize`, no quota-error handling, and no cross-tab coordination in the persist config. One `QuotaExceededError` on write and the middleware's set path throws mid-interaction; a schema change without `version`/`migrate` silently corrupts or discards stored boards.
2. **The Jikan → Tenrai migration is currently a hard-coded cutover, not a switch.** The provider identity `"jikan"` is baked into the persisted node data (`CharacterNodeData.source`), the UI tab labels, `SOURCE_STYLES`, and the route handler itself (BASE URL lives in `route.ts` with a "will be terminated" comment). Migrating today means a breaking rename that orphans every existing board's node data. External IDs are MAL IDs, which is your saving grace — Tenrai keeps them — but nothing in the code abstracts the concept of "an eastern character provider."
3. **PNG export silently depends on third-party CDN CORS behavior.** `CharacterNode.tsx` sets `crossOrigin="anonymous"` on images from `cdn.myanimelist.net` and `static.tvmaze.com`. If those CDNs don't return `Access-Control-Allow-Origin` (MAL's does not, historically), the image either fails to load under `crossOrigin` or taints the canvas — which is almost certainly why `export.ts` needs the "first call warms up, second call produces the real render" double-`toPng` workaround. This is fragile and will break per-character, per-CDN, per-browser.

### What's working well (worth stating)

- `fetchWithRetry` with 429/5xx-aware backoff, timeouts, and `UpstreamError` status mapping is the right shape for a proxy layer.
- Search race protection (`requestId.current` guard) and 400ms debounce are correct.
- `EMPTY_NODES`/`EMPTY_EDGES` referentially-stable fallbacks in `Canvas.tsx` avoid re-render loops.
- Typed route params (`PageProps<"/board/[id]">`, awaited `params`) are idiomatic current-App-Router.
- TVmaze integration handles the real-world mess (missing `image`, missing `person`, duplicate characters) gracefully.

### Missing files & context (required disclosure — not guessed, listed)

The source you provided is **complete and self-consistent** — everything referenced exists. What's missing is context, and it materially limits confidence:

1. **`node_modules` is not installed in this workspace**, so the bundled Next.js 16.3.1 docs (AGENTS.md warns APIs differ from training data) could not be consulted. Framework-behavior claims below are grounded in your code as written; anything version-sensitive (Data Cache defaults, `revalidate` semantics) is explicitly flagged.
2. **No lockfile** (`package-lock.json`/`bun.lock`/`pnpm-lock.yaml` absent) — dependency drift risk; `next: 16.3.1`-style pins are only as good as the lockfile you're not committing.
3. **No tests of any kind** — no unit tests for `store.ts` (the riskiest file), no contract tests comparing Jikan/Tenrai response shapes. This is the single biggest gap for the migration you're planning.
4. **No ESLint config file** — `eslint-config-next` is in devDependencies, but no `eslint.config.*` is present, so `npm run lint` behavior is unverified.
5. **Unknown deployment target** (Vercel? self-host? static export?). This determines whether `next: { revalidate: 3600 }` Data Cache works at all, whether `next/image` optimization is viable, and whether route handlers are cost-free.
6. **Tenrai's full endpoint docs are behind a JS-rendered SPA** (`api.tenrai.org/documentation` returned no extractable text). I verified Tenrai's existence, Jikan-v1 schema compatibility, excluded endpoint families, and rate-limit tiers from `tenrai.org` and the `tenrai.net` client changelog — but **response-shape parity for your three specific endpoints must be verified empirically during migration** (see §2).
7. **No runtime data** — board counts, node counts, typical payloads. The storage math in §3 is an estimate from the type shapes, not a measurement.

---

## 2. API Strategy & Migration Plan

### 2.1 Current state

Two parallel route handlers, each hardcoding: provider BASE URL, response types, normalization, and query semantics. `src/lib/types.ts` defines the normalized `ApiCharacter`/`ApiShow` — good — but `source: "jikan" | "tvmaze"` leaks into *persisted* data and UI styling, coupling storage schema to provider identity.

### 2.2 Verified Tenrai facts (and what still needs verification)

Verified via tenrai.org and the tenrai.net client changelog:

- **Base URL:** `https://api.tenrai.org/v1` — v1 is explicitly a **drop-in successor to discontinued Jikan v4**, "fully compatible with Jikan, covering 95% of Jikan's endpoints."
- **Rate limits:** Public (no key): **60 req/min, 3 req/sec, 40,000/day**. With a **Server Key** (`X-Server-Key` header): **300 req/min, 5 req/sec**. This is dramatically more generous than Jikan's public tier ever was (60 req/min vs Jikan's ~3/min effective behavior).
- **Not implemented:** users, clubs, watch, forum topics, user-list endpoints — **none of which you use.** Your three endpoints (`/characters?q=`, `/anime?q=`, `/anime/{id}/characters`) fall squarely in the implemented 95%.
- **Server-side fixes vs Jikan:** no duplicate entries in list endpoints, accurate totals, working `last_visible_page` pagination.

Must verify empirically (cannot be confirmed from here — build a 30-minute contract test for this):

1. `/characters?q=...&limit=12&order_by=favorites&sort=desc&sfw=true` — do `order_by`/`sfw` params behave identically?
2. Response shape: `images.jpg.image_url` / `images.webp.image_url` presence and URL host (image CDN host may differ → affects CORS/export, §4.4).
3. `/anime/{id}/characters` — is the `data[].character` + `role` ("Main"/"Supporting") nesting identical?
4. `about` truncation behavior and whether `webp` variants exist.
5. MAL `externalId` stability: Tenrai mirrors MAL, so IDs carry over — but confirm on a handful of known characters.

### 2.3 Step-by-step migration plan

**Step 0 — Pin the contract.** Write a small script (not shipped) that runs the same 10 queries against Jikan and Tenrai and diffs the normalized `ApiCharacter[]` output. You're migrating the *normalized* contract, not the raw API — this makes the diff surface tiny.

**Step 1 — Introduce the provider abstraction (below), with Jikan and Tenrai as two implementations.** Both stay live.

**Step 2 — Decouple persisted identity from provider name.** Existing boards persist `data.source: "jikan"`. Keep that literal as the *storage identity* (it means "a MAL-sourced character with externalId X"), and let the API layer resolve which provider serves "eastern" lookups. If you insist on renaming to `"tenrai"`, you must bump the persist `version` and write a `migrate` function that rewrites every node's `data.source` — I recommend not renaming at all; `"jikan"` as a historical identity label is harmless once the abstraction exists.

**Step 3 — Flip the eastern provider via env.** `EASTERN_PROVIDER=tenrai` (default `"jikan"` locally until the contract test passes). Deploy, watch error rates, flip back instantly if Tenrai misbehaves. Then make `"tenrai"` the default and keep Jikan as fallback for a grace period.

**Step 4 — Rate-limit hygiene.** At 3 req/sec public tier, a user typing in a debounced search (400ms) won't trip it, but server-side you should: (a) honor `Retry-After` on 429 (your `fetchWithRetry` currently backs off 1.5s/3s regardless); (b) single-flight identical concurrent queries (a tiny in-flight `Map<url, Promise>`); (c) optionally read `X-RateLimit-*` headers and log remaining quota.

**Step 5 — Sunset Jikan.** Delete the fallback, delete the provider registration, bump persist version only if you chose to rename identities.

### 2.4 The abstracted API layer (code)

New file `src/lib/providers.ts` — one interface, a registry, and env-driven selection. Route handlers become thin dispatchers; adding/switching providers is a new file + one registry line:

```ts
// src/lib/providers.ts
import type { ApiCharacter, ApiShow } from "./types";
import { fetchWithRetry } from "./api";

export type SourceId = "jikan" | "tenrai" | "tvmaze";

/** The contract every character provider must satisfy. */
export interface CharacterProvider {
  readonly id: SourceId;
  /** Free-text character search. */
  searchCharacters(q: string): Promise<ApiCharacter[]>;
  /** Optional: resolve a show title to its cast (eastern providers). */
  searchShows?(q: string): Promise<ApiShow[]>;
  getShowCast?(showExternalId: string): Promise<ApiCharacter[]>;
}

// ---------- Jikan implementation ----------
const JIKAN_BASE = "https://api.jikan.moe/v4";
type JikanCharacter = {
  id: number; name: string;
  images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
  about?: string | null;
};
const fromJikan = (c: JikanCharacter, subtitle?: string): ApiCharacter => ({
  source: "jikan",                       // NB: this is the PERSISTED identity; see §2.3 step 2
  externalId: String(c.id),
  name: c.name,
  imageUrl: c.images?.jpg?.image_url ?? c.images?.webp?.image_url,
  about: c.about?.slice(0, 300) || undefined,
  subtitle,
});

const jikan: CharacterProvider = {
  id: "jikan",
  async searchCharacters(q) {
    const res = await fetchWithRetry(
      `${JIKAN_BASE}/characters?q=${encodeURIComponent(q)}&limit=12&order_by=favorites&sort=desc&sfw=true`
    );
    const json = (await res.json()) as { data: JikanCharacter[] };
    return json.data.map((c) => fromJikan(c));
  },
};

// ---------- Tenrai implementation (Jikan-shaped; adjust after contract test) ----------
const TENRAI_BASE = "https://api.tenrai.org/v1";
// Tenrai public tier: 60 req/min, 3 req/sec. Server Key (X-Server-Key) raises to 300/min.
const tenrai: CharacterProvider = {
  id: "tenrai",
  async searchCharacters(q) {
    const headers: Record<string, string> = {};
    if (process.env.TENRAI_SERVER_KEY) headers["X-Server-Key"] = process.env.TENRAI_SERVER_KEY;
    const res = await fetchWithRetry(
      `${TENRAI_BASE}/characters?q=${encodeURIComponent(q)}&limit=12&order_by=favorites&sort=desc&sfw=true`,
      { headers }
    );
    const json = (await res.json()) as { data: JikanCharacter[] }; // same schema, per docs
    return json.data.map((c) => ({ ...fromJikan(c), source: "jikan" as const })); // keep persisted identity stable
  },
};

// ---------- Registry ----------
const REGISTRY: Record<string, CharacterProvider> = { jikan, tenrai };
/** Eastern source is env-switchable with zero code change at cutover time. */
export const easternProvider = (): CharacterProvider =>
  REGISTRY[process.env.EASTERN_PROVIDER ?? "jikan"] ?? jikan;

// Small helper to coalesce identical in-flight upstream GETs (rate-limit hygiene).
const inflight = new Map<string, Promise<Response>>();
export async function fetchDeduped(url: string, init?: RequestInit): Promise<Response> {
  const hit = inflight.get(url);
  if (hit) return hit;
  const p = fetchWithRetry(url, init).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
```

Then a route handler becomes provider-agnostic:

```ts
// src/app/api/characters/eastern/route.ts  (replaces jikan/route.ts)
import { easternProvider } from "@/lib/providers";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ error: "Missing ?q" }, { status: 400 });
  try {
    return Response.json({ characters: await easternProvider().searchCharacters(q) });
  } catch (err) {
    return errorResponse(err);
  }
}
```

Note that `fetchWithRetry` currently accepts only a URL — the snippet above passes an `init`; widen its signature (`url, init?, timeoutMs?`) and thread `headers` through. Also fix its 429 handling to honor `Retry-After`:

```ts
// in fetchWithRetry, on 429:
const retryAfter = Number(res.headers.get("retry-after"));
await new Promise((r) => setTimeout(r, (retryAfter || BACKOFF_MS[attempt] ?? 3) * 1000));
```

### 2.5 TVMaze integration review (pitfalls)

Your TVmaze code is the *better* of the two integrations, but review these:

- **Search accuracy.** `/search/shows?q=` is prefix/score-based, and the exact match is **not guaranteed to rank first** (e.g., partial titles, regional aliases). You slice top 10 — reasonable — but there's no pagination and no "did you mean" affordance. Consider also matching on `premiered` year display (you already do) and, if accuracy complaints appear, adding TVmaze's `tvmaze`-id-based deep links for curation. Low effort: show the network/year in results so users disambiguate long-running shows (e.g., multiple "The Office" entries).
- **Caching.** TVmaze has no hard documented rate limit but explicitly asks consumers to cache aggressively. Your `next: { revalidate: 3600 }` on the upstream fetch opts into the Next Data Cache keyed by full URL — good and version-appropriate here (⚠️ flagged: verify Data Cache behavior on your actual Next 16.3.1 + deployment target; it requires a server runtime host, not static export). Add explicit `Cache-Control` on your own route responses (`s-maxage=3600, stale-while-revalidate=86400`) so a CDN can absorb repeat queries even if the Data Cache misses.
- **Missing data — mostly handled, two gaps.** You already guard `image: null`, `person: null`, unnamed/duplicate characters. Gaps: (1) `cast` responses are unbounded — some shows return 100+ entries; slice or virtualize. (2) For older shows, `character.image` is frequently `null` while `person.image` exists — falling back to the actor photo is a one-line improvement users will notice:
  ```ts
  imageUrl: c.image?.medium ?? c.image?.original
            ?? entry.person?.image?.medium ?? undefined,
  ```
- **ID stability.** TVmaze character IDs are stable; persisting `source: "tvmaze"` + `externalId` is fine for rehydration/reference later.

---

## 3. State & Storage Analysis

### 3.1 How it works today

`store.ts` uses `create()(persist((set, get) => …), { name: "character-relations-boards" })` — Zustand's persist middleware with **all defaults**: `localStorage`, synchronous `JSON.stringify` of the **entire `boards` record** on every `set()`, no `version`, no `partialize`, no `migrate`, no storage-error handling. Every mutation in the store calls `set()` with a new `boards` object.

### 3.2 The hard limits, concretely

**Capacity (~5 MB, varies by browser).** Your persisted node is small by design (`CharacterNodeData`: source, externalId, name, imageUrl, subtitle + React Flow's `id`, `type`, `position`, `measured` can sneak in): realistically **~300–500 B/node** in JSON, ~150 B/edge. Estimate: 20 boards × 60 nodes × 400 B ≈ **0.5 MB** — fine. 100 boards × 150 nodes → **~7 MB → QuotaExceededError**, and nothing handles it. `localStorage.setItem` throws; Zustand's persist will surface that as an exception inside `set()` — mid-drag, mid-interaction. Also note: `applyNodeChanges` can persist React Flow's internal `measured`/`selected` fields into node objects, inflating payloads beyond the estimate.

**Synchronous main-thread cost — the actual killer.** Because `persist` is synchronous and whole-record:

- During a **node drag**, React Flow emits `position` `NodeChange`s per pointer-move frame (~60/s). Each one → `applyNodeChanges` → `set()` → `JSON.stringify(all boards)` + `localStorage.setItem`. At 1 MB total data that's a multi-millisecond main-thread stall *per frame* — and it scales with your **total** corpus, not the open board. This is the architectural bottleneck, not the 5 MB ceiling.
- `updatedAt: Date.now()` is written on every change batch, which (see §4.1) also fans out re-renders to every subscribed component.

**No schema versioning.** No `version`/`migrate` means any shape change to `Board`/`CharacterNodeData` (including a Tenrai rename) either breaks rehydration or needs hand-rolled defensive parsing. This will bite during the API migration.

**No cross-tab or cross-device story.** Two open tabs = last-writer-wins full-record clobbering (no `storage` event handling, no merge). Clearing browser data = total loss. "Mini-Miro" users *will* expect at least multi-tab sanity.

**What's right:** you persist URLs, not images (never store data-URLs in localStorage — you'd 10× the size); IDs are UUIDs; the store shape is a flat record — easy to lift later.

### 3.3 Recommended upgrades (tiered, with code)

**Tier A — this week, ~1 hour: make persistence correct before making it faster.**

```ts
// store.ts
persist((set, get) => ({ /* unchanged */ }), {
  name: "character-relations-boards",
  version: 1,                      // every future shape change bumps this
  partialize: (s) => ({ boards: s.boards }),   // actions were already excluded, be explicit
  migrate: (persisted, version) => {
    // future migrations live here instead of breaking rehydration
    return persisted as { boards: Record<string, Board> };
  },
  storage: quotaSafeStorage,       // below
});

// A quota-safe wrapper: degrade to in-memory instead of throwing mid-drag.
import { createJSONStorage } from "zustand/middleware";
const quotaSafeStorage = createJSONStorage(() => {
  try {
    const probe = "__probe__";
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    console.warn("localStorage unavailable — board changes will not persist");
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} } as Storage;
  }
});
```

Plus **stop persisting drags frame-by-frame**: positions are transient until the drag ends. In `Canvas.tsx`, filter drag-position changes out of the store write and commit once:

```ts
const handleNodesChange = (changes: NodeChange<CharacterNode>[]) => {
  // selection/dimension changes go through; drag positions commit on drag stop
  const nonPosition = changes.filter((c) => c.type !== "position" || !c.dragging);
  if (nonPosition.length) applyNodeChanges(boardId, nonPosition);
};
// add onNodeDragStop={(e, node) => applyNodeChanges(boardId, [
//   { id: node.id, type: "position", position: node.position, dragging: false },
// ])}
```

**Tier B — this month: move the blob to IndexedDB.** Same Zustand store, async storage. IndexedDB gives ~10s of MB to GBs and async writes; combined with the drag-stop commit above, the main thread is clean during interaction. `idb-keyval` (400 B) or `localforage`:

```ts
import { createJSONStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

const idbStorage = createJSONStorage<{ boards: Record<string, Board> }>(() => ({
  getItem: async (name) => (await idbGet(name)) ?? null,
  setItem: async (name, value) => { await idbSet(name, value); },
  removeItem: async (name) => { await idbDel(name); },
}));
// persist({ ... }, { name: "character-relations-boards", storage: idbStorage, version: 1, ... })
```

Caveats to handle: reads become async → keep your existing `mounted` gate (it already protects SSR hydration); add a one-time migration that reads the old localStorage key and writes it into IDB; consider debounced writes (500 ms trailing) so bursts of small edits don't each hit IDB.

**Tier C — the real fix for "mini-Miro": a lightweight backend.** localStorage/IndexedDB is fine for single-browser toy use, but the moment you want boards on two devices, shareable links, or multiplayer cursors, you want a reactive document backend rather than hand-rolled sync. My recommendation for this exact app: **Convex** — JSON-document tables map 1:1 onto your `Board { nodes, edges }` shape, queries are realtime subscriptions (multi-tab consistency for free), the free tier is generous, and the client is a thin provider in `layout.tsx`. Alternatives: **Supabase** (Postgres + auth + realtime if you prefer SQL/RLS) or **MongoDB Atlas** (if you want a classic document DB). For fully offline-first multiplayer later, the whiteboard-native answer is **Yjs** (`y-indexeddb` + a websocket provider) — but don't reach for CRDTs before you need actual multiplayer.

Migration from localStorage to a backend is easy *because* your data is one JSON blob per app: a one-time "upload my local boards" button that POSTs the persisted record, then flips a flag. Keep IndexedDB as the offline cache after that.

---

## 4. Next.js & Code Quality Review

### 4.1 Re-render behavior during drag (the main performance issue)

Trace a single drag frame today:

1. React Flow emits `position` changes → `Canvas.handleNodesChange` → `store.applyNodeChanges` → `set()` creates a **new `boards` record** (plus a new `Board`, plus a new `nodes` array).
2. Components subscribed to anything along that reference chain re-render **every frame**:
   - `Canvas` (subscribes `nodes`) — expected, nodes changed.
   - `BoardEditor` (subscribes the **whole board** `s.boards[boardId]`) — re-renders the entire editor shell (Toolbar, SearchPanel, toast area) per frame. This should select only what it renders: `s.boards[boardId]?.name`, existence, counts. Since it passes `board.nodes.length` etc. to children, derive with narrow selectors or `useShallow`.
   - `page.tsx` home (subscribes `s.boards`) — any change anywhere re-renders every `BoardCard`; the per-board `BoardCard` selectors are already the right pattern, but the list container should subscribe to a stable derived list (or `useShallow` on a projected array).
   - Persist middleware does its stringify+write per frame (§3.2).

Fixes, in order of impact: (1) drag-stop commit / position-change filtering (§3.3 Tier A); (2) narrow `BoardEditor` selectors; (3) `useShallow` for projected arrays; (4) optionally `React.memo` on `Toolbar`/`SearchPanel` (props are stable) as belt-and-braces. React Flow itself is fine here — node components are memoized internally and `nodeTypes`/`edgeTypes` are correctly defined at module scope (a very common mistake you avoided).

One subtle correctness nit: `handleNodesChange`/`handleEdgesChange` are recreated each render and passed to `ReactFlow`; cheap, but wrap in `useCallback` for consistency with the rest of the file.

### 4.2 `'use client'` delineation — mostly right

- `board/[id]/page.tsx` is an async Server Component that awaits `params` and renders the client editor — correct and idiomatic for a fully interactive route.
- `page.tsx` (home) is `"use client"` for the whole page. It's justified by the localStorage-driven list, but the cleaner shape is a Server Component page + a small client `<BoardList />` (the mounted-gate logic moves inside it). Minor; do it opportunistically.
- `SearchPanel`, `Toolbar`, `EdgeEditor`, node/edge components: correctly client. No server/client boundary violations found; no unnecessary `"use client"` on non-component modules.
- The `mounted` hydration gate is the correct pattern for localStorage-backed state (avoids hydration mismatch); the skeleton placeholder is a nice touch. Once you adopt IDB/backend, this gate becomes the async-loading gate — same code.

### 4.3 Code quality nits (worth a pass, none urgent)

- **`fetchWithRetry`**: solid design; improvements listed in §2.4 (accept `init`, honor `Retry-After`). The final `throw new UpstreamError("Unreachable", 502)` after the loop is dead code (the loop always returns or throws) — harmless.
- **`SearchPanel`**: `res.json()` on the error path can itself throw if the server returned non-JSON (e.g., an HTML 502 from a proxy) → wrap in try/catch and fall back to a generic message. The `requestId` race guard is good; keep it when you refactor.
- **`EdgeEditor`**: the `useEffect` syncing `label` depends on `edge?.data?.label` (object identity churns every board change) but only sets identical strings, so React bails — fine, just noting it's load-bearing.
- **`store.ts`**: `duplicateBoard`'s `structuredClone` is right. `touch()` is defined but never called — dead code or a missing integration; decide which.
- **`export.ts`**: `document.querySelector(".react-flow__viewport")` reaches outside React — acceptable pragmatism, but pass the ref from `BoardEditor` if you touch this file anyway.
- **`types.ts`** re-exporting `Edge`/`Node` is fine. `ApiShow.source` typed as literal `"tvmaze"` while `ApiCharacter.source` is the union — intentional? Probably fine, just noting the asymmetry.
- **Persistence schema**: everything in §3 (version/migrate) is the highest-value small change in the codebase.

### 4.4 The export/CORS issue (worth fixing before the API migration)

`CharacterNode.tsx` uses `<img crossOrigin="anonymous">` for MAL/TVmaze CDN images, required by `html-to-image` to avoid canvas tainting. MAL's CDN has historically not sent permissive CORS headers, so: with `crossOrigin="anonymous"`, a non-CORS image **fails to load entirely** (worse than tainting), and TVmaze behavior may differ per-CDN. The double-`toPng` call suggests you've already fought symptoms. The robust fix is to **serve images from your own origin**: a tiny image-proxy route handler (e.g., `/api/img?u=…` with a host allowlist for `cdn.myanimelist.net`, `static.tvmaze.com`, and Tenrai's CDN) with `Cache-Control` headers. That makes `crossOrigin` unnecessary (same-origin ⇒ no taint), stabilizes export, and de-risks the Tenrai image-host switch in §2.2. (Alternative: `next/image` with `remotePatterns` — its optimizer also same-origins images — but inside React Flow nodes, the plain proxy is simpler and avoids `<Image>` layout quirks in absolutely-positioned nodes.)

### 4.5 Framework-version caveat

`next.config.ts` is empty (fine). Everything you use (`PageProps<"…">` typed routes, awaited `params`, route handlers, `next: { revalidate }` on fetch, `next/font`) is consistent with current App Router conventions as used in your code. Because `node_modules` was absent I could not cross-check 16.3.1-specific deprecations; before the migration, run `npm run build` locally and read any deprecation warnings — and do not rely on the Data Cache if you ever move to a static-export host.

---

## 5. Actionable Next Steps

**Immediate (this week)**

1. Add `version`, `partialize`, a quota-safe storage wrapper, and a stub `migrate` to the persist config in `store.ts` (§3.3 Tier A). One hour, removes the silent-data-loss class of bugs.
2. Stop persisting drag frames: filter `position`/`dragging` changes out of `applyNodeChanges` and commit on `onNodeDragStop` (§3.3 Tier A). This is the single biggest runtime-performance win.
3. Narrow the `BoardEditor` store selectors (subscribe to `name`/existence/counts, not the whole board) and `useShallow` the home-page board list.
4. Commit a lockfile and verify `npm run build` + lint clean on Next 16.3.1 (also un-blocks the bundled-docs check in §4.5).

**Short-term (this month)**

5. Build the provider abstraction (`src/lib/providers.ts`, §2.4) with Jikan and Tenrai both registered and an `EASTERN_PROVIDER` env switch. Widel `fetchWithRetry` to accept `init` and honor `Retry-After`.
6. Write the Jikan↔Tenrai contract-diff script for your three endpoints (§2.2 items 1–5) and the image-CDN-host check. Gate the cutover on it.
7. Add the image-proxy route with a host allowlist and drop `crossOrigin="anonymous"` (§4.4) — stabilizes PNG export and de-risks Tenrai's CDN.
8. Add the person-image fallback and a cast-size slice for TVmaze (§2.5).
9. Introduce a minimal test harness: unit tests for `store.ts` mutations + the persist `migrate` function, and one test per provider normalizer. This is what makes the cutover safe.
10. TVmaze/eastern route responses: add explicit `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.

**Long-term (this quarter)**

11. Move persistence to IndexedDB (`idb-keyval` + `createJSONStorage`, §3.3 Tier B) with a one-time localStorage→IDB migration on first load.
12. Stand up a lightweight backend (recommend Convex for this app's shape; Supabase if you want SQL/RLS, Atlas if you want a classic document DB) with a "keep my local boards" importer; keep IDB as offline cache. Add basic auth before sharing boards publicly.
13. Add cross-tab correctness (even just `storage`-event refresh, or full reactive sync once the backend lands).
14. If/when multiplayer matters: Yjs + y-indexeddb + websocket provider for the canvas layer, backend for board metadata.
15. Retire Jikan: delete the fallback provider, its route, and the "will be terminated" comment that is currently your only migration documentation.

*Generated as a point-in-time review of the provided code; file/line references are to the tree as reviewed.*
