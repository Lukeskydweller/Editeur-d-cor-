import type { ID } from '@/types/scene';
import type { LayerName } from '@/constants/layers';
import type { SceneStoreState } from '@/state/useSceneStore';
import { isLayerUnlocked } from './layers.gating';

/**
 * Get the active layer ID, falling back to the first layer (C1) if no active layer is set.
 */
export function getActiveOrDefaultLayerId(s: SceneStoreState): ID | undefined {
  return s.ui.activeLayer ?? s.scene.layerOrder[0];
}

/**
 * Convert a layer ID to its fixed layer name (C1, C2, C3), or null if not a fixed layer.
 */
export function layerNameFromId(s: SceneStoreState, id: ID | undefined): LayerName | null {
  const f = s.scene.fixedLayerIds;
  if (!f || !id) return null;
  if (id === f.C1) return 'C1';
  if (id === f.C2) return 'C2';
  if (id === f.C3) return 'C3';
  return null;
}

/**
 * Check if the active layer (or default layer) is unlocked for insertion.
 */
export function isActiveLayerUnlocked(s: SceneStoreState): boolean {
  const name = layerNameFromId(s, getActiveOrDefaultLayerId(s));
  return name ? isLayerUnlocked(s, name) : true;
}
