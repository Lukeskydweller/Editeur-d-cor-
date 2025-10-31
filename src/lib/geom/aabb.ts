/**
 * Axis-Aligned Bounding Box utilities for rotation-aware geometric calculations
 *
 * V1 constraints: rectangles can be rotated {0, 90, 180, 270}°
 * All geometric operations (snap, collision, validation) must use the rotated AABB
 */

import type { Piece } from '@/types/scene';

export type AABB = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Edges = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number; // center x
  cy: number; // center y
};

/**
 * Compute the axis-aligned bounding box of a piece, accounting for rotation
 *
 * - If rotation is 0° or 180°: AABB = {x, y, w, h} unchanged
 * - If rotation is 90° or 270°: swap w/h around visual center
 *
 * This does NOT modify the piece data (position/size/rotation remain unchanged)
 * It only provides the correct AABB for geometric calculations
 */
export function pieceAABB(p: Piece): AABB {
  const x = p.position.x;
  const y = p.position.y;
  const w = p.size.w;
  const h = p.size.h;

  // Normalize rotation to 0-359
  const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;

  // If rotated 90° or 270°, swap width/height around center
  if (r === 90 || r === 270) {
    const cx = x + w / 2;
    const cy = y + h / 2;

    return {
      x: cx - h / 2,
      y: cy - w / 2,
      w: h,
      h: w,
    };
  }

  // For 0° or 180°, AABB is unchanged
  return { x, y, w, h };
}

/**
 * Extract edges and center from a rectangle
 * Useful for snap calculations
 */
export function edgesOfRect(r: AABB): Edges {
  const left = r.x;
  const right = r.x + r.w;
  const top = r.y;
  const bottom = r.y + r.h;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;

  return { left, right, top, bottom, cx, cy };
}
