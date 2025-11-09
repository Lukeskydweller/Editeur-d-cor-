import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import {
  filterSameLayerCandidates,
  isSameLayer,
  getPieceIdsInLayer,
} from '../../src/state/layers.filter';

describe('layers.filter utilities', () => {
  beforeEach(() => {
    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(1000, 1000);
  });

  describe('getPieceIdsInLayer', () => {
    it('returns piece IDs in a given layer', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // C1: two pieces
      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });

      const state = useSceneStore.getState();
      const c1Pieces = getPieceIdsInLayer(state, ids.C1);

      expect(c1Pieces).toEqual(expect.arrayContaining([p1!, p2!]));
      expect(c1Pieces.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array for layer with no pieces', () => {
      const s = useSceneStore.getState();
      const ids = s.scene.fixedLayerIds!;

      // C3 has no pieces initially
      const c3Pieces = getPieceIdsInLayer(s, ids.C3);
      expect(c3Pieces).toEqual([]);
    });
  });

  describe('isSameLayer', () => {
    it('returns true for pieces on same layer', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });

      const state = useSceneStore.getState();
      expect(isSameLayer(state, p1!, p2!)).toBe(true);
    });

    it('returns false for pieces on different layers', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });
      // Unlock C2 by having a piece on C1
      s.setActiveLayer(ids.C2);
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C2 });

      const state = useSceneStore.getState();
      expect(isSameLayer(state, p1!, p2!)).toBe(false);
    });

    it('returns false for non-existent piece', () => {
      const s = useSceneStore.getState();
      expect(isSameLayer(s, 'nonexistent1', 'nonexistent2')).toBe(false);
    });
  });

  describe('filterSameLayerCandidates', () => {
    it('retourne uniquement les IDs de la même couche', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // C1: two pieces
      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });

      // C2: one piece (need to unlock C2 first)
      s.setActiveLayer(ids.C2);
      const p3 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C2 });

      const state = useSceneStore.getState();
      const raw = [p1!, p2!, p3!];

      // p3 (C2) should not "see" p1/p2 (C1)
      const filtered = filterSameLayerCandidates(state, p3!, raw);
      expect(filtered).toEqual([]);

      // p1 (C1) should only "see" p2 (C1), not p3 (C2)
      const filtered2 = filterSameLayerCandidates(state, p1!, raw);
      expect(filtered2).toEqual(expect.arrayContaining([p2!]));
      expect(filtered2).not.toEqual(expect.arrayContaining([p3!]));
      expect(filtered2.length).toBe(1);
    });

    it('excludes moving piece itself', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });

      const state = useSceneStore.getState();
      const raw = [p1!, p2!];

      const filtered = filterSameLayerCandidates(state, p1!, raw);
      expect(filtered).toEqual([p2!]);
      expect(filtered).not.toContain(p1!);
    });

    it('returns empty array when moving piece is on different layer than all candidates', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      const p1 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C1 });

      // Unlock C2
      s.setActiveLayer(ids.C2);
      const p2 = await s.insertRect({ w: 60, h: 60, materialId: mat, layerId: ids.C2 });

      const state = useSceneStore.getState();

      // p2 (C2) looking at C1 pieces
      const filtered = filterSameLayerCandidates(state, p2!, [p1!]);
      expect(filtered).toEqual([]);
    });
  });
});
