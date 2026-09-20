"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useBoardStore } from "@/lib/store";
import type {
  CharacterNode,
  CharacterNodeData,
  RelationshipEdge,
} from "@/lib/types";
import { CharacterNode as CharacterNodeComponent } from "./CharacterNode";
import { RelationshipEdge as RelationshipEdgeComponent } from "./RelationshipEdge";
import { useEditorActions } from "./EditorContext";

const nodeTypes: NodeTypes = { character: CharacterNodeComponent };
const edgeTypes: EdgeTypes = { relationship: RelationshipEdgeComponent };

const EMPTY_NODES: CharacterNode[] = [];
const EMPTY_EDGES: RelationshipEdge[] = [];

export function Canvas({
  boardId,
  onSelectionChange,
}: {
  boardId: string;
  onSelectionChange?: (params: OnSelectionChangeParams) => void;
}) {
  const nodes = useBoardStore((s) => s.boards[boardId]?.nodes ?? EMPTY_NODES);
  const edges = useBoardStore((s) => s.boards[boardId]?.edges ?? EMPTY_EDGES);
  const applyNodeChanges = useBoardStore((s) => s.applyNodeChanges);
  const applyEdgeChanges = useBoardStore((s) => s.applyEdgeChanges);
  const connectNodes = useBoardStore((s) => s.connectNodes);
  const { openEdgeEditor, addCharacter } = useEditorActions();
  const { screenToFlowPosition } = useReactFlow();

  const handleNodesChange = (changes: NodeChange<CharacterNode>[]) =>
    applyNodeChanges(boardId, changes);
  const handleEdgesChange = (changes: EdgeChange<RelationshipEdge>[]) =>
    applyEdgeChanges(boardId, changes);

  const handleConnect = (connection: Connection) => {
    const edge = connectNodes(boardId, connection);
    if (edge) openEdgeEditor(edge.id);
  };

  return (
    <div
      className="h-full w-full"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-character")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData("application/x-character");
        if (!raw) return;
        e.preventDefault();
        try {
          const data = JSON.parse(raw) as CharacterNodeData;
          addCharacter(data, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        } catch {
          // ignore malformed payloads
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={(_, edge) => openEdgeEditor(edge.id)}
        onSelectionChange={onSelectionChange}
        defaultEdgeOptions={{ type: "relationship" }}
        connectionLineType={ConnectionLineType.Bezier}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.2}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#d4d4d8" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => "#a5b4fc"}
          className="!bg-white"
        />
      </ReactFlow>
    </div>
  );
}
