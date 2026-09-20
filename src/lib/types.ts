import type { Edge, Node } from "@xyflow/react";

export type CharacterSource = "jikan" | "tvmaze";

/** Normalized character shape returned by the API routes. */
export type ApiCharacter = {
  source: CharacterSource;
  externalId: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
  about?: string;
};

/** TVmaze show result (before expanding to cast). */
export type ApiShow = {
  source: "tvmaze";
  externalId: string;
  name: string;
  imageUrl?: string;
  premiered?: string;
};

export type CharacterNodeData = {
  source: CharacterSource;
  externalId: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
};

export type RelationshipKind =
  | "family"
  | "ally"
  | "rival"
  | "romantic"
  | "mentor"
  | "other";

export type RelationshipEdgeData = {
  kind: RelationshipKind;
  label?: string;
};

export type CharacterNode = Node<CharacterNodeData, "character">;
export type RelationshipEdge = Edge<RelationshipEdgeData, "relationship">;

export type Board = {
  id: string;
  name: string;
  nodes: CharacterNode[];
  edges: RelationshipEdge[];
  createdAt: number;
  updatedAt: number;
};

export type { Edge, Node };
