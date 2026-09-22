# Progress & Next Steps

Working list derived from `ARCHITECTURE_REVIEW.md` §5 plus product requests.
Update this file as items land. Last updated: 2026-09-22.

**Current branch:** `fix/immediate-architecture-review-items` (not pushed, not merged to `master`).
**Baseline rule for all work:** keep `npm run build` and `npm run lint` clean (lint uses eslint-config-next 16.3.1, which enforces `react-hooks/set-state-in-effect` as an error).

---

## Done (commit `4f3df31` — "Harden persistence, fix drag perf, narrow store selectors")

Review §5 "Immediate (this week)" items 1–4, verified in a browser smoke test
(create board, TVmaze search, add nodes, drag + persist across reload, PNG export download):

- [x] **§3.3 Tier A — persistence correctness** (`src/lib/store.ts`): persist now has
  `version: 1`, `partialize` (boards only), stub `migrate`, and `quotaSafeStorage`
  (probe + in-memory fallback; returns a no-op stub when `window` is undefined so
  prerender stays quiet). Dead `touch()` action deleted.
- [x] **§4.1 #1 — drag perf** (`src/components/Canvas.tsx`): `handleNodesChange` drops
  `position` changes with `dragging: true`; `onNodeDragStop` commits final positions
  for all dragged nodes (group drags included). Verified against installed
  `@xyflow` source: XYFlow keeps drag positions in its internal store, so this does
  **not** snap nodes back mid-drag.
- [x] **§4.1 #2–3 — selector narrowing**: `EditorInner` (`BoardEditor.tsx`) subscribes
  only existence/name/nodes.length; callbacks read `useBoardStore.getState()`
  on invocation. Home `page.tsx` uses `useShallow` on a projected sorted id list.
- [x] **§5 #4 — toolchain**: `package-lock.json` and `eslint.config.mjs` were already
  tracked (the review's disclosures #2/#4 were stale). Fixed all 6 **pre-existing**
  `set-state-in-effect` lint errors using official React patterns:
  - `src/lib/useHydrated.ts` (new): `useSyncExternalStore` hydration gate — use this
    instead of `useState(false) + useEffect(() => setMounted(true))` in any new code.
  - `Toolbar.tsx` / `EdgeEditor.tsx`: adjust-state-during-render (prev-value compare).
  - `SearchPanel.tsx`: loading/error/results **derived** from a tagged
    `SearchResult<T>` state (`{ key, kind, items/message }`) — no synchronous setState
    in the fetch effects; `requestId` race guard kept.

**Untested caveat:** handle-to-handle connection drag (edge creation) and the
EdgeEditor dialog flow were not exercised — tiny 6px drag targets could not be
aimed reliably through the test runtime. Not believed broken; retest manually.

---

## Immediate (product requests)

### 1. PNG export must match the current canvas view
**Problem:** `src/lib/export.ts` renders the bounds of **all** nodes at a fixed
1600px width. On big boards the output is huge and unreadable; users expect the
export to show what they currently see at their current zoom.
- Capture the **current viewport transform** (`useReactFlow().getViewport()` — x, y,
  zoom) and the flow pane size, instead of `getNodesBounds` + `getViewportForBounds`.
- Pass the viewport element via a ref from `Canvas`/`BoardEditor` rather than
  `document.querySelector(".react-flow__viewport")` (review §4.3 nit — fix it now,
  the file is being touched anyway).
- Output size = pane size × devicePixelRatio-ish scale factor (decide, e.g. 2×);
  keep the `no-export` toast filter and `imagePlaceholder`.
- Re-check the double-`toPng` warm-up call (export.ts:37–38) — may still be needed
  for CORS images until item 6's proxy lands.

### 2. Compact node for dense hierarchies
**Problem:** `CharacterNode` is ~176×160 (112px image block) — too big for complex
family/hierarchy trees.
- Add a compact presentation (avatar chip + name only, roughly 96×40). Two viable
  shapes: a second `nodeTypes` entry (`characterCompact`) toggled per-board/per-node,
  or a `data.compact` flag on the existing type. Keep `type: "character"` stable in
  persisted data if you use the flag route — a new node `type` string is also
  persist-safe (additive change), but if you change `Board`/`CharacterNodeData`
  **shape**, bump persist `version` and write the `migrate` in `store.ts`.
- Persisted `measured` sizes recompute automatically; edges/handles keep working
  since handles are defined inside the node component.
- Note: `BoardEditor.addCharacter` centers on `position + (88, 70)` assuming the
  current node size — revisit if the compact node is the default for some boards.

### 3. Custom node for outside characters (image upload)
**Problem:** characters that exist in neither MAL nor TVmaze need manual entry.
- New node data variant / `source: "custom"` with user-supplied `name`, optional
  note, and an **uploaded photo**. `CharacterNodeData.source` is typed
  `"jikan" | "tvmaze"` in `src/lib/types.ts` — adding `"custom"` is additive, but it
  is *persisted data*: bump `version` → 2 + handle it in `migrate` if the shape
  changes, or treat `"custom"` as forward-compatible without a bump (no existing
  payload conflicts). Add a `SOURCE_STYLES` entry in `CharacterNode.tsx`.
- UI: a third tab (or section) in `SearchPanel.tsx` — file input + name field,
  "Add to board" button; also plumb through `EditorContext.addCharacter`.
- **Critical storage rule** (review §3.2): do NOT persist raw uploads as data-URLs in
  the store — a single phone photo is 2–5 MB base64 and would blow the localStorage
  quota (quota-safe wrapper would silently stop persisting everything). Downscale +
  re-encode to ≤~20 KB (e.g. 256×256 JPEG via canvas) before storing; revisit when
  IndexedDB (item 7) lands — IDB can hold bigger blobs, consider storing the image
  as a separate IDB entry referenced by URL/Blob id rather than in the node JSON.

## Later this week (review §5 short-term)

4. [ ] **Provider abstraction** (§2.3–2.4): `src/lib/providers.ts` with
   `CharacterProvider` interface, `REGISTRY { jikan, tenrai }`,
   `easternProvider()` driven by `EASTERN_PROVIDER` env (default `jikan`).
   Keep persisted `source: "jikan"` as the storage identity — do NOT rename (§2.3
   step 2). Widen `fetchWithRetry` (`src/lib/api.ts`) to `(url, init?, timeoutMs?)`
   and honor `Retry-After` on 429. Route handler `api/characters/jikan/route.ts`
   becomes a thin dispatcher.
5. [ ] **Jikan↔Tenrai contract test** (§2.2): script (not shipped) diffing the
   normalized `ApiCharacter[]` of the 3 endpoints (`/characters?q=`, `/anime?q=`,
   `/anime/{id}/characters`) for ~10 queries; verify `order_by`/`sfw` params,
   `images.jpg/webp` shape + **CDN host**, `data[].character`/`role` nesting,
   `about` truncation, externalId stability. Gate the cutover on it. Note:
   `api.jikan.moe` is currently unreachable from this network (504) while TVmaze
   works — run the diff from a network with Jikan access.
6. [ ] **Image proxy** (§4.4): `/api/img?u=…` route with host allowlist
   (`cdn.myanimelist.net`, `static.tvmaze.com`, Tenrai CDN) + `Cache-Control`;
   drop `crossOrigin="anonymous"` from `CharacterNode.tsx` (line 36). Do this
   **before** the provider cutover — it de-risks Tenrai's image host and fixes the
   PNG export taint issue behind items 1 and 3.
7. [ ] **IndexedDB persistence** (§3.3 Tier B): `idb-keyval` + async
   `createJSONStorage`; keep `useHydrated()` gate; one-time localStorage→IDB
   migration on first load (remove old key after success); optional 500ms trailing
   debounce on writes. The persist `name` stays `"character-relations-boards"`;
   async storage needs `version`/`migrate` semantics unchanged.
8. [ ] Small review leftovers while in the area: TVmaze person-image fallback +
   cast slice (§2.5), `Cache-Control` on route responses (§2.5/§5-10),
   `SearchPanel` `res.json()` try/catch on error paths (§4.3).

## Conventions worth knowing (established this repo)

- Zustand 5: selectors return primitives/stable refs; `useShallow` imports from
  `zustand/react/shallow`. Actions are stable — no `getState` needed for them.
- `nodeTypes`/`edgeTypes` stay at module scope in `Canvas.tsx` (never inside render).
- Every store mutation keeps `updatedAt: Date.now()` inline; drag positions do NOT
  bump it (filtered in Canvas) — keep that behavior.
- New client hooks must not setState synchronously in effects (lint error) — copy
  the patterns from `SearchPanel.tsx` / `Toolbar.tsx` / `useHydrated.ts`.
- React Flow v12: `onNodeDragStop(event, node, nodes)` — commit all `nodes`, not just
  the first, for group drags. `@xyflow` keeps positions internally during drag.
