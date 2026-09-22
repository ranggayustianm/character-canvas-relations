"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiCharacter, ApiShow } from "@/lib/types";
import { useEditorActions } from "./EditorContext";

type JikanMode = "character" | "anime";
type TvmazeView =
  | { phase: "shows" }
  | { phase: "cast"; show: ApiShow };

const ResultRow = ({ character }: { character: ApiCharacter }) => {
  const { addCharacter } = useEditorActions();
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-character", JSON.stringify(character));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => addCharacter(character)}
      className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-zinc-200 bg-white p-2 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/40"
      title={character.about ? character.about.slice(0, 200) : `Add ${character.name}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-xs font-semibold text-zinc-400">
        {character.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote CDN images
          <img
            src={character.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          character.name.slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-900">
          {character.name}
        </span>
        {character.subtitle && (
          <span className="block truncate text-[11px] text-zinc-500">
            {character.subtitle}
          </span>
        )}
      </span>
      <span className="shrink-0 text-zinc-400" aria-hidden>
        +
      </span>
    </button>
  );
};

const SkeletonRows = () => (
  <div className="space-y-2" aria-label="Loading results">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex animate-pulse items-center gap-2.5 rounded-lg border border-zinc-200 p-2">
        <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" />
        <div className="h-4 w-3/4 rounded bg-zinc-200" />
      </div>
    ))}
  </div>
);

export function SearchPanel() {
  const [tab, setTab] = useState<"jikan" | "tvmaze">("jikan");
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex border-b border-zinc-200">
        {(
          [
            ["jikan", "Anime & Manga"],
            ["tvmaze", "TV Shows"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === key
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "jikan" ? <JikanSearch /> : <TvmazeSearch />}
      </div>
    </aside>
  );
}

function useDebouncedQuery(initial: string) {
  const [input, setInput] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 400);
    return () => clearTimeout(t);
  }, [input]);
  return { input, setInput, debounced, typing: input.trim() !== debounced };
}

type SearchResult<T> = {
  /** Key of the request this result belongs to (mode:query), for derivation. */
  key: string;
  kind: "ok" | "error";
  items?: T[];
  message?: string;
};

function JikanSearch() {
  const { input, setInput, debounced, typing } = useDebouncedQuery("");
  const [mode, setMode] = useState<JikanMode>("character");
  const [result, setResult] = useState<SearchResult<ApiCharacter> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!debounced) return;
    const id = ++requestId.current;
    const key = `${mode}:${debounced}`;
    const param = mode === "character" ? `q=${encodeURIComponent(debounced)}` : `anime=${encodeURIComponent(debounced)}`;
    fetch(`/api/characters/jikan?${param}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Search failed");
        return json as { characters: ApiCharacter[] };
      })
      .then((json) => {
        if (id === requestId.current)
          setResult({ key, kind: "ok", items: json.characters });
      })
      .catch((err: Error) => {
        if (id === requestId.current)
          setResult({
            key,
            kind: "error",
            message: err.message.includes("Rate limited")
              ? "Jikan is rate-limiting us — wait a few seconds and search again."
              : "Couldn't reach Jikan (it can be slow). Try again in a moment.",
          });
      });
  }, [debounced, mode]);

  // loading/error/results are derived from which request `result` belongs to,
  // so the effect never needs a synchronous setState at its start.
  const currentKey = debounced ? `${mode}:${debounced}` : null;
  const fetching = currentKey !== null && result?.key !== currentKey;
  const characters =
    result && result.key === currentKey && result.kind === "ok"
      ? result.items ?? null
      : null;
  const error =
    result && result.key === currentKey && result.kind === "error"
      ? result.message ?? null
      : null;

  const busy = fetching || typing;

  return (
    <>
      <div className="space-y-2 border-b border-zinc-200 p-3">
        <div className="flex rounded-lg bg-zinc-200/70 p-0.5 text-xs font-medium">
          {(
            [
              ["character", "By character"],
              ["anime", "By anime title"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex-1 rounded-md px-2 py-1 transition-colors ${
                mode === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "character" ? "e.g. Luffy, Kakashi…" : "e.g. Naruto, One Piece…"
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            {error}
          </div>
        )}
        {busy && <SkeletonRows />}
        {!busy && !error && characters?.length === 0 && (
          <p className="p-2 text-xs text-zinc-500">No characters found.</p>
        )}
        {!busy &&
          characters?.map((c) => <ResultRow key={`${c.source}-${c.externalId}`} character={c} />)}
        {!busy && !characters && !error && (
          <p className="p-2 text-xs leading-5 text-zinc-500">
            Search for a character name or an anime title, then click a result to add
            it to the board (or drag it onto the canvas).
          </p>
        )}
      </div>
    </>
  );
}

function TvmazeSearch() {
  const { input, setInput, debounced, typing } = useDebouncedQuery("");
  const [view, setView] = useState<TvmazeView>({ phase: "shows" });
  const [showsResult, setShowsResult] = useState<SearchResult<ApiShow> | null>(null);
  const [cast, setCast] = useState<ApiCharacter[] | null>(null);
  const [castLoading, setCastLoading] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (view.phase !== "shows" || !debounced) return;
    const id = ++requestId.current;
    const key = debounced;
    fetch(`/api/characters/tvmaze?q=${encodeURIComponent(debounced)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Search failed");
        return json as { shows: ApiShow[] };
      })
      .then((json) => {
        if (id === requestId.current)
          setShowsResult({ key, kind: "ok", items: json.shows });
      })
      .catch(() => {
        if (id === requestId.current)
          setShowsResult({
            key,
            kind: "error",
            message: "Couldn't reach TVmaze. Try again in a moment.",
          });
      });
  }, [debounced, view.phase]);

  // Shows-phase loading/error are derived from which query `showsResult`
  // belongs to, so the effect never needs a synchronous setState.
  const showsFetching = debounced && showsResult?.key !== debounced;
  const shows = showsResult?.key === debounced && showsResult.kind === "ok" ? showsResult.items ?? null : null;
  const showsError = showsResult?.key === debounced && showsResult.kind === "error" ? showsResult.message ?? null : null;

  const loading = view.phase === "cast" ? castLoading : Boolean(showsFetching);
  const error = view.phase === "cast" ? castError : showsError;

  const openCast = (show: ApiShow) => {
    const id = ++requestId.current;
    setView({ phase: "cast", show });
    setCast(null);
    setCastError(null);
    setCastLoading(true);
    fetch(`/api/characters/tvmaze?cast=${encodeURIComponent(show.externalId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load cast");
        return json as { characters: ApiCharacter[] };
      })
      .then((json) => {
        if (id === requestId.current) setCast(json.characters);
      })
      .catch(() => {
        if (id === requestId.current) setCastError("Couldn't load this show's cast.");
      })
      .finally(() => {
        if (id === requestId.current) setCastLoading(false);
      });
  };

  if (view.phase === "cast") {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3">
          <button
            type="button"
            onClick={() => setView({ phase: "shows" })}
            className="rounded-md px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            ← Shows
          </button>
          <span className="truncate text-sm font-semibold text-zinc-900" title={view.show.name}>
            {view.show.name}
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              {error}
            </div>
          )}
          {loading && <SkeletonRows />}
          {!loading && cast?.length === 0 && (
            <p className="p-2 text-xs text-zinc-500">No cast listed for this show.</p>
          )}
          {!loading && cast?.map((c) => (
            <ResultRow key={`${c.source}-${c.externalId}`} character={c} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="border-b border-zinc-200 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Breaking Bad, Stranger Things…"
          className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            {error}
          </div>
        )}
        {loading || typing ? (
          <SkeletonRows />
        ) : (
          shows?.map((show) => (
            <button
              key={show.externalId}
              type="button"
              onClick={() => openCast(show)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white p-2 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-400">
                {show.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote CDN images
                  <img
                    src={show.imageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  "▶"
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900">
                  {show.name}
                </span>
                {show.premiered && (
                  <span className="block text-[11px] text-zinc-500">
                    {show.premiered.slice(0, 4)}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
        {!loading && !typing && !shows && !error && (
          <p className="p-2 text-xs leading-5 text-zinc-500">
            Search for a TV show, open its cast, then click a character to add them
            to the board.
          </p>
        )}
      </div>
    </>
  );
}
