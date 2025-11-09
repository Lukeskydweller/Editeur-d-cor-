import { describe, it, expect, beforeEach } from 'vitest';
import { LayeredRBush } from '../../src/spatial/rbushIndex';

/**
 * Unit tests for LayeredRBush spatial index
 *
 * Validates that RBush per-layer indexing correctly:
 * - Organizes pieces by layer
 * - Returns same-layer neighbors for collision queries
 * - Maintains consistent behavior with global index fallback
 */
describe('Spatial: LayeredRBush', () => {
  let index: LayeredRBush;

  beforeEach(() => {
    index = new LayeredRBush();
  });

  it('creates separate trees for each layer', () => {
    // Arrange: Insert items into two different layers
    index.insert('C1', {
      id: 'piece1',
      layerId: 'C1',
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    });

    index.insert('C2', {
      id: 'piece2',
      layerId: 'C2',
      minX: 50,
      minY: 50,
      maxX: 150,
      maxY: 150,
    });

    // Act: Get stats
    const stats = index.stats();

    // Assert: Two layers exist
    expect(stats.length).toBe(2);
    expect(stats.find((s) => s.layerId === 'C1')?.count).toBe(1);
    expect(stats.find((s) => s.layerId === 'C2')?.count).toBe(1);
  });

  it('searches only within specified layer', () => {
    // Arrange: C1 has piece at (0,0)-(100,100), C2 has piece at (50,50)-(150,150)
    index.insert('C1', {
      id: 'c1-piece',
      layerId: 'C1',
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    });

    index.insert('C2', {
      id: 'c2-piece',
      layerId: 'C2',
      minX: 50,
      minY: 50,
      maxX: 150,
      maxY: 150,
    });

    // Act: Search C1 layer for overlaps with (40,40)-(80,80)
    const c1Results = index.search('C1', { minX: 40, minY: 40, maxX: 80, maxY: 80 });

    // Assert: Only C1 piece returned
    expect(c1Results.length).toBe(1);
    expect(c1Results[0].id).toBe('c1-piece');

    // Act: Search C2 layer for overlaps with (40,40)-(80,80)
    const c2Results = index.search('C2', { minX: 40, minY: 40, maxX: 80, maxY: 80 });

    // Assert: Only C2 piece returned
    expect(c2Results.length).toBe(1);
    expect(c2Results[0].id).toBe('c2-piece');
  });

  it('returns empty array for non-existent layer', () => {
    // Act: Search layer that doesn't exist
    const results = index.search('nonexistent', { minX: 0, minY: 0, maxX: 100, maxY: 100 });

    // Assert: Empty results
    expect(results).toEqual([]);
  });

  it('bulk loads items into layer', () => {
    // Arrange: Prepare multiple items
    const items = [
      { id: 'p1', layerId: 'C1', minX: 0, minY: 0, maxX: 50, maxY: 50 },
      { id: 'p2', layerId: 'C1', minX: 100, minY: 100, maxX: 150, maxY: 150 },
      { id: 'p3', layerId: 'C1', minX: 200, minY: 200, maxX: 250, maxY: 250 },
    ];

    // Act: Bulk load
    index.load('C1', items);

    // Assert: All items indexed
    const stats = index.stats();
    expect(stats.find((s) => s.layerId === 'C1')?.count).toBe(3);

    // Act: Search for all
    const results = index.search('C1', { minX: 0, minY: 0, maxX: 300, maxY: 300 });

    // Assert: All found
    expect(results.length).toBe(3);
    expect(results.map((r) => r.id).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns only intersecting items', () => {
    // Arrange: Three pieces at different locations
    index.insert('C2', {
      id: 'left',
      layerId: 'C2',
      minX: 0,
      minY: 100,
      maxX: 50,
      maxY: 150,
    });

    index.insert('C2', {
      id: 'center',
      layerId: 'C2',
      minX: 100,
      minY: 100,
      maxX: 150,
      maxY: 150,
    });

    index.insert('C2', {
      id: 'right',
      layerId: 'C2',
      minX: 200,
      minY: 100,
      maxX: 250,
      maxY: 150,
    });

    // Act: Search for items overlapping center region
    const results = index.search('C2', { minX: 90, minY: 90, maxX: 160, maxY: 160 });

    // Assert: Only center piece returned
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('center');
  });

  it('clears all trees', () => {
    // Arrange: Add items to multiple layers
    index.insert('C1', { id: 'p1', layerId: 'C1', minX: 0, minY: 0, maxX: 50, maxY: 50 });
    index.insert('C2', { id: 'p2', layerId: 'C2', minX: 0, minY: 0, maxX: 50, maxY: 50 });

    // Act: Clear
    index.clear();

    // Assert: No items remain
    const stats = index.stats();
    expect(stats.length).toBe(0);
    expect(index.totalCount()).toBe(0);
  });

  it('calculates total count across layers', () => {
    // Arrange: Add items to multiple layers
    index.insert('C1', { id: 'p1', layerId: 'C1', minX: 0, minY: 0, maxX: 50, maxY: 50 });
    index.insert('C1', { id: 'p2', layerId: 'C1', minX: 100, minY: 0, maxX: 150, maxY: 50 });
    index.insert('C2', { id: 'p3', layerId: 'C2', minX: 0, minY: 100, maxX: 50, maxY: 150 });

    // Act: Get total
    const total = index.totalCount();

    // Assert: Correct sum
    expect(total).toBe(3);
  });
});
