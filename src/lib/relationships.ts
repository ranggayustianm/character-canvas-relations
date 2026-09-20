import type { RelationshipKind } from "./types";

export type RelationshipStyle = {
  kind: RelationshipKind;
  label: string;
  color: string;
  dashed: boolean;
};

export const RELATIONSHIPS: Record<RelationshipKind, RelationshipStyle> = {
  family: { kind: "family", label: "Family", color: "#16a34a", dashed: false },
  ally: { kind: "ally", label: "Ally", color: "#2563eb", dashed: false },
  rival: { kind: "rival", label: "Rival", color: "#dc2626", dashed: true },
  romantic: { kind: "romantic", label: "Romantic", color: "#db2777", dashed: false },
  mentor: { kind: "mentor", label: "Mentor", color: "#9333ea", dashed: true },
  other: { kind: "other", label: "Other", color: "#6b7280", dashed: false },
};

export const RELATIONSHIP_LIST = Object.values(RELATIONSHIPS);
