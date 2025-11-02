/**
 * Pure utility functions for AABB rectangle resizing
 * Supports 8 handles: N, S, E, W, NE, NW, SE, SW
 * Now supports rotated pieces via local frame transforms
 */

import {
  makeLocalFrame,
  worldDeltaToLocal,
  applyLocalResize as applyLocalResizeTransform,
} from '@/core/geo/transform';

export type Rect = { x: number; y: number; w: number; h: number };

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ResizeOptions = {
  minW: number;
  minH: number;
  lockEdge: boolean;
};

/**
 * Apply resize handle to rectangle
 * Returns new rectangle with constraints applied
 */
export function applyHandle(
  rect: Rect,
  handle: ResizeHandle,
  to: { x: number; y: number },
  opts: ResizeOptions
): Rect {
  const { minW, minH, lockEdge } = opts;

  // Store original bounds
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = rect.y;
  const bottom = rect.y + rect.h;

  let newLeft = left;
  let newRight = right;
  let newTop = top;
  let newBottom = bottom;

  // Apply handle movement
  switch (handle) {
    case 'n':
      if (lockEdge) {
        // Lock bottom edge, resize from top
        newTop = to.y;
      } else {
        newTop = to.y;
      }
      break;

    case 's':
      if (lockEdge) {
        // Lock top edge, resize from bottom
        newBottom = to.y;
      } else {
        newBottom = to.y;
      }
      break;

    case 'e':
      if (lockEdge) {
        // Lock left edge, resize from right
        newRight = to.x;
      } else {
        newRight = to.x;
      }
      break;

    case 'w':
      if (lockEdge) {
        // Lock right edge, resize from left
        newLeft = to.x;
      } else {
        newLeft = to.x;
      }
      break;

    case 'ne':
      if (lockEdge) {
        // Lock bottom-left corner
        newTop = to.y;
        newRight = to.x;
      } else {
        newTop = to.y;
        newRight = to.x;
      }
      break;

    case 'nw':
      if (lockEdge) {
        // Lock bottom-right corner
        newTop = to.y;
        newLeft = to.x;
      } else {
        newTop = to.y;
        newLeft = to.x;
      }
      break;

    case 'se':
      if (lockEdge) {
        // Lock top-left corner
        newBottom = to.y;
        newRight = to.x;
      } else {
        newBottom = to.y;
        newRight = to.x;
      }
      break;

    case 'sw':
      if (lockEdge) {
        // Lock top-right corner
        newBottom = to.y;
        newLeft = to.x;
      } else {
        newBottom = to.y;
        newLeft = to.x;
      }
      break;
  }

  // Compute candidate dimensions
  let newW = newRight - newLeft;
  let newH = newBottom - newTop;

  // Apply minimum size constraints
  if (newW < minW) {
    // Adjust based on which edge moved
    if (handle.includes('e')) {
      // Moving right edge
      newRight = newLeft + minW;
    } else if (handle.includes('w')) {
      // Moving left edge
      newLeft = newRight - minW;
    }
    newW = minW;
  }

  if (newH < minH) {
    // Adjust based on which edge moved
    if (handle.includes('s')) {
      // Moving bottom edge
      newBottom = newTop + minH;
    } else if (handle.includes('n')) {
      // Moving top edge
      newTop = newBottom - minH;
    }
    newH = minH;
  }

  return {
    x: newLeft,
    y: newTop,
    w: newW,
    h: newH,
  };
}

/**
 * Get the position of a handle for a given rectangle
 * Returns center point of the handle
 */
export function getHandlePosition(rect: Rect, handle: ResizeHandle): { x: number; y: number } {
  const { x, y, w, h } = rect;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const right = x + w;
  const bottom = y + h;

  switch (handle) {
    case 'n':
      return { x: centerX, y };
    case 's':
      return { x: centerX, y: bottom };
    case 'e':
      return { x: right, y: centerY };
    case 'w':
      return { x, y: centerY };
    case 'ne':
      return { x: right, y };
    case 'nw':
      return { x, y };
    case 'se':
      return { x: right, y: bottom };
    case 'sw':
      return { x, y: bottom };
  }
}

/**
 * Convert handle to cardinal direction (for local frame resize)
 */
function toCardinal(handle: ResizeHandle): 'N' | 'S' | 'E' | 'W' {
  switch (handle) {
    case 'n':
      return 'N';
    case 's':
      return 'S';
    case 'e':
      return 'E';
    case 'w':
      return 'W';
    case 'ne':
    case 'se':
      return 'E';
    case 'nw':
    case 'sw':
      return 'W';
  }
}

/**
 * Apply resize with rotation support
 * Uses local frame transforms when rotationDeg is provided
 */
export function applyHandleWithRotation(
  rect: Rect,
  handle: ResizeHandle,
  startPointerMm: { x: number; y: number },
  currentPointerMm: { x: number; y: number },
  rotationDeg: number,
  opts: ResizeOptions
): Rect {
  const { minW, minH, lockEdge } = opts;

  // Calculate world delta from drag start to current position
  const dx = currentPointerMm.x - startPointerMm.x;
  const dy = currentPointerMm.y - startPointerMm.y;

  // If not rotated, fall back to original AABB logic
  if (rotationDeg === 0 || rotationDeg === 360) {
    return applyHandle(rect, handle, currentPointerMm, opts);
  }

  // Create local frame (pivot = center)
  const frame = makeLocalFrame(rect.x, rect.y, rect.w, rect.h, rotationDeg);

  // Convert world delta to local delta
  const dl = worldDeltaToLocal(dx, dy, frame);

  // Get cardinal direction
  const cardinal = toCardinal(handle);

  // Apply resize in local frame
  let { w, h } = applyLocalResizeTransform(rect.w, rect.h, cardinal, dl);

  // Apply minimum size
  w = Math.max(w, minW);
  h = Math.max(h, minH);

  // Calculate new position
  let nx = rect.x;
  let ny = rect.y;

  if (lockEdge) {
    // Lock opposite edge: adjust position to keep it fixed
    switch (cardinal) {
      case 'E':
        // Lock W edge: shift left by width delta
        nx = rect.x + (rect.w - w);
        break;
      case 'W':
        // Lock E edge: keep x
        nx = rect.x;
        break;
      case 'S':
        // Lock N edge: shift up by height delta
        ny = rect.y + (rect.h - h);
        break;
      case 'N':
        // Lock S edge: keep y
        ny = rect.y;
        break;
    }
  } else {
    // Center pivot: recalculate position to keep center fixed
    nx = frame.cx - w / 2;
    ny = frame.cy - h / 2;
  }

  return { x: nx, y: ny, w, h };
}
