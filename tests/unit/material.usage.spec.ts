import { describe, it, expect } from 'vitest';
import { computeMaterialUsage } from '../../src/lib/materialUsage';
import type { SceneDraft } from '../../src/types/scene';
import type { Problem } from '../../src/core/contracts/scene';

describe('material usage', () => {
  it('aggregates per material, computes sheets and fill %', () => {
    const draft: SceneDraft = {
      id: 'test-scene',
      createdAt: '2025-01-01T00:00:00Z',
      size: { w: 600, h: 600 },
      materials: {
        m1: { id: 'm1', name: 'Chêne' },
        m2: { id: 'm2', name: 'Noyer' },
      },
      layers: {
        L1: { id: 'L1', name: 'Layer 1', z: 0, pieces: ['p1', 'p2', 'p3'] },
      },
      pieces: {
        p1: {
          id: 'p1',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm1',
          position: { x: 0, y: 0 },
          size: { w: 300, h: 300 }, // 90,000 mm²
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
        p2: {
          id: 'p2',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm1',
          position: { x: 0, y: 0 },
          size: { w: 200, h: 200 }, // 40,000 mm²
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
        p3: {
          id: 'p3',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm2',
          position: { x: 0, y: 0 },
          size: { w: 600, h: 300 }, // 180,000 mm²
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
      },
      layerOrder: ['L1'],
    };

    const problems: Problem[] = [];
    const usage = computeMaterialUsage(draft, problems);

    const m1 = usage.find((x) => x.materialId === 'm1')!;
    const m2 = usage.find((x) => x.materialId === 'm2')!;

    expect(m1).toBeDefined();
    expect(m1.sheets).toBe(1);
    expect(m1.piecesCount).toBe(2);
    // Total area: 90,000 + 40,000 = 130,000 mm²
    // Sheet area: 600 * 600 = 360,000 mm²
    // Fill %: (130,000 / 360,000) * 100 = 36.1%
    expect(m1.fillLastPct).toBeCloseTo(36.1, 1);

    expect(m2).toBeDefined();
    expect(m2.sheets).toBe(1);
    expect(m2.piecesCount).toBe(1);
    // Total area: 180,000 mm²
    // Fill %: (180,000 / 360,000) * 100 = 50.0%
    expect(m2.fillLastPct).toBeCloseTo(50.0, 1);
  });

  it('orientation WARN does not affect aggregation, but is displayed', () => {
    const draft: SceneDraft = {
      id: 'test-scene',
      createdAt: '2025-01-01T00:00:00Z',
      size: { w: 600, h: 600 },
      materials: {
        m1: { id: 'm1', name: 'Chêne', oriented: true, orientationDeg: 0 },
      },
      layers: {
        L1: { id: 'L1', name: 'Layer 1', z: 0, pieces: ['p1'] },
      },
      pieces: {
        p1: {
          id: 'p1',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm1',
          position: { x: 0, y: 0 },
          size: { w: 100, h: 100 },
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
      },
      layerOrder: ['L1'],
    };

    const problems: Problem[] = [
      {
        code: 'material_orientation_mismatch',
        severity: 'WARN',
        pieceId: 'p1',
        message: 'Orientation mismatch',
      },
    ];

    const usage = computeMaterialUsage(draft, problems);
    const m1 = usage[0];

    expect(m1.warnOrientationCount).toBe(1);
    expect(m1.sheets).toBe(1);
    expect(m1.totalAreaMm2).toBe(10000); // 100*100
  });

  it('handles multiple sheets correctly', () => {
    const draft: SceneDraft = {
      id: 'test-scene',
      createdAt: '2025-01-01T00:00:00Z',
      size: { w: 600, h: 600 },
      materials: {
        m1: { id: 'm1', name: 'Chêne' },
      },
      layers: {
        L1: { id: 'L1', name: 'Layer 1', z: 0, pieces: ['p1', 'p2'] },
      },
      pieces: {
        // Two pieces that total > 360,000 mm² (one sheet)
        p1: {
          id: 'p1',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm1',
          position: { x: 0, y: 0 },
          size: { w: 600, h: 400 }, // 240,000 mm²
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
        p2: {
          id: 'p2',
          kind: 'rect',
          layerId: 'L1',
          materialId: 'm1',
          position: { x: 0, y: 0 },
          size: { w: 600, h: 300 }, // 180,000 mm²
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
        },
      },
      layerOrder: ['L1'],
    };

    const problems: Problem[] = [];
    const usage = computeMaterialUsage(draft, problems);
    const m1 = usage[0];

    // Total: 240,000 + 180,000 = 420,000 mm²
    // Sheets: ceil(420,000 / 360,000) = 2
    expect(m1.sheets).toBe(2);

    // Fill on last sheet: 420,000 - 360,000 = 60,000 mm²
    // Fill %: (60,000 / 360,000) * 100 = 16.7%
    expect(m1.fillLastPct).toBeCloseTo(16.7, 1);
  });

  it('handles empty scene', () => {
    const draft: SceneDraft = {
      id: 'test-scene',
      createdAt: '2025-01-01T00:00:00Z',
      size: { w: 600, h: 600 },
      materials: {
        m1: { id: 'm1', name: 'Chêne' },
      },
      layers: {
        L1: { id: 'L1', name: 'Layer 1', z: 0, pieces: [] },
      },
      pieces: {},
      layerOrder: ['L1'],
    };

    const problems: Problem[] = [];
    const usage = computeMaterialUsage(draft, problems);

    expect(usage).toHaveLength(0);
  });
});
