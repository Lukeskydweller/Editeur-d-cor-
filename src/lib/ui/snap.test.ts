import { describe, it, expect } from 'vitest';
import { snapToPieces, rectEdges } from './snap';
import type { SceneDraft } from '@/types/scene';

describe('snap', () => {
  describe('rectEdges', () => {
    it('computes edges and centers correctly', () => {
      const r = { x: 10, y: 20, w: 100, h: 60 };
      const e = rectEdges(r);
      expect(e.left).toBe(10);
      expect(e.right).toBe(110);
      expect(e.top).toBe(20);
      expect(e.bottom).toBe(80);
      expect(e.cx).toBe(60);
      expect(e.cy).toBe(50);
    });
  });

  describe('snapToPieces', () => {
    it('snaps to left edge within threshold', () => {
      const scene: SceneDraft = {
        id: 'test',
        createdAt: '',
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {
          p1: {
            id: 'p1',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 100, y: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // Candidate à 3 mm de p1.left
      const candidate = { x: 97, y: 200, w: 40, h: 40 };
      const result = snapToPieces(scene, candidate, 5);

      // Doit snapper à x=100 (left de p1)
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
      expect(result.guides).toHaveLength(1);
      expect(result.guides[0]).toEqual({ kind: 'v', x: 100 });
    });

    it('snaps to centerY within threshold', () => {
      const scene: SceneDraft = {
        id: 'test',
        createdAt: '',
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {
          p1: {
            id: 'p1',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 100, y: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // p1 centerY = 125 ; candidate centerY à 128 (écart 3 mm)
      const candidate = { x: 200, y: 123, w: 40, h: 10 }; // centerY = 123 + 5 = 128
      const result = snapToPieces(scene, candidate, 5);

      // Doit snapper pour que centerY = 125 → y = 125 - 5 = 120
      expect(result.y).toBe(120);
      expect(result.x).toBe(200);
      expect(result.guides).toHaveLength(1);
      expect(result.guides[0]).toEqual({ kind: 'h', y: 125 });
    });

    it('does not snap when outside threshold', () => {
      const scene: SceneDraft = {
        id: 'test',
        createdAt: '',
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {
          p1: {
            id: 'p1',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 100, y: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // Candidate à 10 mm de p1.left (> 5 mm threshold)
      const candidate = { x: 90, y: 200, w: 40, h: 40 };
      const result = snapToPieces(scene, candidate, 5);

      // Pas de snap
      expect(result.x).toBe(90);
      expect(result.y).toBe(200);
      expect(result.guides).toHaveLength(0);
    });

    it('respects excludeId', () => {
      const scene: SceneDraft = {
        id: 'test',
        createdAt: '',
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {
          p1: {
            id: 'p1',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 100, y: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // Candidate proche de p1, mais p1 est exclu
      const candidate = { x: 97, y: 200, w: 40, h: 40 };
      const result = snapToPieces(scene, candidate, 5, 'p1');

      // Pas de snap car p1 exclu
      expect(result.x).toBe(97);
      expect(result.y).toBe(200);
      expect(result.guides).toHaveLength(0);
    });
  });
});
