import { describe, it, expect } from 'vitest';
import { validateNoOverlapSameLayer } from './index';
import type { SceneDraft } from '@/types/scene';

describe('validateNoOverlapSameLayer', () => {
  describe('Cross-layer collision filtering', () => {
    it('ignores collisions between pieces on different layers', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c1-1': {
            id: 'c1-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 200, h: 100 },
            layerId: 'layer-c1',
          },
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 150, y: 150 }, // Overlaps with c1-1
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-1 (which overlaps c1-1 from different layer)
      const result = validateNoOverlapSameLayer(scene, ['c2-1']);

      // Should NOT detect collision (different layers)
      expect(result.ok).toBe(true);
      expect(result.conflicts).toEqual([]);
    });

    it('detects collisions between pieces on same layer', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 200, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 }, // Overlaps with c2-1
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-1 (which overlaps c2-2 from same layer)
      const result = validateNoOverlapSameLayer(scene, ['c2-1']);

      // Should detect collision (same layer)
      expect(result.ok).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual(['c2-1', 'c2-2']);
    });
  });

  describe('Candidate filtering', () => {
    it('ignores collisions between non-candidate pieces', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 }, // Overlaps with c2-1
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-3': {
            id: 'c2-3',
            kind: 'rect',
            position: { x: 500, y: 500 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-3 (which does NOT overlap anyone)
      // c2-1 and c2-2 overlap each other but neither is candidate
      const result = validateNoOverlapSameLayer(scene, ['c2-3']);

      // Should NOT detect collision (c2-1 and c2-2 collision ignored)
      expect(result.ok).toBe(true);
      expect(result.conflicts).toEqual([]);
    });

    it('detects collision when at least one piece is candidate', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 }, // Overlaps with c2-1
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-2 (which overlaps c2-1)
      const result = validateNoOverlapSameLayer(scene, ['c2-2']);

      // Should detect collision
      expect(result.ok).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });
  });

  describe('Internal group collisions', () => {
    it('ignores collisions between pieces in same candidate group', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 }, // Overlaps with c2-1
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving both c2-1 and c2-2 together (group drag)
      const result = validateNoOverlapSameLayer(scene, ['c2-1', 'c2-2']);

      // Should NOT detect collision (both are candidates - internal group collision)
      expect(result.ok).toBe(true);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('Complex scenarios', () => {
    it('correctly handles multiple layers with candidates and non-candidates', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          // C1 layer
          'c1-1': {
            id: 'c1-1',
            kind: 'rect',
            position: { x: 0, y: 0 },
            size: { w: 500, h: 500 },
            layerId: 'layer-c1',
          },

          // C2 layer
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          }, // On c1-1
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          }, // Overlaps c2-1
          'c2-3': {
            id: 'c2-3',
            kind: 'rect',
            position: { x: 600, y: 600 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          }, // Candidate

          // C3 layer
          'c3-1': {
            id: 'c3-1',
            kind: 'rect',
            position: { x: 110, y: 110 },
            size: { w: 50, h: 50 },
            layerId: 'layer-c3',
          }, // On c2-1
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-3 (separate from all others)
      const result = validateNoOverlapSameLayer(scene, ['c2-3']);

      // Should be valid:
      // - c2-3 doesn't touch anyone
      // - c2-1 ↔ c2-2 collision ignored (neither is candidate)
      // - c1-1 ↔ c2-1 ignored (cross-layer)
      // - c2-1 ↔ c3-1 ignored (cross-layer)
      expect(result.ok).toBe(true);
      expect(result.conflicts).toEqual([]);
    });

    it('detects collision when moving piece into occupied same-layer space', () => {
      const scene: SceneDraft = {
        size: { w: 1000, h: 1000 },
        pieces: {
          'c1-1': {
            id: 'c1-1',
            kind: 'rect',
            position: { x: 0, y: 0 },
            size: { w: 500, h: 500 },
            layerId: 'layer-c1',
          },
          'c2-1': {
            id: 'c2-1',
            kind: 'rect',
            position: { x: 100, y: 100 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          },
          'c2-2': {
            id: 'c2-2',
            kind: 'rect',
            position: { x: 150, y: 120 },
            size: { w: 100, h: 100 },
            layerId: 'layer-c2',
          }, // Overlaps c2-1 (candidate)
        },
        layers: {},
        fixedLayerIds: { C1: 'layer-c1', C2: 'layer-c2', C3: 'layer-c3' },
      } as SceneDraft;

      // Moving c2-1 (which overlaps c2-2 on same layer)
      const result = validateNoOverlapSameLayer(scene, ['c2-1']);

      // Should detect collision with c2-2 (same layer, c2-1 is candidate)
      // Should NOT detect collision with c1-1 (cross-layer)
      expect(result.ok).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual(['c2-1', 'c2-2']);
    });
  });
});
