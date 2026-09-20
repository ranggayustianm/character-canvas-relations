"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CharacterNode as CharacterNodeType } from "@/lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const SOURCE_STYLES = {
  jikan: { label: "Anime/Manga", className: "bg-indigo-100 text-indigo-700" },
  tvmaze: { label: "TV", className: "bg-amber-100 text-amber-700" },
} as const;

export function CharacterNode({ data, selected }: NodeProps<CharacterNodeType>) {
  const source = SOURCE_STYLES[data.source];
  return (
    <div
      className={`w-44 rounded-xl bg-white shadow-md border-2 transition-colors ${
        selected ? "border-blue-500" : "border-zinc-200"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-zinc-400" />
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />

      <div className="relative h-28 w-full overflow-hidden rounded-t-[10px] bg-gradient-to-br from-zinc-100 to-zinc-200">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote CDN images outside next/image config
          <img
            src={data.imageUrl}
            alt={data.name}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-zinc-400">
            {initials(data.name)}
          </div>
        )}
        <span
          className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${source.className}`}
        >
          {source.label}
        </span>
      </div>

      <div className="px-2 py-1.5 text-center">
        <div className="truncate text-sm font-medium text-zinc-900" title={data.name}>
          {data.name}
        </div>
        {data.subtitle && (
          <div className="truncate text-[11px] text-zinc-500" title={data.subtitle}>
            {data.subtitle}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
}
