"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useBoardStore } from "@/lib/store";
import { exportBoardToPng } from "@/lib/export";
import type { CharacterNodeData } from "@/lib/types";
import { Canvas } from "./Canvas";
import { EdgeEditor } from "./EdgeEditor";
import { EditorProvider } from "./EditorContext";
import { SearchPanel } from "./SearchPanel";
import { Toolbar } from "./Toolbar";

export function BoardEditor({ boardId }: { boardId: string }) {
  // Boards load from localStorage, so render on the client only to avoid
  // hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-dvh w-full animate-pulse bg-zinc-100" aria-label="Loading board" />;
  }

  return (
    <ReactFlowProvider>
      <EditorInner boardId={boardId} />
    </ReactFlowProvider>
  );
}

function EditorInner({ boardId }: { boardId: string }) {
  const board = useBoardStore((s) => s.boards[boardId]);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const addCharacterNode = useBoardStore((s) => s.addCharacter);
  const applyNodeChanges = useBoardStore((s) => s.applyNodeChanges);
  const { screenToFlowPosition, setCenter } = useReactFlow();

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const addCharacter = useCallback(
    (data: CharacterNodeData, position?: { x: number; y: number }) => {
      const existing = board?.nodes.find(
        (n) => n.data.source === data.source && n.data.externalId === data.externalId
      );
      if (existing) {
        setCenter(existing.position.x + 88, existing.position.y + 70, {
          zoom: 1.1,
          duration: 500,
        });
        applyNodeChanges(boardId, [{ id: existing.id, type: "select", selected: true }]);
        notify(`${data.name} is already on this board`);
        return;
      }

      let pos = position;
      if (!pos) {
        const rect = canvasAreaRef.current?.getBoundingClientRect();
        const center = rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const flow = screenToFlowPosition(center);
        // small jitter so repeated adds don't stack perfectly
        pos = {
          x: flow.x - 88 + (Math.random() - 0.5) * 60,
          y: flow.y - 70 + (Math.random() - 0.5) * 60,
        };
      }
      addCharacterNode(boardId, data, pos);
    },
    [board, boardId, applyNodeChanges, addCharacterNode, notify, screenToFlowPosition, setCenter]
  );

  if (!board) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-zinc-50 text-center">
        <p className="text-lg font-semibold text-zinc-900">Board not found</p>
        <p className="text-sm text-zinc-500">
          It may have been deleted, or the link is stale.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to boards
        </Link>
      </div>
    );
  }

  return (
    <EditorProvider value={{ openEdgeEditor: setEditingEdgeId, addCharacter, notify }}>
      <div className="flex h-dvh flex-col bg-zinc-50">
        <Toolbar
          boardName={board.name}
          onRename={(name) => renameBoard(boardId, name)}
          exportDisabled={board.nodes.length === 0}
          onExport={async () => {
            try {
              await exportBoardToPng(board.nodes, board.name);
            } catch {
              notify("Export failed — try again");
            }
          }}
        />
        <div className="flex min-h-0 flex-1">
          <SearchPanel />
          <div ref={canvasAreaRef} className="relative min-w-0 flex-1">
            <Canvas boardId={boardId} />
            {toast && (
              <div className="no-export pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-zinc-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg">
                {toast}
              </div>
            )}
          </div>
        </div>
        {editingEdgeId && (
          <EdgeEditor
            boardId={boardId}
            edgeId={editingEdgeId}
            onClose={() => setEditingEdgeId(null)}
          />
        )}
      </div>
    </EditorProvider>
  );
}
