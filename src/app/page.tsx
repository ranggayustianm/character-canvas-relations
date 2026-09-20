"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useBoardStore } from "@/lib/store";

function relativeDate(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString();
}

function BoardCard({ boardId }: { boardId: string }) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);
  const duplicateBoard = useBoardStore((s) => s.duplicateBoard);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!board) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            renameBoard(boardId, name);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              renameBoard(boardId, name);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="mb-1 w-full rounded-lg border border-blue-500 px-2 py-1 text-base font-semibold text-zinc-900 focus:outline-none"
        />
      ) : (
        <Link
          href={`/board/${boardId}`}
          className="mb-1 block truncate text-base font-semibold text-zinc-900 hover:text-blue-700"
        >
          {board.name}
        </Link>
      )}
      <p className="mb-3 text-xs text-zinc-500">
        {board.nodes.length} {board.nodes.length === 1 ? "character" : "characters"} ·{" "}
        {board.edges.length} {board.edges.length === 1 ? "connection" : "connections"} ·
        updated {relativeDate(board.updatedAt)}
      </p>
      <div className="flex flex-wrap gap-1 text-xs font-medium">
        <Link
          href={`/board/${boardId}`}
          className="rounded-lg bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700"
        >
          Open
        </Link>
        <button
          type="button"
          onClick={() => {
            setName(board.name);
            setEditing(true);
          }}
          className="rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-100"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => duplicateBoard(boardId)}
          className="rounded-lg px-2 py-1 text-zinc-600 hover:bg-zinc-100"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${board.name}"? This cannot be undone.`)) {
              deleteBoard(boardId);
            }
          }}
          className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const boards = useBoardStore((s) => s.boards);
  const createBoard = useBoardStore((s) => s.createBoard);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const list = mounted
    ? Object.values(boards).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Character Relations Canvas
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Map relationship and hierarchy diagrams for anime, manga, and TV show
              characters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/board/${createBoard()}`)}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            + New board
          </button>
        </div>

        {mounted && list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <p className="text-base font-medium text-zinc-900">No boards yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              Create your first board, search for characters from MyAnimeList or
              TVmaze shows, drop them on the canvas, and connect them with typed
              relationships like family, rival, or mentor.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/board/${createBoard()}`)}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create a board
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((board) => (
              <BoardCard key={board.id} boardId={board.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
