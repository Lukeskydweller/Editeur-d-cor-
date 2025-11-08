import type { SceneDraft, ID } from '@/types/scene';

/**
 * Development-only assertion to detect piece layer reassignment.
 * Throws an error if any piece's layerId has changed between prev and next state.
 *
 * This invariant ensures that pieces cannot be moved between layers after creation,
 * which is a core constraint of the 3-layer system (C1/C2/C3).
 *
 * @param prev - Previous scene state
 * @param next - Next scene state
 * @throws Error in development if layerId reassignment is detected
 */
export function devAssertNoLayerReassignment(prev: SceneDraft, next: SceneDraft): void {
  // Only run in development
  if (import.meta.env.PROD) return;

  // Check all pieces in previous state
  for (const pieceId of Object.keys(prev.pieces)) {
    const prevPiece = prev.pieces[pieceId];
    const nextPiece = next.pieces[pieceId];

    // If piece still exists, verify layerId hasn't changed
    if (nextPiece && prevPiece.layerId !== nextPiece.layerId) {
      const error = new Error(
        `[INVARIANT VIOLATION] Piece layer reassignment detected!\n` +
          `Piece ID: ${pieceId}\n` +
          `Previous layer: ${prevPiece.layerId}\n` +
          `New layer: ${nextPiece.layerId}\n` +
          `Pieces cannot be moved between layers after creation. This violates the 3-layer system invariant.`,
      );

      // Log to console for visibility
      console.error(error.message);

      // Throw in tests to fail fast
      if (import.meta.env.MODE === 'test') {
        throw error;
      }
    }
  }
}

/**
 * Verifies that all pieces in a scene belong to valid layers.
 * This is a sanity check to ensure data consistency.
 *
 * @param scene - Scene to validate
 * @returns true if all pieces belong to valid layers, false otherwise
 */
export function validatePieceLayerConsistency(scene: SceneDraft): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validLayerIds = new Set(Object.keys(scene.layers));

  for (const pieceId of Object.keys(scene.pieces)) {
    const piece = scene.pieces[pieceId];

    // Check if piece's layerId exists
    if (!validLayerIds.has(piece.layerId)) {
      errors.push(`Piece ${pieceId} references non-existent layer ${piece.layerId}`);
    }

    // Check if layer contains this piece
    const layer = scene.layers[piece.layerId];
    if (layer && !layer.pieces.includes(pieceId)) {
      errors.push(
        `Piece ${pieceId} belongs to layer ${piece.layerId} but layer.pieces doesn't include it`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
