import { describe, it, expect } from 'vitest';
import { validateAll } from '../../src/core/geo/validateAll';
import type { SceneV1, Piece, Layer } from '../../src/core/contracts/scene';

// Unit tests: AABB strategy (forced in setupTests.ts)
// E2E tests: PathOps exact validation (see layers.support.pathops.spec.ts)
describe('checkLayerSupport validation (AABB)', () => {
  function createScene(layers: Layer[], pieces: Piece[]): SceneV1 {
    return {
      v: 1,
      units: 'mm',
      width: 600,
      height: 600,
      layers,
      materials: [{ id: 'M1', name: 'Material 1', directional: false }],
      pieces,
    };
  }

  function createPiece(
    id: string,
    layerId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot?: 0 | 90 | 180 | 270
  ): Piece {
    return {
      id,
      kind: 'rect',
      x,
      y,
      w,
      h,
      rot: rot ?? 0,
      layerId,
      materialId: 'M1',
    };
  }

  it('BLOCK if piece on layer 2 extends beyond union of layer 1', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
    ];

    // Layer 1: Support piece at (100, 100) with size 100×100
    // Layer 2: Piece at (150, 100) with size 100×100 → extends beyond support
    const pieces = [
      createPiece('support', 'L1', 100, 100, 100, 100),
      createPiece('unsupported', 'L2', 150, 100, 100, 100), // Only 50mm overlap, 50mm extends beyond
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(1);
    expect(supportProblems[0].severity).toBe('BLOCK');
    expect(supportProblems[0].pieceId).toBe('unsupported');
    expect(supportProblems[0].message).toContain('non supportée par couche inférieure');
  });

  it('OK if piece on layer 2 is fully contained within union of layer 1', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
    ];

    // Layer 1: Support piece at (100, 100) with size 200×100
    // Layer 2: Piece at (150, 110) with size 80×80 → fully inside support
    const pieces = [
      createPiece('support', 'L1', 100, 100, 200, 100),
      createPiece('supported', 'L2', 150, 110, 80, 80),
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(0);
  });

  it('OK for pieces on base layer (no support check)', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
    ];

    // Single piece on base layer → no support check required
    const pieces = [
      createPiece('base', 'L1', 100, 100, 100, 100),
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(0);
  });

  it('Non-regression: overlap_same_layer and spacing_too_small still detected', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
    ];

    const pieces = [
      // Layer 1: Two overlapping pieces
      createPiece('p1', 'L1', 10, 10, 20, 20),
      createPiece('p2', 'L1', 15, 10, 20, 20), // overlap with p1
      // Layer 2: Piece with insufficient spacing
      createPiece('p3', 'L2', 50, 10, 20, 20),
      createPiece('p4', 'L2', 70.3, 10, 20, 20), // spacing 0.3mm < 0.5mm
    ];

    const problems = await validateAll(createScene(layers, pieces));

    const overlapProblems = problems.filter(p => p.code === 'overlap_same_layer');
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    // Should still detect overlap and spacing issues
    expect(overlapProblems.length).toBeGreaterThan(0);
    expect(spacingProblems.length).toBeGreaterThan(0);
  });

  it('BLOCK if no support pieces exist below', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
    ];

    // Layer 1: Empty (no support pieces)
    // Layer 2: One piece with no support below
    const pieces = [
      createPiece('unsupported', 'L2', 100, 100, 100, 100),
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(1);
    expect(supportProblems[0].severity).toBe('BLOCK');
    expect(supportProblems[0].pieceId).toBe('unsupported');
  });

  it('OK if piece on layer 3 is supported by union of layers 1 and 2', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
      { id: 'L3', name: 'Layer 3', index: 2 },
    ];

    // Layer 1: Wide base support (0-200)
    // Layer 2: Narrower piece (90-190) fully contained in L1
    // Layer 3: Bridge piece (10-180) spanning and supported by union of L1+L2
    const pieces = [
      createPiece('support1', 'L1', 0, 100, 200, 100),  // x=0-200, base support
      createPiece('support2', 'L2', 90, 110, 100, 80),  // x=90-190, y=110-190, contained in L1
      createPiece('bridge', 'L3', 10, 120, 170, 60),    // x=10-180, y=120-180, supported by union
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(0);
  });

  it('Handles rotated pieces correctly', async () => {
    const layers: Layer[] = [
      { id: 'L1', name: 'Layer 1', index: 0 },
      { id: 'L2', name: 'Layer 2', index: 1 },
    ];

    // Layer 1: Large support 170×170 at (80, 80) → covers x=80-250, y=80-250
    // Layer 2: Rotated rectangle 120×60 at 90° → AABB becomes 60×120
    // Piece at (120, 120) with center at (180, 150)
    // After rotation, AABB is centered at (180, 150): x=150, y=90, w=60, h=120
    // AABB ends at x=210, y=210 (fully within support x=80-250, y=80-250)
    const pieces = [
      createPiece('support', 'L1', 80, 80, 170, 170),
      createPiece('rotated', 'L2', 120, 120, 120, 60, 90), // Rotated 90°
    ];

    const problems = await validateAll(createScene(layers, pieces));
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBe(0);
  });
});
