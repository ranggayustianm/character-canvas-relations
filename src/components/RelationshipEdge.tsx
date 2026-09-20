"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { RELATIONSHIPS } from "@/lib/relationships";
import type { RelationshipEdge as RelationshipEdgeType } from "@/lib/types";
import { useEditorActions } from "./EditorContext";

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationshipEdgeType>) {
  const { openEdgeEditor } = useEditorActions();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const style = RELATIONSHIPS[data?.kind ?? "other"];
  const labelText = data?.label?.trim() || style.label;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: style.color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: style.dashed ? "6 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openEdgeEditor(id);
          }}
          className={`nodrag nopan absolute cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-opacity ${
            selected ? "opacity-100" : "opacity-90 hover:opacity-100"
          }`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            color: style.color,
            borderColor: style.color,
            backgroundColor: "white",
          }}
        >
          {labelText}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
