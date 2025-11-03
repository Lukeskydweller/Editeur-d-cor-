import { describe, it, expect } from 'vitest';
import { validateAll } from '../../src/core/geo/validateAll';
import type { SceneV1, Piece } from '../../src/core/contracts/scene';

describe('checkMinSpacing validation', () => {
  function createScene(pieces: Piece[]): SceneV1 {
    return {
      v: 1,
      units: 'mm',
      width: 600,
      height: 600,
      layers: [{ id: 'L1', name: 'Layer 1', index: 0 }],
      materials: [{ id: 'M1', name: 'Material 1', directional: false }],
      pieces,
    };
  }

  function createPiece(id: string, x: number, y: number, w: number, h: number, joined?: boolean): Piece {
    return {
      id,
      kind: 'rect',
      x,
      y,
      w,
      h,
      rot: 0,
      layerId: 'L1',
      materialId: 'M1',
      joined,
    };
  }

  it('BLOCK if distance < 1.0mm', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20),
      createPiece('p2', 30.6, 10, 20, 20), // distance = 0.6mm < 1.0mm
    ];
    const problems = await validateAll(createScene(pieces));
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(spacingProblems.length).toBe(1);
    expect(spacingProblems[0].severity).toBe('BLOCK');
    expect(spacingProblems[0].message).toContain('Écart < 1,0 mm'); // Message updated for BLOCK
  });

  it('WARN if 1.0mm <= distance < 1.5mm', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20),
      createPiece('p2', 31.2, 10, 20, 20), // distance = 1.2mm (1.0 <= dist < 1.5)
    ];
    const problems = await validateAll(createScene(pieces));
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(spacingProblems.length).toBe(1);
    expect(spacingProblems[0].severity).toBe('WARN');
    expect(spacingProblems[0].message).toContain('Écart < 1,5 mm');
  });

  it('OK if distance >= 1.5mm', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20),
      createPiece('p2', 31.5, 10, 20, 20), // distance = 1.5mm >= 1.5mm
    ];
    const problems = await validateAll(createScene(pieces));
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(spacingProblems.length).toBe(0);
  });

  it('Ignored if one piece has joined=true', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20, true), // joined=true
      createPiece('p2', 30.6, 10, 20, 20), // distance = 0.6mm < 1.0mm
    ];
    const problems = await validateAll(createScene(pieces));
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(spacingProblems.length).toBe(0);
  });

  it('Ignored if both pieces have joined=true', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20, true), // joined=true
      createPiece('p2', 30.6, 10, 20, 20, true), // joined=true, distance = 0.6mm < 1.0mm
    ];
    const problems = await validateAll(createScene(pieces));
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(spacingProblems.length).toBe(0);
  });

  it('Non-regression: overlap still detected separately', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 20, 20),
      createPiece('p2', 15, 10, 20, 20), // overlap
    ];
    const problems = await validateAll(createScene(pieces));
    const overlapProblems = problems.filter(p => p.code === 'overlap_same_layer');
    const spacingProblems = problems.filter(p => p.code === 'spacing_too_small');

    expect(overlapProblems.length).toBeGreaterThan(0);
    // No spacing problem since overlap is handled separately
    expect(spacingProblems.length).toBe(0);
  });

  it('Non-regression: outside_scene still detected', async () => {
    const pieces = [
      createPiece('p1', 590, 10, 20, 20), // outside scene (590+20=610 > 600)
    ];
    const problems = await validateAll(createScene(pieces));
    const outsideProblems = problems.filter(p => p.code === 'outside_scene');

    expect(outsideProblems.length).toBe(1);
  });

  it('Non-regression: min_size_violation still detected', async () => {
    const pieces = [
      createPiece('p1', 10, 10, 4, 20), // width = 4mm < 5mm
    ];
    const problems = await validateAll(createScene(pieces));
    const sizeProblems = problems.filter(p => p.code === 'min_size_violation');

    expect(sizeProblems.length).toBe(1);
  });
});
