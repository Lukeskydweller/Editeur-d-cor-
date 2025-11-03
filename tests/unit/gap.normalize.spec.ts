import { describe, it, expect } from 'vitest';
import { normalizeGapToThreshold } from '@/lib/ui/snap';
import type { Piece } from '@/types/scene';
import type { AABB as BBox } from '@/lib/geom/aabb';

describe('Gap Normalization - normalizeGapToThreshold', () => {
  function mockPiece(id: string, x: number, y: number, w: number, h: number): Piece {
    return {
      id,
      layerId: 'L1',
      materialId: 'M1',
      position: { x, y },
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
      kind: 'rect',
      size: { w, h },
    };
  }

  const sceneBounds = { w: 600, h: 600 };
  const targetMm = 1.0;
  const epsilonMm = 0.12;

  describe('Cas normalisable: gap ∈ [1.00, 1.12]', () => {
    it('gap = 1.00mm → pas de normalisation (déjà exact)', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 151, 100, 50, 50)]; // 151..201, gap = 1.00mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      // Déjà exact, pas de micro-delta
      expect(result.didNormalize).toBe(false);
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });

    it('gap = 1.06mm (droite) → normalize à 1.00mm', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 151.06, 100, 50, 50)]; // 151.06..201.06, gap = 1.06mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBeCloseTo(0.06, 5); // Rapprocher de 0.06mm vers la droite
      expect(result.dy).toBe(0);
    });

    it('gap = 1.10mm (gauche) → normalize à 1.00mm', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 48.9, 100, 50, 50)]; // 48.9..98.9, gap = 1.10mm (à gauche)

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBeCloseTo(-0.10, 5); // Éloigner de 0.10mm vers la gauche
      expect(result.dy).toBe(0);
    });

    it('gap = 1.05mm (haut) → normalize à 1.00mm', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // y: 100..150
      const neighbors = [mockPiece('n1', 100, 48.95, 50, 50)]; // y: 48.95..98.95, gap = 1.05mm (en haut)

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBe(0);
      expect(result.dy).toBeCloseTo(-0.05, 5); // Éloigner de 0.05mm vers le haut
    });

    it('gap = 1.08mm (bas) → normalize à 1.00mm', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // y: 100..150
      const neighbors = [mockPiece('n1', 100, 151.08, 50, 50)]; // y: 151.08..201.08, gap = 1.08mm (en bas)

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBe(0);
      expect(result.dy).toBeCloseTo(0.08, 5); // Rapprocher de 0.08mm vers le bas
    });

    it('gap = 1.11mm (proche seuil max) → normalize à 1.00mm', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 151.11, 100, 50, 50)]; // 151.11..201.11, gap = 1.11mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBeCloseTo(0.11, 5);
      expect(result.dy).toBe(0);
    });
  });

  describe('Cas non-normalisable: gap hors fenêtre', () => {
    it('gap = 0.90mm (< 1.0mm) → pas de normalisation', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 150.9, 100, 50, 50)]; // 150.9..200.9, gap = 0.9mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(false);
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });

    it('gap = 1.13mm (> 1.12mm) → pas de normalisation', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 151.13, 100, 50, 50)]; // 151.13..201.13, gap = 1.13mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(false);
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });

    it('gap = 5.0mm (normal gap) → pas de normalisation', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [mockPiece('n1', 155, 100, 50, 50)]; // 155..205, gap = 5.0mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(false);
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });
  });

  describe('Guards: overlap et scene bounds', () => {
    it('normalisation créerait overlap → refusée', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      // Neighbor right à 151.06mm, mais un autre obstacle empêche le mouvement
      const neighbors = [
        mockPiece('n1', 151.06, 100, 50, 50), // 151.06..201.06, gap = 1.06mm (target)
        mockPiece('n2', 150.05, 100, 50, 50), // Obstacle plus proche → overlap si on bouge
      ];

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      // Devrait refuser à cause de l'overlap avec n2
      expect(result.didNormalize).toBe(false);
    });

    it('normalisation sortirait de scène (droite) → refusée', () => {
      // Subject près du bord droit, normalization le pousserait hors scène
      const subjectBBox: BBox = { x: 548, y: 100, w: 50, h: 50 }; // 548..598
      // Neighbor à droite, gap = 1.06mm
      const neighbors = [mockPiece('n1', 599.06, 100, 50, 50)]; // 599.06..649.06, gap = 1.06mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds: { w: 600, h: 600 },
      });

      // Normalisation voudrait déplacer subject de +0.06 vers droite
      // → x = 548.06, x+w = 548.06+50 = 598.06 (OK, dans scène)
      // Donc cette normalisation devrait réussir. Changeons le test.

      // Vraiment au bord: x=549.95
      const subjectAtEdge: BBox = { x: 549.95, y: 100, w: 50, h: 50 }; // 549.95..599.95
      const neighborsAtEdge = [mockPiece('n1', 601.01, 100, 50, 50)]; // gap = 1.06mm

      const resultAtEdge = normalizeGapToThreshold({
        subjectBBox: subjectAtEdge,
        neighbors: neighborsAtEdge,
        targetMm,
        epsilonMm,
        sceneBounds: { w: 600, h: 600 },
      });

      // Normalisation voudrait déplacer de +0.06 → x = 550.01, x+w = 600.01 > 600 → refusé
      expect(resultAtEdge.didNormalize).toBe(false);
    });

    it('normalisation sortirait de scène (gauche) → refusée', () => {
      // Subject très près du bord gauche
      const subjectBBox: BBox = { x: 0.05, y: 100, w: 50, h: 50 }; // 0.05..50.05
      // Neighbor à gauche (partiellement hors scène), gap = 1.06mm
      const neighbors = [mockPiece('n1', -51.01, 100, 50, 50)]; // -51.01..-1.01, gap = 1.06mm

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      // Normalisation voudrait déplacer subject de -0.06 → x = -0.01 < 0 → refusé
      expect(result.didNormalize).toBe(false);
    });
  });

  describe('Cas limites', () => {
    it('aucun voisin → pas de normalisation', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 };
      const neighbors: Piece[] = [];

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      expect(result.didNormalize).toBe(false);
      expect(result.dx).toBe(0);
      expect(result.dy).toBe(0);
    });

    it('plusieurs voisins, seul le plus proche compte', () => {
      const subjectBBox: BBox = { x: 100, y: 100, w: 50, h: 50 }; // 100..150
      const neighbors = [
        mockPiece('n1', 151.06, 100, 50, 50), // 151.06..201.06, gap = 1.06mm (plus proche, droite)
        mockPiece('n2', 170, 100, 50, 50),    // 170..220, gap = 20mm (plus loin)
        mockPiece('n3', 100, 155, 50, 50),    // gap = 5mm (bas)
      ];

      const result = normalizeGapToThreshold({
        subjectBBox,
        neighbors,
        targetMm,
        epsilonMm,
        sceneBounds,
      });

      // Devrait normaliser vers n1 (gap 1.06mm, le plus proche dans la fenêtre)
      expect(result.didNormalize).toBe(true);
      expect(result.dx).toBeCloseTo(0.06, 5);
      expect(result.dy).toBe(0);
    });
  });
});
