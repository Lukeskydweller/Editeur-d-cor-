import * as SAT from "sat";
import { SceneV1 } from "../contracts/scene";
import { neighborsForPiece } from "../spatial/rbushIndex";
import { queryNeighbors } from "../../lib/spatial/globalIndex";
import { metrics } from "../../lib/metrics";

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

  let neighbors: string[];
  if (window.__flags?.USE_GLOBAL_SPATIAL) {
    // NEW PATH: Use global spatial index
    try {
      neighbors = queryNeighbors(
        { x: aabb.x - margin, y: aabb.y - margin, w: aabb.w + 2 * margin, h: aabb.h + 2 * margin },
        { excludeId: id }
      );
      metrics.rbush_candidates_collision_total += neighbors.length;
    } catch {
      // Fallback: use old RBush
      neighbors = neighborsForPiece(id, Math.max(0, margin), 64);
    }
  } else {
    // OLD PATH: Use existing RBush
    neighbors = neighborsForPiece(id, Math.max(0, margin), 64);
  }

  const hits: string[] = [];
  for (const otherId of neighbors) {
    const b = aabbOfPiece(scene, otherId);
    if (!b) continue;
    if (collideRectRect(aabb, b)) hits.push(otherId);
  }
  return hits;
}

/** Retourne toutes les paires en collision au sein d'une même couche. */
export function collisionsSameLayer(scene: SceneV1): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();

  // Group pieces by layer
  const piecesByLayer = new Map<string, string[]>();
  for (const piece of scene.pieces) {
    if (!piecesByLayer.has(piece.layerId)) {
      piecesByLayer.set(piece.layerId, []);
    }
    piecesByLayer.get(piece.layerId)!.push(piece.id);
  }

  // Check collisions within each layer
  for (const [, pieceIds] of piecesByLayer) {
    for (let i = 0; i < pieceIds.length; i++) {
      const id1 = pieceIds[i];
      const aabb1 = aabbOfPiece(scene, id1);
      if (!aabb1) continue;

      // Use spatial index to get neighbors
      let neighbors: string[];
      if (window.__flags?.USE_GLOBAL_SPATIAL) {
        try {
          neighbors = queryNeighbors(aabb1, { excludeId: id1 });
          metrics.rbush_candidates_collision_total += neighbors.length;
        } catch {
          neighbors = neighborsForPiece(id1, 0, 64);
        }
      } else {
        neighbors = neighborsForPiece(id1, 0, 64);
      }

      for (const id2 of neighbors) {
        // Skip if not in same layer
        const piece1 = scene.pieces.find(p => p.id === id1);
        const piece2 = scene.pieces.find(p => p.id === id2);
        if (!piece1 || !piece2 || piece1.layerId !== piece2.layerId) continue;

        // Avoid duplicates: ensure id1 < id2
        const pairKey = id1 < id2 ? `${id1},${id2}` : `${id2},${id1}`;
        if (seen.has(pairKey)) continue;

        const aabb2 = aabbOfPiece(scene, id2);
        if (!aabb2) continue;

        if (collideRectRect(aabb1, aabb2)) {
          seen.add(pairKey);
          pairs.push(id1 < id2 ? [id1, id2] : [id2, id1]);
        }
      }
    }
  }

  return pairs;
}
