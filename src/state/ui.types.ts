/**
 * UI state types with discriminated unions for type-safe narrowing.
 *
 * These types use the 'kind' discriminant property to enable TypeScript's
 * discriminated union narrowing without runtime changes.
 *
 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
 */

import type { ID, Milli, BBox } from '@/types/scene';

/**
 * Resize handle positions for piece/group resizing.
 * Centralized type to ensure consistency across components.
 */
export type ResizeHandle =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw' // corners
  | 'n'
  | 's'
  | 'e'
  | 'w'; // edges

/**
 * Resize handle constants for iteration/validation.
 */
export const RESIZE_HANDLES = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'] as const;

/**
 * Group resize state (discriminated by kind='group-resize').
 *
 * Properties marked optional/nullable to avoid runtime impact when adding
 * missing fields that TypeScript detected.
 */
export type GroupResizingState = {
  kind: 'group-resize';
  isResizing: boolean;
  pivot: { x: Milli; y: Milli };
  startSnapshot: any; // SceneStateSnapshot - avoiding circular import
  startPointer: { x: Milli; y: Milli };
  startRadius: Milli;
  lastScale?: number;
  preview?: any;

  // Optional fields to satisfy TypeScript (previously missing in type definition)
  originBBox?: BBox | null;
  startPointerMm?: { x: Milli; y: Milli } | null;
  handle?: ResizeHandle | null;
  pieceOrigins?: Record<ID, { x: Milli; y: Milli; w: Milli; h: Milli }> | null;
};

/**
 * Drag state (discriminated by kind='drag').
 */
export type DragState = {
  kind: 'drag';
  pieceId: ID;
  startPos: { x: Milli; y: Milli };
  candidate: {
    x: Milli;
    y: Milli;
    valid: boolean;
    w?: Milli;
    h?: Milli;
  };

  // Optional fields
  start?: { x: Milli; y: Milli } | null;
};
