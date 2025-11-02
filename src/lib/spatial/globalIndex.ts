/**
 * Global spatial index singleton for performance optimization
 * Maintains a spatial index of all pieces for fast neighbor queries
 *
 * Auto-enable feature: automatically activate global index when scene becomes dense
 */
import { createSpatialIndex, type SpatialIndex } from './indexRBush';
import type { ID } from '@/types/scene';

// Global singleton instance
let _globalIndex: SpatialIndex | null = null;

// Auto-enable state
let _autoEnabled = false;
let _autoThresholdOn = 120;  // Enable when piece count >= this
let _autoThresholdOff = 100; // Disable when piece count <= this
let _onAutoToggle: ((enabled: boolean) => void) | null = null;

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
 * Auto-enable API: get/set auto-enabled state
 */
export function isAutoEnabled(): boolean {
  return _autoEnabled;
}

export function setAutoEnabled(enabled: boolean): void {
  _autoEnabled = enabled;
  if (_onAutoToggle) {
    _onAutoToggle(enabled);
  }
}

/**
 * Configure auto-enable thresholds with hysteresis
 * @param minOn - Minimum piece count to enable (default: 120)
 * @param maxOff - Maximum piece count to disable (default: 100)
 */
export function setAutoThreshold(minOn: number, maxOff: number): void {
  _autoThresholdOn = minOn;
  _autoThresholdOff = maxOff;
}

/**
 * Get current auto-enable thresholds
 */
export function getAutoThreshold(): { minOn: number; maxOff: number } {
  return { minOn: _autoThresholdOn, maxOff: _autoThresholdOff };
}

/**
 * Set callback for auto-toggle events
 * @internal
 */
export function _setOnAutoToggle(cb: ((enabled: boolean) => void) | null): void {
  _onAutoToggle = cb;
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
  },
  resetAutoState() {
    _autoEnabled = false;
    _autoThresholdOn = 120;
    _autoThresholdOff = 100;
  }
};
