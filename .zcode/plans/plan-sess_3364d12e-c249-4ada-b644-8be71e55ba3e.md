# Character Relations Canvas — mini-Miro for fictional character relationship diagrams

Greenfield Next.js app in the (empty) current directory.

## Stack
- **Next.js 15** (App Router, TypeScript, Tailwind, ESLint) via `create-next-app`
- **@xyflow/react** (React Flow v12) — the diagram canvas
- **zustand** + `persist` middleware — state + localStorage persistence (no DB)
- **html-to-image** — PNG export
- Data sources: **Jikan v4** (anime/manga characters) + **TVmaze** (Western TV characters) — both free, no API keys. TVmaze's response shape was verified live during planning; Jikan was intermittently 504-ing, which informs the caching/retry design below.

## Data model (`src/lib/types.ts`)
```ts
type CharacterData = {           // React Flow node data
  source: 'jikan' | 'tvmaze';
  externalId: number | string;
  name: string;
  imageUrl?: string;
  subtitle?: string;             // anime title or TV show name
  about?: string;
};
type RelationshipKind = 'family' | 'ally' | 'rival' | 'romantic' | 'mentor' | 'other';
// edge data = { kind: RelationshipKind, label?: string }  (custom label on top of the kind)
type Board = { id, name, nodes: CharacterNode[], edges: RelationshipEdge[], createdAt, updatedAt };
```
`src/lib/relationships.ts` defines each kind's color + default label (e.g. rival = dashed red, romantic = pink, family = green solid) used for edge styling and a color legend in the toolbar.

## API layer — 2 route handlers that proxy + cache the public APIs
Server-side proxying (instead of direct browser calls) gives us fetch caching (protects Jikan's 3 req/s limit) and unified normalization/error handling.

- `src/app/api/characters/jikan/route.ts`
  - `?q=` → Jikan `GET /v4/characters?q=…&limit=12` (character-name search)
  - `?anime=` → `GET /v4/anime?q=` (take top hit) then `GET /v4/anime/{id}/characters` — "browse by title" mode
  - `next: { revalidate: 3600 }`, one retry with backoff on 429/5xx, return normalized `{ id, name, imageUrl, about, sourceTitle? }` or a friendly error envelope
- `src/app/api/characters/tvmaze/route.ts`
  - `?q=` → `/search/shows?q=` (show list with images)
  - `?cast={showId}` → `/shows/{id}/cast` (character name + image per cast member)

## Store (`src/lib/store.ts`)
zustand persisted to `localStorage` key `character-relations-boards`: `{ boards: Record<id, Board> }` with actions: createBoard, renameBoard, deleteBoard, duplicateBoard, and board-scoped node/edge mutation actions wired to React Flow's `onNodesChange`/`onEdgesChange`/`onConnect`. Auto-saves on every change (persist middleware); top bar shows a "Saved" indicator.

## Pages
1. **`/` — Boards home.** Grid of saved boards (name, character & connection counts, last updated), create/rename/duplicate/delete (delete asks for confirmation). Empty state when no boards.
2. **`/board/[id]` — Editor** (client component, mounted-guard to avoid hydration mismatch with persisted state):
   - **Left sidebar search panel**, two tabs:
     - *Anime & Manga (Jikan)*: sub-toggle "by character / by anime title"; results as avatar cards
     - *TV Shows (TVmaze)*: search shows → click a show → its cast loads as a grid
     - Debounced input (400ms), in-flight indicator, skeletons, error/rate-limit states; click a result (or drag it) to add a node at viewport center. Adding a duplicate character (same source+externalId) re-focuses the existing node instead.
   - **Canvas**: custom `CharacterNode` (image with initials fallback, name, subtitle, source badge; handles on all 4 sides), custom `RelationshipEdge` (color/ dashed style per kind, label via `EdgeLabelRenderer`). Dragging a connection creates an edge (default `other`) and immediately opens the **edge editor popover**: kind picker (colored chips), optional custom label, delete. Controls, MiniMap, dotted background; Delete/Backspace removes selected nodes/edges.
   - **Top bar**: back link, inline-editable board name, saved indicator, relationship color legend, **Export PNG** button.

## PNG export (`src/lib/export.ts`)
Standard React Flow recipe: `getNodesBounds` + `getViewportForBounds` → `html-to-image`'s `toPng` on `.react-flow__viewport`, filename `{board-name}.png`. Known risk: MyAnimeList's CDN may not send CORS headers, breaking image embedding — mitigations in order: `crossOrigin="anonymous"` on node images; if that fails, `imagePlaceholder` with the initials-avatar color. (A tiny image-proxy route is the backup if both fail.)

## File tree (beyond create-next-app defaults)
```
src/
  app/page.tsx                      # boards home
  app/board/[id]/page.tsx           # editor
  app/api/characters/jikan/route.ts
  app/api/characters/tvmaze/route.ts
  components/BoardCard.tsx
  components/BoardEditor.tsx        # layout: sidebar + canvas + topbar
  components/SearchPanel.tsx
  components/Canvas.tsx
  components/CharacterNode.tsx
  components/RelationshipEdge.tsx
  components/EdgeEditor.tsx
  components/Toolbar.tsx
  lib/types.ts, lib/relationships.ts, lib/store.ts, lib/export.ts
```

## Build & verify
1. `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` then `npm i @xyflow/react zustand html-to-image`
2. Implement in order: types/relationships → store → API routes → node/edge components → canvas + editor → boards home → PNG export → polish (empty states, legend, favicon/title)
3. Verify with `npm run build` (type-safe) and a dev-server smoke test: create board → add a Jikan character + a TVmaze character → connect with a typed relationship → label it → export PNG.