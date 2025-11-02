import { describe, it, expect, beforeEach } from 'vitest';
import { createSpatialIndex } from '../../src/lib/spatial/indexRBush';

describe('spatial index', () => {
  it('neighbors excludes ids via excludeId and excludeIdSet', () => {
    const ix = createSpatialIndex();
    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
    ix.upsert('b', { x: 5, y: 5, w: 10, h: 10 });

    const n1 = ix.neighbors({ x: 0, y: 0, w: 12, h: 12 });
    expect(new Set(n1)).toEqual(new Set(['a', 'b']));

    const n2 = ix.neighbors({ x: 0, y: 0, w: 12, h: 12 }, { excludeId: 'a' });
    expect(n2).toEqual(['b']);

    const n3 = ix.neighbors({ x: 0, y: 0, w: 12, h: 12 }, { excludeIdSet: new Set(['a', 'b']) });
    expect(n3).toEqual([]);
  });

  it('incremental rebuild triggers after >20 mutations', () => {
    const ix = createSpatialIndex();
    for (let i = 0; i < 25; i++) {
      ix.upsert('p' + i, { x: i, y: i, w: 10, h: 10 });
    }
    const s = ix.stats();
    expect(s.rebuilds).toBeGreaterThan(0);
  });

  it('neighbors returns empty for non-intersecting query', () => {
    const ix = createSpatialIndex();
    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
    ix.upsert('b', { x: 100, y: 100, w: 10, h: 10 });

    const n = ix.neighbors({ x: 50, y: 50, w: 5, h: 5 });
    expect(n).toEqual([]);
  });

  it('remove deletes items from index', () => {
    const ix = createSpatialIndex();
    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
    ix.upsert('b', { x: 5, y: 5, w: 10, h: 10 });

    expect(ix.stats().items).toBe(2);

    ix.remove('a');
    expect(ix.stats().items).toBe(1);

    const n = ix.neighbors({ x: 0, y: 0, w: 12, h: 12 });
    expect(n).toEqual(['b']);
  });

  it('upsert updates existing item', () => {
    const ix = createSpatialIndex();
    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });

    let n = ix.neighbors({ x: 100, y: 100, w: 10, h: 10 });
    expect(n).toEqual([]);

    // Move item to new position
    ix.upsert('a', { x: 100, y: 100, w: 10, h: 10 });

    n = ix.neighbors({ x: 95, y: 95, w: 10, h: 10 });
    expect(n).toEqual(['a']);
  });

  it('handles concurrent excludeId and excludeIdSet', () => {
    const ix = createSpatialIndex();
    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
    ix.upsert('b', { x: 5, y: 5, w: 10, h: 10 });
    ix.upsert('c', { x: 3, y: 3, w: 10, h: 10 });

    // Exclude 'a' via excludeId AND 'b' via excludeIdSet
    const n = ix.neighbors(
      { x: 0, y: 0, w: 15, h: 15 },
      { excludeId: 'a', excludeIdSet: new Set(['b']) }
    );
    expect(n).toEqual(['c']);
  });

  it('stats reports correct metrics', () => {
    const ix = createSpatialIndex();
    const initialStats = ix.stats();
    expect(initialStats.items).toBe(0);
    expect(initialStats.rebuilds).toBe(0);

    ix.upsert('a', { x: 0, y: 0, w: 10, h: 10 });
    const afterInsert = ix.stats();
    expect(afterInsert.items).toBe(1);

    // Force query to trigger rebuild
    ix.neighbors({ x: 0, y: 0, w: 5, h: 5 });
    const afterQuery = ix.stats();
    expect(afterQuery.rebuilds).toBeGreaterThan(0);
  });
});
