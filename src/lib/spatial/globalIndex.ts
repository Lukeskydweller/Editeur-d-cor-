/**
 * Global spatial index singleton for performance optimization
 * Maintains a spatial index of all pieces for fast neighbor queries
 */
import { createSpatialIndex, type SpatialIndex } from './indexRBush';
import type { ID } from '@/types/scene';

// Global singleton instance
let _globalIndex: SpatialIndex | null = null;

export function getGlobalSpatialIndex(): SpatialIndex {
  if (!_globalIndex) {
    _globalIndex = createSpatialIndex();
  }
  return _globalIndex;
}

/**
 * Helper to sync a piece to the global index
 */
export function syncPieceToIndex(id: ID, rect: { x: number; y: number; w: number; h: number }) {
  getGlobalSpatialIndex().upsert(id, rect);
}

/**
 * Helper to remove a piece from the global index
 */
export function removePieceFromIndex(id: ID) {
  getGlobalSpatialIndex().remove(id);
}

/**
 * Query neighbors with optional exclusions
 */
export function queryNeighbors(
  rect: { x: number; y: number; w: number; h: number },
  opts?: { excludeId?: ID; excludeIdSet?: Set<ID> }
): ID[] {
  return getGlobalSpatialIndex().neighbors(rect, opts);
}

/**
 * Get index statistics for debugging/metrics
 */
export function getSpatialStats() {
  return getGlobalSpatialIndex().stats();
}

/**
 * Internal access to spatial index - ONLY for testing purposes
 * @internal
 */
export const __spatialInternal = {
  get index() {
    return _globalIndex;
  },
  resetForTest() {
    _globalIndex = null;
  }
};
