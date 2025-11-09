import { LayerName } from '@/constants/layers';
import type { SceneState } from '@/state/useSceneStore';
import type { ID } from '@/types/scene';

/**
 * Count the number of pieces in a given layer
 */
export const countPiecesInLayer = (s: SceneState, layerId: ID) =>
  s.scene.layers[layerId]?.pieces?.length ?? 0;

/**
 * Check if a layer has at least one piece
 */
export const isLayerFilled = (s: SceneState, name: LayerName): boolean => {
  const ids = s.scene.fixedLayerIds!;
  const id = ids[name];
  return countPiecesInLayer(s, id) > 0;
};

/**
 * Check if a layer is unlocked for insertion
 * - C1 is always unlocked
 * - C2 is unlocked when C1 has ≥1 piece
 * - C3 is unlocked when C2 has ≥1 piece
 */
export const isLayerUnlocked = (s: SceneState, name: LayerName): boolean => {
  if (name === 'C1') return true;
  if (name === 'C2') return isLayerFilled(s, 'C1');
  return isLayerFilled(s, 'C2');
};
