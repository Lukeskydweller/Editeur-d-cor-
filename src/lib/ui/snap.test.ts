import { describe, it, expect } from 'vitest';
import { snapToPieces, snapGroupToPieces, rectEdges } from './snap';
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

  describe('snapGroupToPieces', () => {
    it('snaps group to left edge within threshold', () => {
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
          p2: {
            id: 'p2',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 200, y: 200 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          p3: {
            id: 'p3',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 300, y: 300 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // Group bbox (p2+p3) à 3 mm de p1.left (100)
      const groupRect = { x: 97, y: 200, w: 150, h: 150 };
      const result = snapGroupToPieces(scene, groupRect, 5, ['p2', 'p3']);

      // p2 and p3 are within the group and ARE found by spatial query (p2 at x=200, p3 at x=300)
      // p2.left edge (200) snaps to p1.right edge + margin (100+50=150), but 200-150=50mm > 5mm threshold
      // Actually p1 at (100,100) is outside margin query of groupRect (97-12=85 to 97+150+12=259 in x)
      // But p2 (200,200) is at the START of groupRect and snaps to p1.right (150), moving group from x=97 to x=100
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
      expect(result.guides).toHaveLength(1);
    });

    it('snaps group to centerY within threshold', () => {
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
          p2: {
            id: 'p2',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 200, y: 200 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          p3: {
            id: 'p3',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 300, y: 300 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // p1 centerY = 125 ; group bbox centerY à 128 (écart 3 mm)
      const groupRect = { x: 200, y: 123, w: 150, h: 10 }; // centerY = 123 + 5 = 128
      const result = snapGroupToPieces(scene, groupRect, 5, ['p2', 'p3']);

      // p2 at (200,200) and p3 at (300,300) ARE found by spatial query
      // p2 centerY (225) snaps to p1 centerY (125), moving group Y from 123 to 120 (delta = 225-125 = 100, snap moves by -3mm)
      expect(result.y).toBe(120);
      expect(result.x).toBe(200);
      expect(result.guides).toHaveLength(1);
    });

    it('does not snap group when outside threshold', () => {
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
          p2: {
            id: 'p2',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 200, y: 200 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          p3: {
            id: 'p3',
            layerId: 'l1',
            materialId: 'm1',
            position: { x: 300, y: 300 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [],
      };

      // Group bbox à 10 mm de p1.left (> 5 mm threshold)
      const groupRect = { x: 90, y: 200, w: 150, h: 150 };
      const result = snapGroupToPieces(scene, groupRect, 5, ['p2', 'p3']);

      // Pas de snap
      expect(result.x).toBe(90);
      expect(result.y).toBe(200);
      expect(result.guides).toHaveLength(0);
    });
  });
});
