import type { ID, Piece } from '../types/scene';
import type { SceneStoreState } from './useSceneStore';
import { pieceBBox } from '../lib/geom';
import type { BBox } from '../types/scene';

export type SupportMode = 'fast' | 'exact';

/**
 * Get the layer ID directly below the given layer.
 * C3 → C2, C2 → C1, C1 → undefined
 */
export function getBelowLayerId(s: SceneStoreState, layerId: ID | undefined): ID | undefined {
  const f = s.scene.fixedLayerIds;
  if (!f || !layerId) return undefined;
  if (layerId === f.C3) return f.C2;
  if (layerId === f.C2) return f.C1;
  return undefined; // C1 has no layer below
}

/**
 * Check if PathOps/WASM is ready for exact geometric operations.
 * Returns true if PathOps can be used (browser with WASM loaded).
 */
function isExactReady(_s: SceneStoreState): boolean {
  // For now, exact mode requires PathOps WASM to be loaded
  // This can be enhanced with a runtime flag when WASM is initialized
  return typeof window !== 'undefined' && typeof (window as any).PathKitInit !== 'undefined';
}

/**
 * Test if AABB `a` is fully contained within AABB `b`.
 * Uses small epsilon tolerance for floating point comparisons.
 */
function aabbContainedIn(a: BBox, b: BBox): boolean {
  const EPS = 0.1; // mm tolerance
  return (
    a.x >= b.x - EPS &&
    a.y >= b.y - EPS &&
    a.x + a.w <= b.x + b.w + EPS &&
    a.y + a.h <= b.y + b.h + EPS
  );
}

/**
 * Compute the union AABB of multiple AABBs.
 * Returns the minimal enclosing axis-aligned bounding box.
 */
function aabbUnion(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;

  let minX = boxes[0].x;
  let minY = boxes[0].y;
  let maxX = boxes[0].x + boxes[0].w;
  let maxY = boxes[0].y + boxes[0].h;

  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i];
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Check if a piece is fully supported by the layer below.
 *
 * Support rules:
 * - C1: always supported (no layer below)
 * - C2: must be fully contained within union of C1 pieces
 * - C3: must be fully contained within union of C2 pieces
 *
 * @param s - Store state
 * @param pieceId - ID of piece to check
 * @param mode - 'fast' (AABB) or 'exact' (PathOps) - currently only 'fast' implemented
 * @returns true if piece is fully supported, false otherwise
 */
export function isPieceFullySupported(
  s: SceneStoreState,
  pieceId: ID,
  mode: SupportMode = 'fast',
): boolean {
  const p = s.scene.pieces[pieceId];
  if (!p) return false;

  const belowLayerId = getBelowLayerId(s, p.layerId);
  if (!belowLayerId) return true; // C1: always supported (no layer below)

  // Get all pieces from the layer below
  const belowPieces: Piece[] = (s.scene.layers[belowLayerId]?.pieces ?? [])
    .map((pid) => s.scene.pieces[pid])
    .filter(Boolean);

  if (belowPieces.length === 0) return false; // No support at all

  // FAST mode: AABB containment check
  if (mode === 'fast' || !isExactReady(s)) {
    const pieceAABB = pieceBBox(p);
    const belowAABBs = belowPieces.map((bp) => pieceBBox(bp));
    const unionAABB = aabbUnion(belowAABBs);

    if (!unionAABB) return false;

    return aabbContainedIn(pieceAABB, unionAABB);
  }

  // EXACT mode: PathOps containment (to be implemented in S22-4)
  // For now, fall back to AABB
  const pieceAABB = pieceBBox(p);
  const belowAABBs = belowPieces.map((bp) => pieceBBox(bp));
  const unionAABB = aabbUnion(belowAABBs);

  if (!unionAABB) return false;

  return aabbContainedIn(pieceAABB, unionAABB);
}
