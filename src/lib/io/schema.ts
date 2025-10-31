/**
 * Schema and validation for JSON scene file format v1
 */

export type SceneFileV1 = {
  version: 1;
  scene: {
    id: string;
    createdAt: string;
    size: { w: number; h: number };
    materials: Record<
      string,
      {
        id: string;
        name: string;
        oriented?: boolean;
        orientationDeg?: number;
      }
    >;
    layers: Record<
      string,
      {
        id: string;
        name: string;
        z: number;
        pieces: string[];
      }
    >;
    pieces: Record<
      string,
      {
        id: string;
        layerId: string;
        materialId: string;
        position: { x: number; y: number };
        rotationDeg: number;
        scale: { x: number; y: number };
        kind: 'rect';
        size: { w: number; h: number };
      }
    >;
    layerOrder: string[];
  };
  ui?: {
    snap10mm?: boolean;
    selectedIds?: string[];
    selectedId?: string;
    primaryId?: string;
  };
};

/**
 * Type guard: validate SceneFileV1 structure
 */
export function isSceneFileV1(x: unknown): x is SceneFileV1 {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;

  // Check version
  if (typeof obj.version !== 'number' || obj.version !== 1) return false;

  // Check scene exists
  if (!obj.scene || typeof obj.scene !== 'object') return false;
  const scene = obj.scene as Record<string, unknown>;

  // Check scene basic fields
  if (typeof scene.id !== 'string') return false;
  if (typeof scene.createdAt !== 'string') return false;

  // Check scene.size
  if (!scene.size || typeof scene.size !== 'object') return false;
  const size = scene.size as Record<string, unknown>;
  if (typeof size.w !== 'number' || typeof size.h !== 'number') return false;

  // Check scene.materials
  if (!scene.materials || typeof scene.materials !== 'object') return false;
  const materials = scene.materials as Record<string, unknown>;
  for (const [key, mat] of Object.entries(materials)) {
    if (!mat || typeof mat !== 'object') return false;
    const m = mat as Record<string, unknown>;
    if (typeof m.id !== 'string') return false;
    if (typeof m.name !== 'string') return false;
    if (m.oriented !== undefined && typeof m.oriented !== 'boolean') return false;
    if (m.orientationDeg !== undefined && typeof m.orientationDeg !== 'number') return false;
  }

  // Check scene.layers
  if (!scene.layers || typeof scene.layers !== 'object') return false;
  const layers = scene.layers as Record<string, unknown>;
  for (const [key, layer] of Object.entries(layers)) {
    if (!layer || typeof layer !== 'object') return false;
    const l = layer as Record<string, unknown>;
    if (typeof l.id !== 'string') return false;
    if (typeof l.name !== 'string') return false;
    if (typeof l.z !== 'number') return false;
    if (!Array.isArray(l.pieces)) return false;
    if (!l.pieces.every((p) => typeof p === 'string')) return false;
  }

  // Check scene.pieces
  if (!scene.pieces || typeof scene.pieces !== 'object') return false;
  const pieces = scene.pieces as Record<string, unknown>;
  for (const [key, piece] of Object.entries(pieces)) {
    if (!piece || typeof piece !== 'object') return false;
    const p = piece as Record<string, unknown>;
    if (typeof p.id !== 'string') return false;
    if (typeof p.layerId !== 'string') return false;
    if (typeof p.materialId !== 'string') return false;
    if (typeof p.kind !== 'string' || p.kind !== 'rect') return false;
    if (typeof p.rotationDeg !== 'number') return false;

    // Check position
    if (!p.position || typeof p.position !== 'object') return false;
    const pos = p.position as Record<string, unknown>;
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return false;

    // Check scale
    if (!p.scale || typeof p.scale !== 'object') return false;
    const scale = p.scale as Record<string, unknown>;
    if (typeof scale.x !== 'number' || typeof scale.y !== 'number') return false;

    // Check size
    if (!p.size || typeof p.size !== 'object') return false;
    const sz = p.size as Record<string, unknown>;
    if (typeof sz.w !== 'number' || typeof sz.h !== 'number') return false;

    // Validate references exist
    if (!layers[p.layerId]) return false;
    if (!materials[p.materialId]) return false;
  }

  // Check scene.layerOrder
  if (!Array.isArray(scene.layerOrder)) return false;
  if (!scene.layerOrder.every((id) => typeof id === 'string')) return false;
  // Validate all layerOrder IDs exist in layers
  for (const id of scene.layerOrder) {
    if (!layers[id]) return false;
  }

  // Check optional ui
  if (obj.ui !== undefined) {
    if (typeof obj.ui !== 'object') return false;
    const ui = obj.ui as Record<string, unknown>;
    if (ui.snap10mm !== undefined && typeof ui.snap10mm !== 'boolean') return false;
    if (ui.selectedId !== undefined && typeof ui.selectedId !== 'string') return false;
    if (ui.primaryId !== undefined && typeof ui.primaryId !== 'string') return false;
    if (ui.selectedIds !== undefined) {
      if (!Array.isArray(ui.selectedIds)) return false;
      if (!ui.selectedIds.every((id) => typeof id === 'string')) return false;
    }
  }

  return true;
}

/**
 * Normalize angles to {0, 90, 180, 270}
 */
function normalizeAngle(deg: number): number {
  // Round to nearest 90° and mod 360, handle negatives
  const rounded = Math.round(deg / 90) * 90;
  return ((rounded % 360) + 360) % 360;
}

/**
 * Normalize SceneFileV1 data:
 * - Clamp dimensions ≥ 0
 * - Normalize angles to {0, 90, 180, 270}
 * - Filter orphaned pieces (with invalid layerId/materialId)
 * - Filter layerOrder to only valid layer IDs
 */
export function normalizeSceneFileV1(f: SceneFileV1): SceneFileV1 {
  // Deep clone to avoid mutating input
  const normalized: SceneFileV1 = JSON.parse(JSON.stringify(f));

  // Normalize scene size
  normalized.scene.size.w = Math.max(0, normalized.scene.size.w);
  normalized.scene.size.h = Math.max(0, normalized.scene.size.h);

  // Normalize materials
  for (const mat of Object.values(normalized.scene.materials)) {
    if (mat.orientationDeg !== undefined) {
      mat.orientationDeg = normalizeAngle(mat.orientationDeg);
    }
  }

  // Normalize pieces and filter orphans
  const validPieces: typeof normalized.scene.pieces = {};
  for (const [id, piece] of Object.entries(normalized.scene.pieces)) {
    // Skip orphaned pieces
    if (!normalized.scene.layers[piece.layerId]) continue;
    if (!normalized.scene.materials[piece.materialId]) continue;

    // Normalize dimensions
    piece.size.w = Math.max(0, piece.size.w);
    piece.size.h = Math.max(0, piece.size.h);

    // Normalize rotation
    piece.rotationDeg = normalizeAngle(piece.rotationDeg);

    validPieces[id] = piece;
  }
  normalized.scene.pieces = validPieces;

  // Update layer piece references to remove orphans
  for (const layer of Object.values(normalized.scene.layers)) {
    layer.pieces = layer.pieces.filter((id) => validPieces[id]);
  }

  // Normalize layerOrder to only valid IDs
  normalized.scene.layerOrder = normalized.scene.layerOrder.filter(
    (id) => normalized.scene.layers[id]
  );

  return normalized;
}
