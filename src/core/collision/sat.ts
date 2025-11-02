import * as SAT from "sat";
import { SceneV1 } from "../contracts/scene";
import { neighborsForPiece } from "../spatial/rbushIndex";

export type AABB = { x:number; y:number; w:number; h:number };

export function collideRectRect(a: AABB, b: AABB): boolean {
  const pa = new SAT.Box(new SAT.Vector(a.x, a.y), a.w, a.h).toPolygon();
  const pb = new SAT.Box(new SAT.Vector(b.x, b.y), b.w, b.h).toPolygon();
  return SAT.testPolygonPolygon(pa, pb);
}

function aabbOfPiece(scene: SceneV1, id: string): AABB | null {
  const p = scene.pieces.find(pp => pp.id === id);
  if (!p) return null;
  return { x: p.x, y: p.y, w: p.w, h: p.h };
}

export function collisionsForPiece(scene: SceneV1, id: string, margin = 0): string[] {
  const aabb = aabbOfPiece(scene, id);
  if (!aabb) return [];
  const neighbors = neighborsForPiece(id, Math.max(0, margin), 64);
  const hits: string[] = [];
  for (const otherId of neighbors) {
    const b = aabbOfPiece(scene, otherId);
    if (!b) continue;
    if (collideRectRect(aabb, b)) hits.push(otherId);
  }
  return hits;
}
