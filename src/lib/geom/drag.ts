/**
 * Pure drag calculation utilities for rotation-aware pieces
 * Ensures ghost position exactly matches commit position
 */

import type { SceneDraft, ID } from '@/types/scene';
import { pieceBBox } from '@/lib/geom';
import { snapToPieces, snapGroupToPieces, type SnapGuide } from '@/lib/ui/snap';

/**
 * Clamp a rectangle to scene bounds
 */
function clampToScene(x: number, y: number, w: number, h: number, sceneW: number, sceneH: number) {
  const nx = Math.min(Math.max(0, x), Math.max(0, sceneW - w));
  const ny = Math.min(Math.max(0, y), Math.max(0, sceneH - h));
  return { x: nx, y: ny };
}

/**
 * Snap coordinate to 10mm grid
 */
function snapTo10mm(x: number): number {
  return Math.round(x / 10) * 10;
}

export type SingleDragInput = {
  pieceId: ID;
  scene: SceneDraft;
  candidateX: number; // Raw candidate position (mm)
  candidateY: number;
  snap10mm: boolean;
};

export type SingleDragOutput = {
  x: number; // Final position after clamp + snap
  y: number;
  guides: SnapGuide[];
};

/**
 * Compute drag target for a single piece
 * Uses rotation-aware AABB for all calculations
 */
export function computeSingleDragTarget(input: SingleDragInput): SingleDragOutput {
  const { pieceId, scene, candidateX, candidateY, snap10mm } = input;

  const piece = scene.pieces[pieceId];
  if (!piece) {
    return { x: candidateX, y: candidateY, guides: [] };
  }

  // Use rotation-aware AABB for clamp and snap
  const bbox = pieceBBox(piece);

  // Clamp to scene bounds (using rotated AABB dimensions)
  const clamped = clampToScene(candidateX, candidateY, bbox.w, bbox.h, scene.size.w, scene.size.h);

  // Snap to other pieces (using rotated AABB)
  const candidateRect = { x: clamped.x, y: clamped.y, w: bbox.w, h: bbox.h };
  const snapResult = snapToPieces(scene, candidateRect, 5, pieceId);

  let finalX = snapResult.x;
  let finalY = snapResult.y;

  // Snap to grid if enabled
  if (snap10mm) {
    finalX = snapTo10mm(finalX);
    finalY = snapTo10mm(finalY);
  }

  return {
    x: finalX,
    y: finalY,
    guides: snapResult.guides,
  };
}

export type GroupDragInput = {
  selectedIds: ID[];
  scene: SceneDraft;
  candidateX: number; // Primary piece candidate position
  candidateY: number;
  groupOffsets: Record<ID, { dx: number; dy: number }>;
  snap10mm: boolean;
};

export type GroupDragOutput = {
  x: number; // Primary piece final position
  y: number;
  guides: SnapGuide[];
};

/**
 * Compute drag target for a group of pieces
 * Uses rotation-aware AABB for all pieces
 */
export function computeGroupDragTarget(input: GroupDragInput): GroupDragOutput {
  const { selectedIds, scene, candidateX, candidateY, groupOffsets, snap10mm } = input;

  // Compute group bounding box using rotated AABBs
  const groupRects = selectedIds
    .map((sid) => {
      const off = groupOffsets[sid] ?? { dx: 0, dy: 0 };
      const sp = scene.pieces[sid];
      if (!sp) return null;
      const bbox = pieceBBox(sp);
      return {
        x: candidateX + off.dx,
        y: candidateY + off.dy,
        w: bbox.w,
        h: bbox.h,
      };
    })
    .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;

  if (groupRects.length === 0) {
    return { x: candidateX, y: candidateY, guides: [] };
  }

  const gMinX = Math.min(...groupRects.map((r) => r.x));
  const gMinY = Math.min(...groupRects.map((r) => r.y));
  const gMaxX = Math.max(...groupRects.map((r) => r.x + r.w));
  const gMaxY = Math.max(...groupRects.map((r) => r.y + r.h));
  const gW = gMaxX - gMinX;
  const gH = gMaxY - gMinY;

  // Clamp group to scene
  const clamped = clampToScene(gMinX, gMinY, gW, gH, scene.size.w, scene.size.h);
  const clampDx = clamped.x - gMinX;
  const clampDy = clamped.y - gMinY;
  const clampedX = candidateX + clampDx;
  const clampedY = candidateY + clampDy;

  // Snap group to other pieces
  const candidateGroupRect = { x: clamped.x, y: clamped.y, w: gW, h: gH };
  const snapResult = snapGroupToPieces(scene, candidateGroupRect, 5, selectedIds);

  // Apply snap delta uniformly
  const snapDx = snapResult.x - candidateGroupRect.x;
  const snapDy = snapResult.y - candidateGroupRect.y;
  let finalX = clampedX + snapDx;
  let finalY = clampedY + snapDy;

  // Snap to grid if enabled
  if (snap10mm) {
    finalX = snapTo10mm(finalX);
    finalY = snapTo10mm(finalY);
  }

  return {
    x: finalX,
    y: finalY,
    guides: snapResult.guides,
  };
}
