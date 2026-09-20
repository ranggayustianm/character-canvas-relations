"use client";

import { createContext, useContext } from "react";
import type { CharacterNodeData } from "@/lib/types";

export type EditorActions = {
  openEdgeEditor: (edgeId: string) => void;
  addCharacter: (data: CharacterNodeData, position?: { x: number; y: number }) => void;
  notify: (message: string) => void;
};

const EditorContext = createContext<EditorActions | null>(null);

export function EditorProvider({
  value,
  children,
}: {
  value: EditorActions;
  children: React.ReactNode;
}) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditorActions(): EditorActions {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorActions must be used within EditorProvider");
  return ctx;
}
