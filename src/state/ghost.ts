import type { ID } from '@/types/scene';

export type GhostSeverity = 'none' | 'warn' | 'block';

/**
 * Compute committed ghost state for a piece based on exact support results.
 *
 * Committed ghost state is derived from exact PathOps validation after drag/resize commit.
 * It persists independently of transient ghost state (during active drag/resize).
 *
 * @param exactSupportResults - Map of piece ID to support status (false = unsupported)
 * @param lastExactCheckAt - Timestamp of last exact support check (ms)
 * @param pieceId - ID of piece to check
 * @param freshnessMs - Max age of results to consider fresh (default 5000ms)
 * @returns Ghost state with severity level
 */
export function computeCommittedGhostState(
  exactSupportResults: Record<ID, boolean> | undefined,
  lastExactCheckAt: number | undefined,
  pieceId: ID,
  freshnessMs = 5000,
): { isGhost: boolean; severity: GhostSeverity } {
  // Check if results are fresh enough to use
  const fresh = !!lastExactCheckAt && Date.now() - lastExactCheckAt < freshnessMs;

  if (!fresh || !exactSupportResults) {
    return { isGhost: false, severity: 'none' };
  }

  // Check if piece has exact support result
  const isSupported = exactSupportResults[pieceId];

  if (isSupported === undefined) {
    // Piece not checked yet - assume supported
    return { isGhost: false, severity: 'none' };
  }

  if (isSupported) {
    // Piece is fully supported
    return { isGhost: false, severity: 'none' };
  }

  // Piece is NOT supported - ghost with WARN severity
  // (In future, could add BLOCK severity for critical support violations)
  return { isGhost: true, severity: 'warn' };
}
