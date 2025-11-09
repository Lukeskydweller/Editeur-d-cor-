/**
 * Type guards for UI state discriminated unions.
 *
 * These guards enable safe narrowing of union types using the 'kind' discriminant.
 *
 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 */

import type { GroupResizingState, DragState } from './ui.types';

/**
 * Type guard to check if UI state is in group resizing mode.
 *
 * @param x - The value to check (typically draft.ui.groupResizing)
 * @returns true if x is a GroupResizingState, false otherwise
 *
 * @example
 * const g = draft.ui.groupResizing;
 * if (isGroupResizing(g)) {
 *   g.lastScale = scale; // TypeScript knows g is GroupResizingState
 * }
 */
export function isGroupResizing(x: unknown): x is GroupResizingState {
  return typeof x === 'object' && x !== null && 'kind' in x && (x as any).kind === 'group-resize';
}

/**
 * Type guard to check if UI state is in dragging mode.
 *
 * @param x - The value to check (typically draft.ui.drag)
 * @returns true if x is a DragState, false otherwise
 *
 * @example
 * if (isDragging(draft.ui.drag)) {
 *   const pieceId = draft.ui.drag.pieceId; // TypeScript knows structure
 * }
 */
export function isDragging(x: unknown): x is DragState {
  return typeof x === 'object' && x !== null && 'kind' in x && (x as any).kind === 'drag';
}
