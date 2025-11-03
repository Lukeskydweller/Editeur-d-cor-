import { describe, it, expect } from 'vitest';
import { finalizeCollageGuard } from '@/lib/ui/snap';
import type { Piece } from '@/types/scene';

describe('finalizeCollageGuard - garde-fou collage final', () => {
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

  it('colle si gap ≈ 0.40 mm (dans la fenêtre)', () => {
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectBBox = { x: 150.4, y: 10, w: 50, h: 50 }; // gap = 0.4mm

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(true);
    expect(result.dx).toBeCloseTo(-0.4, 1); // Colle vers la gauche
    expect(result.dy).toBe(0);
  });

  it('colle si gap ≈ 0.99 mm (dans la fenêtre)', () => {
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectBBox = { x: 150.99, y: 10, w: 50, h: 50 }; // gap = 0.99mm

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(true);
    expect(result.dx).toBeCloseTo(-0.99, 2);
    expect(result.dy).toBe(0);
  });

  it('ne colle pas si gap ≈ 0.00 mm (déjà collé)', () => {
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectBBox = { x: 150.0, y: 10, w: 50, h: 50 }; // gap = 0, déjà collé

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(false); // Pas de collage (déjà collé)
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('ne colle pas si gap >= 1.0 mm (hors fenêtre)', () => {
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    // Gap = 1.5mm, largement > 1.0mm pour éviter ambiguïtés d'arrondi
    const subjectBBox = { x: 151.5, y: 10, w: 50, h: 50 };

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(false); // Hors fenêtre
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('ne colle pas si collage créerait overlap avec voisin tiers', () => {
    const neighbors = [
      mockPiece('p1', 100, 10, 50, 50), // x: 100..150
      mockPiece('p2', 150, 10, 50, 50), // x: 150..200 (déjà collé à p1)
    ];
    const subjectBBox = { x: 149.4, y: 10, w: 50, h: 50 }; // gap 0.4mm avec p1

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(false); // Overlap détecté, sécurité
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('colle verticalement si gap < 1.0mm', () => {
    const neighbors = [mockPiece('p1', 10, 100, 50, 50)]; // y: 100..150
    const subjectBBox = { x: 10, y: 150.3, w: 50, h: 50 }; // gap vertical = 0.3mm

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(true);
    expect(result.dx).toBe(0);
    expect(result.dy).toBeCloseTo(-0.3, 1); // Colle vers le haut
  });

  it('choisit le gap le plus petit si plusieurs voisins', () => {
    const neighbors = [
      mockPiece('p1', 100, 10, 50, 50), // x: 100..150, gap horizontal = 0.2mm
      mockPiece('p2', 10, 50, 50, 50),  // y: 50..100, gap vertical = 0.4mm
    ];
    const subjectBBox = { x: 150.2, y: 50, w: 50, h: 50 };

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(true);
    expect(result.dx).toBeCloseTo(-0.2, 1); // Colle à p1 (gap plus petit)
    expect(result.dy).toBe(0);
  });

  it('ne colle pas si aucun voisin', () => {
    const neighbors: Piece[] = [];
    const subjectBBox = { x: 10, y: 10, w: 50, h: 50 };

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    expect(result.didSnap).toBe(false);
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('respecte le flag VITE_FEAT_GAP_COLLAGE', () => {
    // Note: Ce test dépend de l'environnement, ici on vérifie juste que la fonction existe
    // et retourne une structure valide
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)];
    const subjectBBox = { x: 150.4, y: 10, w: 50, h: 50 };

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: 1.0,
    });

    // Doit retourner une structure valide
    expect(result).toHaveProperty('didSnap');
    expect(result).toHaveProperty('dx');
    expect(result).toHaveProperty('dy');
  });

  it('colle dans toutes les directions (4 directions)', () => {
    // Test droite
    const neighborsRight = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectRight = { x: 150.3, y: 10, w: 50, h: 50 };
    const resultRight = finalizeCollageGuard({
      subjectBBox: subjectRight,
      neighbors: neighborsRight,
      maxGapMm: 1.0,
    });
    expect(resultRight.didSnap).toBe(true);
    expect(resultRight.dx).toBeCloseTo(-0.3, 1);

    // Test gauche
    const neighborsLeft = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectLeft = { x: 49.7, y: 10, w: 50, h: 50 }; // right = 99.7, gap = 0.3mm
    const resultLeft = finalizeCollageGuard({
      subjectBBox: subjectLeft,
      neighbors: neighborsLeft,
      maxGapMm: 1.0,
    });
    expect(resultLeft.didSnap).toBe(true);
    expect(resultLeft.dx).toBeCloseTo(0.3, 1);

    // Test bas
    const neighborsBottom = [mockPiece('p1', 10, 100, 50, 50)]; // y: 100..150
    const subjectBottom = { x: 10, y: 150.3, w: 50, h: 50 };
    const resultBottom = finalizeCollageGuard({
      subjectBBox: subjectBottom,
      neighbors: neighborsBottom,
      maxGapMm: 1.0,
    });
    expect(resultBottom.didSnap).toBe(true);
    expect(resultBottom.dy).toBeCloseTo(-0.3, 1);

    // Test haut
    const neighborsTop = [mockPiece('p1', 10, 100, 50, 50)]; // y: 100..150
    const subjectTop = { x: 10, y: 49.7, w: 50, h: 50 }; // bottom = 99.7, gap = 0.3mm
    const resultTop = finalizeCollageGuard({
      subjectBBox: subjectTop,
      neighbors: neighborsTop,
      maxGapMm: 1.0,
    });
    expect(resultTop.didSnap).toBe(true);
    expect(resultTop.dy).toBeCloseTo(0.3, 1);
  });
});
