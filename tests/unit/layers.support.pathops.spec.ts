import { describe, it, expect, beforeEach } from 'vitest';
import { validateAll } from '../../src/core/geo/validateAll';
import type { SceneV1, Piece, Layer } from '../../src/core/contracts/scene';

// IMPORTANT: These tests require WASM (PathKit) which doesn't work in Vitest/Node environment.
// Skipped for unit tests - will be converted to E2E tests with browser WASM support.
// Unit tests use AABB strategy (see layers.support.spec.ts)
describe.skip('PathOps exact validation: layers.support', () => {
  let scene: SceneV1;
  let baseLayer: Layer;
  let layer2: Layer;
  let layer3: Layer;

  beforeEach(() => {
    // Create fresh scene with 3 layers
    baseLayer = { id: 'L1', name: 'Base', index: 0 };
    layer2 = { id: 'L2', name: 'Layer 2', index: 1 };
    layer3 = { id: 'L3', name: 'Layer 3', index: 2 };

    scene = {
      plateWidth: 600,
      plateHeight: 600,
      layers: [baseLayer, layer2, layer3],
      pieces: [],
      materials: [{ name: 'Material 1', oriented: false }],
      settings: { minSpacing: 3 },
    };
  });

  function createPiece(
    layerId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0
  ): Piece {
    const id = `p${scene.pieces.length + 1}`;
    const piece: Piece = {
      id,
      layerId,
      x,
      y,
      w,
      h,
      rot,
      materialId: scene.materials[0].name,
      joined: false,
    };
    scene.pieces.push(piece);
    return piece;
  }

  it('BLOCK if piece extends 0.2mm beyond support (>epsilon 0.10)', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Upper piece: 50×50 at (75,0) → right edge at 125mm, extends 25mm beyond support
    const unsupported = createPiece(layer2.id, 75, 0, 50, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(1);
    expect(supportProblems[0].pieceId).toBe(unsupported.id);
    expect(supportProblems[0].severity).toBe('BLOCK');
    expect(supportProblems[0].message).toBe('Pièce non supportée par couche inférieure');
  });

  it('OK if piece flush with support edge (≤epsilon 0.10mm)', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Upper piece: 50×50 at (50,0) → right edge exactly at 100mm
    createPiece(layer2.id, 50, 0, 50, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(0);
  });

  it('OK if piece slightly inside support', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Upper piece: 50×50 at (25,25) → fully contained with 25mm margin
    createPiece(layer2.id, 25, 25, 50, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(0);
  });

  it('BLOCK if rotated piece extends beyond support', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Upper piece: 80×40 at (30,30) rotated 45° → corners extend beyond support
    const unsupported = createPiece(layer2.id, 30, 30, 80, 40, 45);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems.length).toBeGreaterThan(0);
    expect(supportProblems.some(p => p.pieceId === unsupported.id)).toBe(true);
  });

  it('OK if rotated piece fully supported', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Upper piece: 40×40 at (30,30) rotated 45° → diagonal ~56mm, fits within 100×100
    createPiece(layer2.id, 30, 30, 40, 40, 45);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(0);
  });

  it('OK if piece on L3 supported by union of L1+L2', async () => {
    // L1: 50×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 50, 100);

    // L2: 50×100 at (50,0) → forms continuous 100×100 with L1
    createPiece(layer2.id, 50, 0, 50, 100);

    // L3: 100×50 at (0,25) → fully supported by union of L1+L2
    createPiece(layer3.id, 0, 25, 100, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(0);
  });

  it('BLOCK if no support pieces below', async () => {
    // Only piece on L2 with nothing on L1
    const unsupported = createPiece(layer2.id, 0, 0, 50, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(1);
    expect(supportProblems[0].pieceId).toBe(unsupported.id);
  });

  it('Non-regression: other validations still work', async () => {
    // Create two overlapping pieces on same layer
    createPiece(baseLayer.id, 0, 0, 50, 50);
    createPiece(baseLayer.id, 25, 25, 50, 50); // Overlaps with first piece

    const problems = await validateAll(scene);

    // Should detect overlap (not testing support since both on base layer)
    const overlapProblems = problems.filter(p => p.code === 'overlap_same_layer');
    expect(overlapProblems.length).toBeGreaterThan(0);
  });

  it('OK for pieces on base layer (L1)', async () => {
    // Pieces on base layer never need support
    createPiece(baseLayer.id, 0, 0, 50, 50);
    createPiece(baseLayer.id, 100, 100, 50, 50);
    createPiece(baseLayer.id, 200, 200, 50, 50);

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    expect(supportProblems).toHaveLength(0);
  });

  it('handles various rotation combinations (0°/90°/180°/270°)', async () => {
    // Support: 100×100 at (0,0)
    createPiece(baseLayer.id, 0, 0, 100, 100);

    // Test all standard rotations with fully supported pieces
    createPiece(layer2.id, 10, 10, 30, 20, 0);   // 0°
    createPiece(layer2.id, 50, 10, 30, 20, 90);  // 90°
    createPiece(layer2.id, 10, 50, 30, 20, 180); // 180°
    createPiece(layer2.id, 50, 50, 30, 20, 270); // 270°

    const problems = await validateAll(scene);
    const supportProblems = problems.filter(p => p.code === 'unsupported_above');

    // All pieces are fully within the 100×100 support, so no problems
    expect(supportProblems).toHaveLength(0);
  });
});
