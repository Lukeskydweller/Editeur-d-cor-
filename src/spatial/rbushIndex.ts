/**
 * RBush Spatial Index by Layer
 *
 * Provides fast spatial queries for collision detection, snapping, and
 * neighbor search by organizing pieces into per-layer R-tree indexes.
 *
 * Purpose:
 * - Reduce O(n) linear scans to O(log n) spatial queries
 * - Enable efficient same-layer collision checks
 * - Support fast neighbor searches for snap-to-edge
 *
 * Usage:
 * - Activate with window.__SPATIAL__ = 'rbush' (dev) or auto-enable for large scenes
 * - Maintains same logical behavior as global index (AABB → same layer → SAT)
 * - Reports metrics via window.__SPATIAL_STATS__
 */

import RBush from 'rbush';
import type { ID } from '@/types/scene';

export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: ID;
  layerId: ID;
}

/**
 * Layered R-tree spatial index
 *
 * Maintains separate RBush tree for each layer to optimize same-layer queries.
 * Each tree stores piece AABBs with their IDs for fast collision detection.
 */
export class LayeredRBush {
  private trees = new Map<ID, RBush<SpatialItem>>();

  /**
   * Get or create RBush tree for a layer
   */
  get(layerId: ID): RBush<SpatialItem> {
    if (!this.trees.has(layerId)) {
      this.trees.set(layerId, new RBush<SpatialItem>());
    }
    return this.trees.get(layerId)!;
  }

  /**
   * Insert a single item into layer tree
   */
  insert(layerId: ID, item: SpatialItem): void {
    this.get(layerId).insert(item);
  }

  /**
   * Bulk load items into layer tree (faster than multiple inserts)
   */
  load(layerId: ID, items: SpatialItem[]): void {
    const tree = this.get(layerId);
    tree.clear();
    tree.load(items);
  }

  /**
   * Search for items intersecting a bounding box on a specific layer
   * @returns Array of items whose AABBs intersect the query box
   */
  search(
    layerId: ID,
    box: { minX: number; minY: number; maxX: number; maxY: number },
  ): SpatialItem[] {
    const tree = this.trees.get(layerId);
    if (!tree) return [];
    return tree.search(box);
  }

  /**
   * Remove an item from layer tree
   */
  remove(layerId: ID, item: SpatialItem): void {
    const tree = this.trees.get(layerId);
    if (tree) {
      tree.remove(item);
    }
  }

  /**
   * Clear all trees
   */
  clear(): void {
    this.trees.forEach((tree) => tree.clear());
    this.trees.clear();
  }

  /**
   * Get statistics for debugging/metrics
   */
  stats(): Array<{ layerId: ID; count: number }> {
    return Array.from(this.trees.entries()).map(([layerId, tree]) => ({
      layerId,
      // Access internal tree data to count items
      count: (tree as any).data?.children?.length ?? 0,
    }));
  }

  /**
   * Get total item count across all layers
   */
  totalCount(): number {
    return this.stats().reduce((sum, s) => sum + s.count, 0);
  }
}
