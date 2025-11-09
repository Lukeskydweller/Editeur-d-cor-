import type { Piece, MaterialRef } from '@/types/scene';

/**
 * Type guards for narrowing unknown types to specific types.
 *
 * These guards are used to safely narrow unknown values from indexations
 * (e.g., scene.pieces[id] returns unknown) to typed values before usage.
 *
 * @see https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 */

/**
 * Type guard to check if an unknown value is a valid Piece.
 *
 * @param x - The value to check
 * @returns true if x is a Piece, false otherwise
 *
 * @example
 * const candidatePiece = candidate.pieces[dragState.pieceId];
 * if (!isPiece(candidatePiece)) return;
 * updatePiece(candidatePiece, patch); // candidatePiece is now typed as Piece
 */
export function isPiece(x: unknown): x is Piece {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    'size' in x &&
    'position' in x &&
    'kind' in x
  );
}

/**
 * Type guard to check if an unknown value is a valid MaterialRef.
 *
 * @param x - The value to check
 * @returns true if x is a MaterialRef, false otherwise
 *
 * @example
 * const material = scene.materials[piece.materialId];
 * if (!isMaterial(material)) return;
 * console.log(material.name); // material is now typed as MaterialRef
 */
export function isMaterial(x: unknown): x is MaterialRef {
  return typeof x === 'object' && x !== null && 'id' in x && 'name' in x;
}

/**
 * Type guard to check if a number is a valid rotation value (0, 90, 180, 270).
 *
 * @param n - The number to check
 * @returns true if n is a valid rotation (0, 90, 180, 270)
 */
export function isValidRotation(n: number): n is 0 | 90 | 180 | 270 {
  return n === 0 || n === 90 || n === 180 || n === 270;
}
