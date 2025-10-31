import { describe, it, expect } from 'vitest';
import { validateNoOverlap, validateInsideScene } from './index';
import type { SceneDraft, Piece } from '@/types/scene';

function mockScene(w = 600, h = 600): SceneDraft {
  return {
    id: 'test-scene',
    createdAt: new Date().toISOString(),
    size: { w, h },
    materials: {},
    layers: {},
    pieces: {},
    layerOrder: [],
  };
}

function mockPiece(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Piece {
  return {
    id,
    layerId: 'layer1',
    materialId: 'mat1',
    position: { x, y },
    rotationDeg: 0,
    scale: { x: 1, y: 1 },
    kind: 'rect',
    size: { w, h },
  };
}

describe('sceneRules', () => {
  describe('validateNoOverlap', () => {
    it('returns ok=true when no pieces overlap', () => {
      const scene = mockScene();
      scene.pieces['p1'] = mockPiece('p1', 10, 10, 50, 50);
      scene.pieces['p2'] = mockPiece('p2', 100, 100, 50, 50);

      const result = validateNoOverlap(scene);
      expect(result.ok).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('returns ok=false when pieces overlap', () => {
      const scene = mockScene();
      scene.pieces['p1'] = mockPiece('p1', 10, 10, 50, 50); // 10..60, 10..60
      scene.pieces['p2'] = mockPiece('p2', 40, 40, 50, 50); // 40..90, 40..90 → overlap

      const result = validateNoOverlap(scene);
      expect(result.ok).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual(['p1', 'p2']);
    });

    it('detects multiple conflicts', () => {
      const scene = mockScene();
      scene.pieces['p1'] = mockPiece('p1', 0, 0, 100, 100);
      scene.pieces['p2'] = mockPiece('p2', 50, 50, 100, 100);
      scene.pieces['p3'] = mockPiece('p3', 60, 60, 50, 50);

      const result = validateNoOverlap(scene);
      expect(result.ok).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(1);
    });
  });

  describe('validateInsideScene', () => {
    it('returns ok=true when all pieces inside scene', () => {
      const scene = mockScene(600, 600);
      scene.pieces['p1'] = mockPiece('p1', 10, 10, 50, 50);
      scene.pieces['p2'] = mockPiece('p2', 500, 500, 50, 50); // 500..550

      const result = validateInsideScene(scene);
      expect(result.ok).toBe(true);
      expect(result.outside).toHaveLength(0);
    });

    it('returns ok=false when piece is outside scene', () => {
      const scene = mockScene(600, 600);
      scene.pieces['p1'] = mockPiece('p1', 10, 10, 50, 50); // OK
      scene.pieces['p2'] = mockPiece('p2', 580, 10, 50, 50); // 580..630 → hors limites (>600)

      const result = validateInsideScene(scene);
      expect(result.ok).toBe(false);
      expect(result.outside).toHaveLength(1);
      expect(result.outside[0]).toBe('p2');
    });
  });
});
