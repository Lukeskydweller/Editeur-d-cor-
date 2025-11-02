// Projette SceneDraft (UI) → SceneV1 (contracts)
import type { SceneV1 } from "../core/contracts/scene";
import type { SceneDraft } from "../types/scene";

export function projectDraftToV1(draft: { scene: SceneDraft }): SceneV1 {
  const s = draft.scene;

  // Convert layers
  const layers = Object.values(s.layers).map(l => ({
    id: l.id,
    name: l.name,
    index: l.z
  }));

  // Convert materials
  const materials = Object.values(s.materials).map(m => ({
    id: m.id,
    name: m.name,
    directional: !!m.oriented,
    orientationDeg: m.orientationDeg as 0 | 90 | undefined
  }));

  // Convert pieces
  const pieces = Object.values(s.pieces).map(p => ({
    id: p.id,
    kind: p.kind as "rect",
    x: p.position.x,
    y: p.position.y,
    w: p.size.w,
    h: p.size.h,
    rot: normalizeRot(p.rotationDeg),
    layerId: p.layerId,
    materialId: p.materialId,
    joined: p.joined, // Pass through joined flag for spacing validation
    constraints: {}
  }));

  return {
    v: 1,
    units: "mm",
    width: s.size.w,
    height: s.size.h,
    layers,
    materials,
    pieces,
    problems: [] // computed by validation
  };
}

function normalizeRot(r: number): 0 | 90 | 180 | 270 {
  const v = ((r % 360) + 360) % 360;
  if (v === 90) return 90;
  if (v === 180) return 180;
  if (v === 270) return 270;
  return 0;
}
