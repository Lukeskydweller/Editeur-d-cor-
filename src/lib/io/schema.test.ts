import { describe, it, expect } from 'vitest';
import { isSceneFileV1, normalizeSceneFileV1, type SceneFileV1 } from './schema';

describe('isSceneFileV1', () => {
  const validFile: SceneFileV1 = {
    version: 1,
    scene: {
      id: 'scene-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      size: { w: 600, h: 600 },
      materials: {
        'mat-1': {
          id: 'mat-1',
          name: 'Material 1',
          oriented: false,
        },
      },
      layers: {
        'layer-1': {
          id: 'layer-1',
          name: 'Layer 1',
          z: 0,
          pieces: ['piece-1'],
        },
      },
      pieces: {
        'piece-1': {
          id: 'piece-1',
          layerId: 'layer-1',
          materialId: 'mat-1',
          position: { x: 10, y: 20 },
          rotationDeg: 0,
          scale: { x: 1, y: 1 },
          kind: 'rect',
          size: { w: 100, h: 50 },
        },
      },
      layerOrder: ['layer-1'],
    },
    ui: {
      snap10mm: true,
      selectedId: 'piece-1',
    },
  };

  it('returns true for valid v1 file', () => {
    expect(isSceneFileV1(validFile)).toBe(true);
  });

  it('returns false for non-object', () => {
    expect(isSceneFileV1(null)).toBe(false);
    expect(isSceneFileV1(undefined)).toBe(false);
    expect(isSceneFileV1('string')).toBe(false);
    expect(isSceneFileV1(42)).toBe(false);
  });

  it('returns false for missing version', () => {
    const invalid = { ...validFile };
    delete (invalid as any).version;
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for wrong version', () => {
    const invalid = { ...validFile, version: 2 };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for missing scene', () => {
    const invalid = { version: 1 };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for invalid scene.size', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        size: { w: '600', h: 600 }, // w is string
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for invalid material structure', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        materials: {
          'mat-1': {
            id: 'mat-1',
            // missing name
            oriented: false,
          },
        },
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for invalid layer structure', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        layers: {
          'layer-1': {
            id: 'layer-1',
            name: 'Layer 1',
            // missing z
            pieces: ['piece-1'],
          },
        },
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for invalid piece structure', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        pieces: {
          'piece-1': {
            id: 'piece-1',
            layerId: 'layer-1',
            materialId: 'mat-1',
            // missing position
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
        },
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for orphaned piece (invalid layerId)', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        pieces: {
          'piece-1': {
            ...validFile.scene.pieces['piece-1'],
            layerId: 'nonexistent-layer',
          },
        },
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for orphaned piece (invalid materialId)', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        pieces: {
          'piece-1': {
            ...validFile.scene.pieces['piece-1'],
            materialId: 'nonexistent-material',
          },
        },
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for invalid layerOrder (non-array)', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        layerOrder: 'not-an-array',
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns false for layerOrder with invalid ID', () => {
    const invalid = {
      ...validFile,
      scene: {
        ...validFile.scene,
        layerOrder: ['layer-1', 'nonexistent-layer'],
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });

  it('returns true with optional ui fields', () => {
    const withUi = {
      ...validFile,
      ui: {
        snap10mm: false,
        selectedIds: ['piece-1'],
        selectedId: 'piece-1',
        primaryId: 'piece-1',
      },
    };
    expect(isSceneFileV1(withUi)).toBe(true);
  });

  it('returns true without ui', () => {
    const withoutUi = { ...validFile };
    delete withoutUi.ui;
    expect(isSceneFileV1(withoutUi)).toBe(true);
  });

  it('returns false for invalid ui.snap10mm type', () => {
    const invalid = {
      ...validFile,
      ui: {
        snap10mm: 'true', // should be boolean
      },
    };
    expect(isSceneFileV1(invalid)).toBe(false);
  });
});

describe('normalizeSceneFileV1', () => {
  it('clamps negative dimensions to 0', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: -100, h: -50 },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(normalized.scene.size.w).toBe(0);
    expect(normalized.scene.size.h).toBe(0);
  });

  it('normalizes piece dimensions to >= 0', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: 600, h: 600 },
        materials: {
          'mat-1': { id: 'mat-1', name: 'Mat1', oriented: false },
        },
        layers: {
          'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: ['piece-1'] },
        },
        pieces: {
          'piece-1': {
            id: 'piece-1',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: -100, h: -50 },
          },
        },
        layerOrder: ['layer-1'],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(normalized.scene.pieces['piece-1'].size.w).toBe(0);
    expect(normalized.scene.pieces['piece-1'].size.h).toBe(0);
  });

  it('normalizes angles to {0, 90, 180, 270}', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: 600, h: 600 },
        materials: {
          'mat-1': { id: 'mat-1', name: 'Mat1', oriented: true, orientationDeg: 45 },
        },
        layers: {
          'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: ['piece-1', 'piece-2', 'piece-3'] },
        },
        pieces: {
          'piece-1': {
            id: 'piece-1',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 45,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
          'piece-2': {
            id: 'piece-2',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 360,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
          'piece-3': {
            id: 'piece-3',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: -90,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
        },
        layerOrder: ['layer-1'],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(normalized.scene.materials['mat-1'].orientationDeg).toBe(90); // 45 -> 90 (nearest)
    expect(normalized.scene.pieces['piece-1'].rotationDeg).toBe(90); // 45 -> 90 (nearest)
    expect(normalized.scene.pieces['piece-2'].rotationDeg).toBe(0); // 360 -> 0
    expect(normalized.scene.pieces['piece-3'].rotationDeg).toBe(270); // -90 -> 270
  });

  it('filters orphaned pieces with invalid layerId', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: 600, h: 600 },
        materials: {
          'mat-1': { id: 'mat-1', name: 'Mat1', oriented: false },
        },
        layers: {
          'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: ['piece-1', 'piece-2'] },
        },
        pieces: {
          'piece-1': {
            id: 'piece-1',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
          'piece-2': {
            id: 'piece-2',
            layerId: 'nonexistent-layer',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
        },
        layerOrder: ['layer-1'],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(Object.keys(normalized.scene.pieces)).toEqual(['piece-1']);
    expect(normalized.scene.layers['layer-1'].pieces).toEqual(['piece-1']);
  });

  it('filters orphaned pieces with invalid materialId', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: 600, h: 600 },
        materials: {
          'mat-1': { id: 'mat-1', name: 'Mat1', oriented: false },
        },
        layers: {
          'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: ['piece-1', 'piece-2'] },
        },
        pieces: {
          'piece-1': {
            id: 'piece-1',
            layerId: 'layer-1',
            materialId: 'mat-1',
            position: { x: 10, y: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
          'piece-2': {
            id: 'piece-2',
            layerId: 'layer-1',
            materialId: 'nonexistent-material',
            position: { x: 10, y: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 100, h: 50 },
          },
        },
        layerOrder: ['layer-1'],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(Object.keys(normalized.scene.pieces)).toEqual(['piece-1']);
    expect(normalized.scene.layers['layer-1'].pieces).toEqual(['piece-1']);
  });

  it('filters layerOrder to only valid IDs', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: 600, h: 600 },
        materials: {},
        layers: {
          'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: [] },
          'layer-2': { id: 'layer-2', name: 'Layer 2', z: 1, pieces: [] },
        },
        pieces: {},
        layerOrder: ['layer-1', 'nonexistent-layer', 'layer-2'],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(normalized.scene.layerOrder).toEqual(['layer-1', 'layer-2']);
  });

  it('does not mutate original file', () => {
    const file: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene-1',
        createdAt: '2025-01-01T00:00:00.000Z',
        size: { w: -100, h: 600 },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
      },
    };

    const normalized = normalizeSceneFileV1(file);
    expect(file.scene.size.w).toBe(-100); // Original unchanged
    expect(normalized.scene.size.w).toBe(0); // Normalized changed
  });
});
