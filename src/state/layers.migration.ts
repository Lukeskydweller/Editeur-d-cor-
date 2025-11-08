import type { SceneDraft, ID } from '@/types/scene';

export type LayersMigrationTag = {
  layersV1?: { appliedAt: string };
};

/**
 * Migrate legacy scene (>3 layers) to canonical 3-layer structure.
 *
 * Idempotent: safe to run multiple times.
 *
 * Pre-conditions:
 * - fixedLayerIds must be set (ensureFixedLayerIds already called)
 * - layerOrder must be canonical [C1, C2, C3, ...legacy] (canonicalizeLayerOrder already called)
 *
 * Actions:
 * - Reassign all pieces from layers >C3 to C3
 * - Remove legacy layers from layers map
 * - Force layerOrder to exactly [C1, C2, C3]
 * - Tag scene with migration timestamp
 *
 * @returns true if migration was performed, false if already migrated
 */
export function migrateSceneToThreeFixedLayers(scene: SceneDraft, nowISO: string): boolean {
  // Pre-condition: fixedLayerIds must exist
  if (!scene.fixedLayerIds) return false;

  const { C1, C2, C3 } = scene.fixedLayerIds;

  // Detect legacy layers (>C3)
  const keep = new Set<ID>([C1, C2, C3]);
  const legacyLayerIds = scene.layerOrder.filter((id) => !keep.has(id));

  // Already migrated (no legacy layers)
  if (legacyLayerIds.length === 0) return false;

  // Reassign all pieces from C4+ to C3
  for (const lid of legacyLayerIds) {
    const layer = scene.layers[lid];
    if (!layer) continue;

    for (const pid of layer.pieces ?? []) {
      // Move piece ID to C3 layer
      scene.layers[C3].pieces.push(pid);

      // Update piece.layerId to C3 (migration is the only legitimate layerId reassignment)
      if (scene.pieces?.[pid]) {
        // Use type assertion to bypass readonly during migration
        (scene.pieces[pid] as { layerId: ID }).layerId = C3 as ID;
      }
    }

    // Remove legacy layer
    delete scene.layers[lid];
  }

  // Force layerOrder to exactly [C1, C2, C3]
  scene.layerOrder = [C1, C2, C3];

  // Tag migration (journaling)
  (scene as any).migrations = {
    ...(scene as any).migrations,
    layersV1: { appliedAt: nowISO },
  } as LayersMigrationTag;

  return true;
}
