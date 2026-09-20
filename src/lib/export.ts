"use client";

import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toPng } from "html-to-image";
import type { CharacterNode } from "./types";

const PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="176" height="112"><rect width="100%" height="100%" fill="#e4e4e7"/></svg>'
)}`;

export async function exportBoardToPng(
  nodes: CharacterNode[],
  boardName: string
): Promise<void> {
  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl || nodes.length === 0) return;

  const bounds = getNodesBounds(nodes);
  const width = 1600;
  const height = Math.max(400, Math.round((width * bounds.height) / bounds.width));
  const viewport = getViewportForBounds(bounds, width, height, 0.2, 2, 32);

  const options: Parameters<typeof toPng>[1] = {
    backgroundColor: "#fafafa",
    width,
    height,
    imagePlaceholder: PLACEHOLDER,
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-export")),
    style: {
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };

  // First call warms up image/font embedding; the second produces the real render.
  await toPng(viewportEl, options);
  const dataUrl = await toPng(viewportEl, options);

  const link = document.createElement("a");
  link.download = `${boardName.replace(/[^\w-]+/g, "_") || "board"}.png`;
  link.href = dataUrl;
  link.click();
}
