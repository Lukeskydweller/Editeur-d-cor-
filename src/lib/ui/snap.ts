import type { SceneDraft, ID } from '@/types/scene';
import { pieceAABB, edgesOfRect } from '@/lib/geom/aabb';
import { getSnapNeighbors } from '@/core/snap/candidates';
import { queryNeighbors } from '@/lib/spatial/globalIndex';
import { metrics } from '@/lib/metrics';

export type SnapGuide = { kind: 'v'; x: number } | { kind: 'h'; y: number };

export type RectMM = { x: number; y: number; w: number; h: number };

export function rectEdges(r: RectMM) {
  return edgesOfRect(r);
}

/**
 * Compute snap-to-other-pieces for a candidate rect.
 * - thresholdMm: snap radius (e.g. 5)
 * - excludeId: piece being dragged
 *
 * OPTIMIZATION: Uses RBush spatial index to only check nearby pieces (margin=12mm, limit=16)
 * instead of iterating through all pieces. Falls back to full iteration if index unavailable.
 */
export function snapToPieces(
  scene: SceneDraft,
  candidate: RectMM,
  thresholdMm = 5,
  excludeId?: ID
): { x: number; y: number; guides: SnapGuide[] } {
  const c = rectEdges(candidate);
  let bestDx = 0;
  let bestDy = 0;
  const guides: SnapGuide[] = [];

  // OPTIMIZATION: Use spatial index to get nearby pieces only
  let piecesToCheck: Array<typeof scene.pieces[string]>;

  if (window.__flags?.USE_GLOBAL_SPATIAL) {
    // NEW PATH: Use global spatial index with margin
    try {
      const margin = 12; // mm
      const neighborIds = queryNeighbors(
        { x: candidate.x - margin, y: candidate.y - margin, w: candidate.w + 2 * margin, h: candidate.h + 2 * margin },
        { excludeId }
      );
      piecesToCheck = neighborIds
        .map(id => scene.pieces[id])
        .filter(p => p !== undefined);
      metrics.rbush_candidates_snap_total += piecesToCheck.length;
    } catch {
      // Fallback: index not ready, use all pieces
      piecesToCheck = Object.values(scene.pieces);
    }
  } else {
    // OLD PATH: Use existing RBush via getSnapNeighbors
    try {
      if (excludeId) {
        const neighborIds = getSnapNeighbors(excludeId, 12, 16);
        piecesToCheck = neighborIds
          .map(id => scene.pieces[id])
          .filter(p => p !== undefined);

        // If index returned no neighbors or piece not in scene, fallback to all pieces
        // This handles cases where scene is out of sync with spatial index (e.g. tests)
        if (piecesToCheck.length === 0 || !scene.pieces[excludeId]) {
          piecesToCheck = Object.values(scene.pieces);
        }
      } else {
        piecesToCheck = Object.values(scene.pieces);
      }
    } catch {
      // Fallback: index not ready, use all pieces
      piecesToCheck = Object.values(scene.pieces);
    }
  }

  // Explore nearby pieces (using rotation-aware AABB)
  for (const p of piecesToCheck) {
    if (p.id === excludeId) continue;
    const r = pieceAABB(p); // Use rotated AABB instead of raw position/size
    const e = rectEdges(r);

    // vertical alignments (x axis): left, centerX, right (+ cross-alignments)
    const candidatesV: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.left, current: c.left, guide: { kind: 'v', x: e.left } },
      { target: e.cx, current: c.cx, guide: { kind: 'v', x: e.cx } },
      { target: e.right, current: c.right, guide: { kind: 'v', x: e.right } },
      // Cross-alignments: snap current.left to target.right, current.right to target.left
      { target: e.right, current: c.left, guide: { kind: 'v', x: e.right } },
      { target: e.left, current: c.right, guide: { kind: 'v', x: e.left } },
    ];

    for (const v of candidatesV) {
      const dx = v.target - v.current;
      if (Math.abs(dx) <= thresholdMm && Math.abs(dx) >= Math.abs(bestDx)) {
        if (Math.abs(dx) > Math.abs(bestDx)) {
          bestDx = dx;
          // Remplacer les guides verticaux existants
          guides.splice(
            0,
            guides.length,
            ...guides.filter((g) => g.kind === 'h'),
            v.guide
          );
        }
      }
    }

    // horizontal alignments (y axis): top, centerY, bottom (+ cross-alignments)
    const candidatesH: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.top, current: c.top, guide: { kind: 'h', y: e.top } },
      { target: e.cy, current: c.cy, guide: { kind: 'h', y: e.cy } },
      { target: e.bottom, current: c.bottom, guide: { kind: 'h', y: e.bottom } },
      // Cross-alignments: snap current.top to target.bottom, current.bottom to target.top
      { target: e.bottom, current: c.top, guide: { kind: 'h', y: e.bottom } },
      { target: e.top, current: c.bottom, guide: { kind: 'h', y: e.top } },
    ];

    for (const h of candidatesH) {
      const dy = h.target - h.current;
      if (Math.abs(dy) <= thresholdMm && Math.abs(dy) >= Math.abs(bestDy)) {
        if (Math.abs(dy) > Math.abs(bestDy)) {
          bestDy = dy;
          // Remplacer les guides horizontaux existants
          guides.splice(
            0,
            guides.length,
            ...guides.filter((g) => g.kind === 'v'),
            h.guide
          );
        }
      }
    }
  }

  return { x: candidate.x + bestDx, y: candidate.y + bestDy, guides };
}

/**
 * Compute snap-to-other-pieces for a group bounding box.
 * - thresholdMm: snap radius (e.g. 5)
 * - excludeIds: pieces being dragged
 *
 * OPTIMIZATION: Uses RBush spatial index to only check nearby pieces (margin=12mm, limit=16)
 * by querying neighbors of each piece in the group. Falls back to full iteration if index unavailable.
 */
export function snapGroupToPieces(
  scene: SceneDraft,
  groupRect: RectMM,
  thresholdMm = 5,
  excludeIds: ID[] = []
): { x: number; y: number; guides: SnapGuide[] } {
  const c = rectEdges(groupRect);
  let bestDx = 0;
  let bestDy = 0;
  const guides: SnapGuide[] = [];

  // OPTIMIZATION: Use spatial index to get nearby pieces only
  let piecesToCheck: Array<typeof scene.pieces[string]>;

  if (window.__flags?.USE_GLOBAL_SPATIAL) {
    // NEW PATH: Use global spatial index with margin
    try {
      const margin = 12; // mm
      const neighborIds = queryNeighbors(
        { x: groupRect.x - margin, y: groupRect.y - margin, w: groupRect.w + 2 * margin, h: groupRect.h + 2 * margin },
        { excludeIdSet: new Set(excludeIds) }
      );
      piecesToCheck = neighborIds
        .map(id => scene.pieces[id])
        .filter(p => p !== undefined);
      metrics.rbush_candidates_snap_total += piecesToCheck.length;
    } catch {
      // Fallback: index not ready, use all pieces
      piecesToCheck = Object.values(scene.pieces).filter(p => !excludeIds.includes(p.id));
    }
  } else {
    // OLD PATH: Use existing RBush via getSnapNeighbors
    try {
      if (excludeIds.length > 0) {
        // Collect neighbors of all pieces in the group
        const neighborSet = new Set<string>();
        for (const id of excludeIds) {
          const neighbors = getSnapNeighbors(id, 12, 16);
          neighbors.forEach(nid => neighborSet.add(nid));
        }
        piecesToCheck = Array.from(neighborSet)
          .map(id => scene.pieces[id])
          .filter(p => p !== undefined && !excludeIds.includes(p.id));

        // If index returned no neighbors or pieces not in scene, fallback to all pieces
        // This handles cases where scene is out of sync with spatial index (e.g. tests)
        const allExcludedInScene = excludeIds.every(id => scene.pieces[id]);
        if (piecesToCheck.length === 0 || !allExcludedInScene) {
          piecesToCheck = Object.values(scene.pieces).filter(p => !excludeIds.includes(p.id));
        }
      } else {
        piecesToCheck = Object.values(scene.pieces);
      }
    } catch {
      // Fallback: index not ready, use all pieces
      piecesToCheck = Object.values(scene.pieces).filter(p => !excludeIds.includes(p.id));
    }
  }

  // Explore nearby pieces (using rotation-aware AABB)
  for (const p of piecesToCheck) {
    if (excludeIds.includes(p.id)) continue;
    const r = pieceAABB(p); // Use rotated AABB instead of raw position/size
    const e = rectEdges(r);

    // vertical alignments (x axis): left, centerX, right (+ cross-alignments)
    const candidatesV: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.left, current: c.left, guide: { kind: 'v', x: e.left } },
      { target: e.cx, current: c.cx, guide: { kind: 'v', x: e.cx } },
      { target: e.right, current: c.right, guide: { kind: 'v', x: e.right } },
      // Cross-alignments: snap current.left to target.right, current.right to target.left
      { target: e.right, current: c.left, guide: { kind: 'v', x: e.right } },
      { target: e.left, current: c.right, guide: { kind: 'v', x: e.left } },
    ];

    for (const v of candidatesV) {
      const dx = v.target - v.current;
      if (Math.abs(dx) <= thresholdMm && Math.abs(dx) >= Math.abs(bestDx)) {
        if (Math.abs(dx) > Math.abs(bestDx)) {
          bestDx = dx;
          // Remplacer les guides verticaux existants
          guides.splice(
            0,
            guides.length,
            ...guides.filter((g) => g.kind === 'h'),
            v.guide
          );
        }
      }
    }

    // horizontal alignments (y axis): top, centerY, bottom (+ cross-alignments)
    const candidatesH: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.top, current: c.top, guide: { kind: 'h', y: e.top } },
      { target: e.cy, current: c.cy, guide: { kind: 'h', y: e.cy } },
      { target: e.bottom, current: c.bottom, guide: { kind: 'h', y: e.bottom } },
      // Cross-alignments: snap current.top to target.bottom, current.bottom to target.top
      { target: e.bottom, current: c.top, guide: { kind: 'h', y: e.bottom } },
      { target: e.top, current: c.bottom, guide: { kind: 'h', y: e.top } },
    ];

    for (const h of candidatesH) {
      const dy = h.target - h.current;
      if (Math.abs(dy) <= thresholdMm && Math.abs(dy) >= Math.abs(bestDy)) {
        if (Math.abs(dy) > Math.abs(bestDy)) {
          bestDy = dy;
          // Remplacer les guides horizontaux existants
          guides.splice(
            0,
            guides.length,
            ...guides.filter((g) => g.kind === 'v'),
            h.guide
          );
        }
      }
    }
  }

  return { x: groupRect.x + bestDx, y: groupRect.y + bestDy, guides };
}
