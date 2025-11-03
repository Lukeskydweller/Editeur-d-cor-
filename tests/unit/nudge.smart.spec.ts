import { describe, it, expect } from 'vitest';
import { snapEdgeCollage, finalizeCollageGuard } from '@/lib/ui/snap';
import type { SceneDraft, Piece } from '@/types/scene';
import { MIN_GAP_MM } from '@/constants/validation';

describe('Nudge clavier — comportement collage strict (1.0mm)', () => {
  function mockScene(pieces: Record<string, Piece>): SceneDraft {
    return {
      id: 'test',
      createdAt: new Date().toISOString(),
      size: { w: 600, h: 600 },
      materials: {},
      layers: {},
      pieces,
      layerOrder: [],
    };
  }

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

  it('Pas de saut anticipé si gap ≈ 3mm (> MIN_GAP_MM)', () => {
    // Règle produit : pas de smart nudge avant le seuil de 1.0mm
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Candidate à 3mm de p1 (gap = 3mm > 1.0mm)
    const candidate = { x: 153, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM);

    // Pas de collage : position inchangée
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(153);
  });

  it('Collage par snapEdgeCollage si gap < 1.0mm après pas clavier', () => {
    // Si le pas clavier amène à gap < 1.0mm, snapEdgeCollage colle
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Candidate à 0.7mm de p1 (gap = 0.7mm < 1.0mm)
    const candidate = { x: 150.7, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé à p1.right (gap=0)
  });

  it('Garde-fou finalise le collage si gap ≈ 0.9mm (dans fenêtre)', () => {
    // Si snapEdgeCollage ne colle pas, le garde-fou finalizeCollageGuard force le collage
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)]; // x: 100..150
    const subjectBBox = { x: 150.9, y: 10, w: 50, h: 50 }; // gap = 0.9mm < 1.0mm

    const result = finalizeCollageGuard({
      subjectBBox,
      neighbors,
      maxGapMm: MIN_GAP_MM,
    });

    expect(result.didSnap).toBe(true);
    expect(result.dx).toBeCloseTo(-0.9, 1); // Colle vers la gauche
  });

  it('Pas de collage si gap >= 1.0mm (hors fenêtre)', () => {
    // Au-delà de 1.0mm, ni snapEdgeCollage ni finalizeCollageGuard ne collent
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
    });

    // Gap = 1.5mm (>= 1.0mm)
    const candidate = { x: 151.5, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM);

    expect(result.snapped).toBe(false);
    expect(result.x).toBe(151.5);

    // Garde-fou ne colle pas non plus
    const neighbors = [mockPiece('p1', 100, 10, 50, 50)];
    const guardResult = finalizeCollageGuard({
      subjectBBox: candidate,
      neighbors,
      maxGapMm: MIN_GAP_MM,
    });

    expect(guardResult.didSnap).toBe(false);
    expect(guardResult.dx).toBe(0);
  });

  it('Collage bloqué si overlap avec voisin tiers', () => {
    // Sécurité : si coller créerait un overlap, on ne colle pas
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
      p2: mockPiece('p2', 150, 10, 50, 50), // x: 150..200 (déjà collé à p1)
    });

    // Candidate à 0.3mm de p1, mais coller le ferait chevaucher p2
    const candidate = { x: 149.7, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM);

    expect(result.snapped).toBe(false); // Pas de collage (overlap détecté)
    expect(result.x).toBe(149.7);
  });

  it('Groupe : collage si gap bbox < 1.0mm', () => {
    // Le collage fonctionne aussi pour les groupes (bbox)
    const scene = mockScene({
      neighbor: mockPiece('neighbor', 200, 10, 50, 50), // x: 200..250
    });

    // Groupe à 0.5mm du neighbor (bbox groupe : x=149.5..199.5, gap=0.5mm)
    const groupBBox = { x: 149.5, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(groupBBox, scene, ['g1', 'g2'], MIN_GAP_MM);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé, groupBBox.right = 200
  });

  it('Directionnalité : colle si on s approche (gap_new < prevGap)', () => {
    // snapEdgeCollage respecte la directionnalité
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Avant : gap=2.0mm ; Après : gap=0.8mm → on s'approche
    const candidate = { x: 150.8, y: 10, w: 50, h: 50 };
    const prevGap = 2.0; // 2mm
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM, prevGap);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé
  });

  it('Directionnalité : ne colle pas si on s éloigne (gap_new >= prevGap)', () => {
    // Si on s'éloigne, pas de collage
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
    });

    // Avant : gap=0.5mm ; Après : gap=0.8mm → on s'éloigne
    const candidate = { x: 150.8, y: 10, w: 50, h: 50 };
    const prevGap = 0.5; // 0.5mm
    const result = snapEdgeCollage(candidate, scene, [], MIN_GAP_MM, prevGap);

    expect(result.snapped).toBe(false);
    expect(result.x).toBe(150.8); // Position inchangée
  });
});
