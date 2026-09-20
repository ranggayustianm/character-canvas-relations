"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RELATIONSHIP_LIST } from "@/lib/relationships";

export function Toolbar({
  boardName,
  onRename,
  onExport,
  exportDisabled,
}: {
  boardName: string;
  onRename: (name: string) => void;
  onExport: () => void;
  exportDisabled: boolean;
}) {
  const [name, setName] = useState(boardName);
  useEffect(() => setName(boardName), [boardName]);

  const [exporting, setExporting] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
      <Link
        href="/"
        className="rounded-lg px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        ← Boards
      </Link>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onRename(name)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Board name"
        className="w-56 rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-zinc-900 hover:border-zinc-300 focus:border-blue-500 focus:outline-none"
      />

      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Saved
      </span>

      <div className="ml-auto hidden items-center gap-2.5 lg:flex" aria-label="Relationship colors">
        {RELATIONSHIP_LIST.map((r) => (
          <span key={r.kind} className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{
                backgroundColor: r.dashed ? "transparent" : r.color,
                backgroundImage: r.dashed
                  ? `repeating-linear-gradient(to right, ${r.color} 0 4px, transparent 4px 7px)`
                  : undefined,
              }}
            />
            {r.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        disabled={exportDisabled || exporting}
        onClick={async () => {
          setExporting(true);
          try {
            await onExport();
          } finally {
            setExporting(false);
          }
        }}
        className="ml-4 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {exporting ? "Exporting…" : "Export PNG"}
      </button>
    </header>
  );
}
