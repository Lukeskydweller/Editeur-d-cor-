import { describe, it, expect } from 'vitest';
import { snapEdgeCollage } from '@/lib/ui/snap';
import type { SceneDraft, Piece } from '@/types/scene';

describe('snapEdgeCollage - collage automatique bord-à-bord < 1,0mm', () => {
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

  it('colle à droite si gap horizontal < 1,0mm', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Candidate à 0,4mm de p1 (gap = 0,4mm < 1,0mm)
    const candidate = { x: 150.4, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé à p1.right (gap=0)
  });

  it('colle à gauche si gap horizontal < 1,0mm', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Candidate à gauche, gap = 0,3mm
    const candidate = { x: 49.7, y: 10, w: 50, h: 50 }; // right = 99.7, gap à p1.left = 0,3mm
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(50.0, 1); // Collé, candidate.right = 100
  });

  it('colle en bas si gap vertical < 1,0mm', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 10, 100, 50, 50), // y: 100..150
    });

    // Candidate en-dessous, gap = 0,2mm
    const candidate = { x: 10, y: 150.2, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(true);
    expect(result.y).toBeCloseTo(150.0, 1); // Collé à p1.bottom
  });

  it('colle en haut si gap vertical < 1,0mm', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 10, 100, 50, 50), // y: 100..150
    });

    // Candidate au-dessus, gap = 0,45mm
    const candidate = { x: 10, y: 49.55, w: 50, h: 50 }; // bottom = 99.55, gap = 0,45mm
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(true);
    expect(result.y).toBeCloseTo(50.0, 1); // Collé, candidate.bottom = 100
  });

  it('ne colle pas si gap >= 1,0mm', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
    });

    // Gap = 1,5mm (>= 1,0mm)
    const candidate = { x: 151.5, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(false);
    expect(result.x).toBe(151.5); // Position inchangée
    expect(result.y).toBe(10);
  });

  it('ne colle pas si pas de voisin proche', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 300, 300, 50, 50), // Loin
    });

    const candidate = { x: 10, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, []);

    expect(result.snapped).toBe(false);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
  });

  it('exclut les IDs fournis (ne colle pas à soi-même ou au groupe)', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
      p2: mockPiece('p2', 150.3, 10, 50, 50), // Gap 0,3mm avec p1
    });

    // Candidate = p2, exclure p2 lui-même
    const candidate = { x: 150.3, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, ['p2']);

    // Devrait coller à p1, pas à p2 (exclu)
    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1);
  });

  it('colle au gap le plus petit si plusieurs voisins proches', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // right = 150
      p2: mockPiece('p2', 10, 50, 50, 50),  // bottom = 100
    });

    // Candidate proche de p1 (gap=0,2mm) et p2 (gap=0,4mm)
    const candidate = { x: 150.2, y: 50, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, []);

    // Colle à p1 (gap plus petit)
    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1);
  });

  it('groupe : colle le bbox groupe si gap < 1,0mm', () => {
    const scene = mockScene({
      neighbor: mockPiece('neighbor', 200, 10, 50, 50), // x: 200..250
    });

    // Groupe à 0,3mm du neighbor (bbox groupe : x=149.7..199.7, gap=0,3mm)
    const groupBBox = { x: 149.7, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(groupBBox, scene, ['g1', 'g2']); // Exclure membres groupe

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé, groupBBox.right = 200
  });
});

describe('snapEdgeCollage - directionnalité (avec prevGap)', () => {
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

  it('colle si on s approche (gap_new < prevGap)', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
    });

    // Avant : gap=1.0mm ; Après : gap=0.3mm → on s'approche
    const candidate = { x: 150.3, y: 10, w: 50, h: 50 };
    const prevGap = 1.0; // 1mm
    const result = snapEdgeCollage(candidate, scene, [], 0.5, prevGap);

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1); // Collé
  });

  it('ne colle pas si on s eloigne (gap_new >= prevGap)', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
    });

    // Avant : gap=0.2mm ; Après : gap=0.4mm → on s'éloigne
    const candidate = { x: 150.4, y: 10, w: 50, h: 50 };
    const prevGap = 0.2; // 0.2mm
    const result = snapEdgeCollage(candidate, scene, [], 0.5, prevGap);

    expect(result.snapped).toBe(false);
    expect(result.x).toBe(150.4); // Position inchangée
  });

  it('colle même sans prevGap (rétrocompatibilité)', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50),
    });

    const candidate = { x: 150.3, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], 0.5); // pas de prevGap

    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(150.0, 1);
  });

  it('ne colle pas si collage créerait overlap avec autre voisin', () => {
    const scene = mockScene({
      p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
      p2: mockPiece('p2', 150, 10, 50, 50), // x: 150..200 (déjà collé à p1)
    });

    // Candidate à 0.3mm de p1, mais coller le ferait chevaucher p2
    const candidate = { x: 149.7, y: 10, w: 50, h: 50 };
    const result = snapEdgeCollage(candidate, scene, [], 0.5);

    expect(result.snapped).toBe(false); // Pas de collage (overlap détecté)
    expect(result.x).toBe(149.7);
  });
});
