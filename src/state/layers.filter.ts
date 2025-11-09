import type { ID } from '@/types/scene';
import type { SceneStoreState } from './useSceneStore';

/**
 * Get all piece IDs in a given layer.
 */
export function getPieceIdsInLayer(s: SceneStoreState, layerId: ID): ID[] {
  return s.scene.layers[layerId]?.pieces ?? [];
}

/**
 * Check if two pieces are on the same layer.
 */
export function isSameLayer(s: SceneStoreState, aId: ID, bId: ID): boolean {
  const a = s.scene.pieces[aId];
  const b = s.scene.pieces[bId];
  return !!a && !!b && a.layerId === b.layerId;
}

/**
 * Filter candidate IDs to only include pieces on the same layer as the moving piece.
 * Excludes the moving piece itself.
 */
export function filterSameLayerCandidates(
  s: SceneStoreState,
  movingId: ID,
  candidateIds: ID[],
): ID[] {
  return candidateIds.filter((id) => isSameLayer(s, movingId, id) && id !== movingId);
}
