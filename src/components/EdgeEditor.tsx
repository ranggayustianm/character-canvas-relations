"use client";

import { useState } from "react";
import { useBoardStore } from "@/lib/store";
import { RELATIONSHIP_LIST } from "@/lib/relationships";
import type { RelationshipKind } from "@/lib/types";

export function EdgeEditor({
  boardId,
  edgeId,
  onClose,
}: {
  boardId: string;
  edgeId: string;
  onClose: () => void;
}) {
  const edge = useBoardStore((s) => s.boards[boardId]?.edges.find((e) => e.id === edgeId));
  const updateEdge = useBoardStore((s) => s.updateEdge);
  const applyEdgeChanges = useBoardStore((s) => s.applyEdgeChanges);
  const externalLabel = edge?.data?.label ?? "";

  // Reset the local draft when the persisted label changes externally.
  // Adjusting during render instead of in an effect avoids the
  // cascading-render pattern (react-hooks/set-state-in-effect).
  const [label, setLabel] = useState(externalLabel);
  const [prevExternalLabel, setPrevExternalLabel] = useState(externalLabel);
  if (prevExternalLabel !== externalLabel) {
    setPrevExternalLabel(externalLabel);
    setLabel(externalLabel);
  }

  if (!edge) return null;

  const kind = edge.data?.kind ?? "other";

  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed !== (edge.data?.label ?? "")) {
      updateEdge(boardId, edgeId, { label: trimmed || undefined });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-80 rounded-xl bg-white p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-sm font-semibold text-zinc-900">Edit relationship</div>
        <div className="mb-3 text-xs text-zinc-500">
          Click a type, add an optional label, then press Done.
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {RELATIONSHIP_LIST.map((r) => (
            <button
              key={r.kind}
              type="button"
              onClick={() => updateEdge(boardId, edgeId, { kind: r.kind as RelationshipKind })}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                kind === r.kind
                  ? "text-white"
                  : "bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
              style={{
                borderColor: r.color,
                backgroundColor: kind === r.kind ? r.color : undefined,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitLabel()}
          onBlur={commitLabel}
          placeholder="Custom label (e.g. 'older brother')"
          maxLength={40}
          className="mb-3 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
        />

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              applyEdgeChanges(boardId, [{ id: edgeId, type: "remove" }]);
              onClose();
            }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete connection
          </button>
          <button
            type="button"
            onClick={() => {
              commitLabel();
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
