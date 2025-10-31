import type { SceneDraft, ID } from '@/types/scene';

export type SnapGuide = { kind: 'v'; x: number } | { kind: 'h'; y: number };

export type RectMM = { x: number; y: number; w: number; h: number };

export function rectEdges(r: RectMM) {
  const left = r.x;
  const right = r.x + r.w;
  const top = r.y;
  const bottom = r.y + r.h;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  return { left, right, top, bottom, cx, cy };
}

/**
 * Compute snap-to-other-pieces for a candidate rect.
 * - thresholdMm: snap radius (e.g. 5)
 * - excludeId: piece being dragged
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

  // Explore all other pieces
  for (const p of Object.values(scene.pieces)) {
    if (p.id === excludeId) continue;
    const r = { x: p.position.x, y: p.position.y, w: p.size.w, h: p.size.h };
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

  // Explore all other pieces
  for (const p of Object.values(scene.pieces)) {
    if (excludeIds.includes(p.id)) continue;
    const r = { x: p.position.x, y: p.position.y, w: p.size.w, h: p.size.h };
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
