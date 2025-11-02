export type Units = "mm";

export interface Layer {
  id: string;
  name: string;
  index: number;
}

export interface MaterialRef {
  id: string;
  name: string;
  directional: boolean;
}

export type Rot = 0|90|180|270;

export interface PieceConstraints {
  lockEdge?: boolean;
}

export interface Piece {
  id: string;
  kind: "rect"; // extensible
  x: number; y: number; w: number; h: number; rot: Rot;
  layerId: string;
  materialId: string;
  constraints?: PieceConstraints;
  meta?: Record<string, unknown>;
}

export type ProblemSeverity = "BLOCK" | "WARN";

export enum ProblemCode {
  overlap_same_layer = "overlap_same_layer",
  out_of_panel_bounds = "out_of_panel_bounds",
  no_support_below = "no_support_below",
  max_layers_exceeded = "max_layers_exceeded",
  project_limits_exceeded = "project_limits_exceeded",
  material_orientation_mismatch = "material_orientation_mismatch",
  material_inconsistent_orientations = "material_inconsistent_orientations",
  piece_will_be_split = "piece_will_be_split"
}

export interface Problem {
  code: ProblemCode;
  severity: ProblemSeverity;
  pieceId?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface SceneV1 {
  v: 1;
  units: Units;
  width: number;
  height: number;
  layers: Layer[];
  materials: MaterialRef[];
  pieces: Piece[];
  problems?: Problem[];
}
