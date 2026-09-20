"use client";

import {
  addEdge as rfAddEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Board,
  CharacterNode,
  CharacterNodeData,
  RelationshipEdge,
  RelationshipEdgeData,
} from "./types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function newBoard(name: string): Board {
  const now = Date.now();
  return { id: uid(), name, nodes: [], edges: [], createdAt: now, updatedAt: now };
}

type BoardStore = {
  boards: Record<string, Board>;
  createBoard: (name?: string) => string;
  deleteBoard: (boardId: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  duplicateBoard: (boardId: string) => string | null;
  applyNodeChanges: (boardId: string, changes: NodeChange<CharacterNode>[]) => void;
  applyEdgeChanges: (boardId: string, changes: EdgeChange<RelationshipEdge>[]) => void;
  addCharacter: (boardId: string, data: CharacterNodeData, position: { x: number; y: number }) => CharacterNode;
  connectNodes: (boardId: string, connection: Connection) => RelationshipEdge | null;
  updateEdge: (boardId: string, edgeId: string, patch: Partial<RelationshipEdgeData>) => void;
  touch: (boardId: string) => void;
};

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      boards: {},

      createBoard: (name) => {
        const board = newBoard(name?.trim() || "Untitled board");
        set((s) => ({ boards: { ...s.boards, [board.id]: board } }));
        return board.id;
      },

      deleteBoard: (boardId) =>
        set((s) => {
          const boards = { ...s.boards };
          delete boards[boardId];
          return { boards };
        }),

      renameBoard: (boardId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: { ...board, name: trimmed, updatedAt: Date.now() },
            },
          };
        });
      },

      duplicateBoard: (boardId) => {
        const board = get().boards[boardId];
        if (!board) return null;
        const copy: Board = {
          ...structuredClone(board),
          id: uid(),
          name: `${board.name} (copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ boards: { ...s.boards, [copy.id]: copy } }));
        return copy.id;
      },

      applyNodeChanges: (boardId, changes) =>
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: {
                ...board,
                nodes: applyNodeChanges(changes, board.nodes),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      applyEdgeChanges: (boardId, changes) =>
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: {
                ...board,
                edges: applyEdgeChanges(changes, board.edges),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      addCharacter: (boardId, data, position) => {
        const node: CharacterNode = {
          id: uid(),
          type: "character",
          position,
          data,
        };
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: {
                ...board,
                nodes: [...board.nodes, node],
                updatedAt: Date.now(),
              },
            },
          };
        });
        return node;
      },

      connectNodes: (boardId, connection) => {
        if (!connection.source || !connection.target) return null;
        if (connection.source === connection.target) return null;
        const edge: RelationshipEdge = {
          id: uid(),
          type: "relationship",
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          data: { kind: "other" },
        };
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: {
                ...board,
                edges: rfAddEdge(edge, board.edges),
                updatedAt: Date.now(),
              },
            },
          };
        });
        return edge;
      },

      updateEdge: (boardId, edgeId, patch) =>
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: {
              ...s.boards,
              [boardId]: {
                ...board,
                edges: board.edges.map((e) => {
                  if (e.id !== edgeId) return e;
                  const next: RelationshipEdgeData = {
                    kind: patch.kind ?? e.data?.kind ?? "other",
                    // "label" present-but-undefined clears the custom label
                    label: "label" in patch ? patch.label : e.data?.label,
                  };
                  return { ...e, data: next };
                }),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      touch: (boardId) =>
        set((s) => {
          const board = s.boards[boardId];
          if (!board) return s;
          return {
            boards: { ...s.boards, [boardId]: { ...board, updatedAt: Date.now() } },
          };
        }),
    }),
    { name: "character-relations-boards" }
  )
);
