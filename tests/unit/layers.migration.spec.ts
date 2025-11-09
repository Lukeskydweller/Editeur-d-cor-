import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import type { SceneFileV1 } from '@/lib/io/schema';
import type { ID } from '@/types/scene';

/**
 * Test suite: Layer migration (C4+ → C3 clamp)
 *
 * Verifies that:
 * - Legacy scenes (>3 layers) are migrated to 3 fixed layers
 * - All pieces from C4+ are reassigned to C3
 * - Migration is idempotent (safe to run multiple times)
 * - Toast is shown only on first migration
 * - No changes for scenes already at 3 layers
 */
describe('Layer migration (C4+ → C3 clamp)', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('Legacy scene (5 layers) migrates to 3 layers with pieces reassigned to C3', () => {
    const store = useSceneStore.getState();

    // Create IDs
    const C1 = 'layer_C1' as ID;
    const C2 = 'layer_C2' as ID;
    const C3 = 'layer_C3' as ID;
    const LegacyA = 'layer_LegacyA' as ID;
    const LegacyB = 'layer_LegacyB' as ID;
    const matId = 'mat_1' as ID;
    const piece1 = 'piece_1' as ID;
    const piece2 = 'piece_2' as ID;
    const piece3 = 'piece_3' as ID;
    const piece4 = 'piece_4' as ID;
    const piece5 = 'piece_5' as ID;

    // Create a legacy scene file with 5 layers
    const legacyScene: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene_test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {
          [matId]: { id: matId, name: 'Material 1', oriented: false },
        },
        layers: {
          [C1]: { id: C1, name: 'C1', z: 0, pieces: [piece1] },
          [C2]: { id: C2, name: 'C2', z: 1, pieces: [piece2] },
          [C3]: { id: C3, name: 'C3', z: 2, pieces: [piece3] },
          [LegacyA]: { id: LegacyA, name: 'LegacyA', z: 3, pieces: [piece4] },
          [LegacyB]: { id: LegacyB, name: 'LegacyB', z: 4, pieces: [piece5] },
        },
        pieces: {
          [piece1]: {
            id: piece1,
            layerId: C1,
            materialId: matId,
            position: { x: 10, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          [piece2]: {
            id: piece2,
            layerId: C2,
            materialId: matId,
            position: { x: 70, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          [piece3]: {
            id: piece3,
            layerId: C3,
            materialId: matId,
            position: { x: 130, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          [piece4]: {
            id: piece4,
            layerId: LegacyA,
            materialId: matId,
            position: { x: 190, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
          [piece5]: {
            id: piece5,
            layerId: LegacyB,
            materialId: matId,
            position: { x: 250, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [C1, C2, C3, LegacyA, LegacyB],
      },
      ui: {},
    };

    // Clear toast before import
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Import legacy scene (triggers migration)
    store.importSceneFileV1(legacyScene);

    const state = useSceneStore.getState();

    // Verify migration: only 3 layers remain
    expect(state.scene.layerOrder.length).toBe(3);
    expect(state.scene.layerOrder).toEqual([C1, C2, C3]);

    // Verify legacy layers removed
    expect(state.scene.layers[LegacyA]).toBeUndefined();
    expect(state.scene.layers[LegacyB]).toBeUndefined();

    // Verify all pieces from LegacyA/LegacyB reassigned to C3
    expect(state.scene.pieces[piece1].layerId).toBe(C1);
    expect(state.scene.pieces[piece2].layerId).toBe(C2);
    expect(state.scene.pieces[piece3].layerId).toBe(C3);
    expect(state.scene.pieces[piece4].layerId).toBe(C3); // Moved from LegacyA
    expect(state.scene.pieces[piece5].layerId).toBe(C3); // Moved from LegacyB

    // Verify C3 contains all reassigned pieces
    expect(state.scene.layers[C3].pieces).toContain(piece3);
    expect(state.scene.layers[C3].pieces).toContain(piece4);
    expect(state.scene.layers[C3].pieces).toContain(piece5);

    // Verify toast was shown
    expect(state.ui.toast).toBeDefined();
    expect(state.ui.toast?.message).toContain('Scène héritée');
    expect(state.ui.toast?.message).toContain('C4+');
    expect(state.ui.toast?.message).toContain('C3');
  });

  test('Migration is idempotent (2nd import does not change anything)', () => {
    const store = useSceneStore.getState();

    const C1 = 'layer_C1' as ID;
    const C2 = 'layer_C2' as ID;
    const C3 = 'layer_C3' as ID;
    const Legacy = 'layer_Legacy' as ID;
    const matId = 'mat_1' as ID;
    const piece = 'piece_1' as ID;

    const legacyScene: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene_test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {
          [matId]: { id: matId, name: 'Material 1', oriented: false },
        },
        layers: {
          [C1]: { id: C1, name: 'C1', z: 0, pieces: [] },
          [C2]: { id: C2, name: 'C2', z: 1, pieces: [] },
          [C3]: { id: C3, name: 'C3', z: 2, pieces: [] },
          [Legacy]: { id: Legacy, name: 'Legacy', z: 3, pieces: [piece] },
        },
        pieces: {
          [piece]: {
            id: piece,
            layerId: Legacy,
            materialId: matId,
            position: { x: 10, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [C1, C2, C3, Legacy],
      },
      ui: {},
    };

    // First import (triggers migration)
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));
    store.importSceneFileV1(legacyScene);

    const state1 = useSceneStore.getState();

    // Verify migration happened
    expect(state1.scene.layerOrder.length).toBe(3);
    expect(state1.ui.toast).toBeDefined();

    // Second import of already-migrated scene
    const exported = store.toSceneFileV1();
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));
    store.importSceneFileV1(exported);

    const state2 = useSceneStore.getState();

    // Verify no changes (idempotent)
    expect(state2.scene.layerOrder.length).toBe(3);
    expect(state2.scene.layerOrder).toEqual([C1, C2, C3]);
    expect(state2.scene.pieces[piece].layerId).toBe(C3);

    // Verify toast NOT shown (already migrated)
    expect(state2.ui.toast).toBeUndefined();
  });

  test('No migration for scene already at 3 layers', () => {
    const store = useSceneStore.getState();

    const C1 = 'layer_C1' as ID;
    const C2 = 'layer_C2' as ID;
    const C3 = 'layer_C3' as ID;
    const matId = 'mat_1' as ID;
    const piece = 'piece_1' as ID;

    const validScene: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene_test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {
          [matId]: { id: matId, name: 'Material 1', oriented: false },
        },
        layers: {
          [C1]: { id: C1, name: 'C1', z: 0, pieces: [piece] },
          [C2]: { id: C2, name: 'C2', z: 1, pieces: [] },
          [C3]: { id: C3, name: 'C3', z: 2, pieces: [] },
        },
        pieces: {
          [piece]: {
            id: piece,
            layerId: C1,
            materialId: matId,
            position: { x: 10, y: 10 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            kind: 'rect',
            size: { w: 50, h: 50 },
          },
        },
        layerOrder: [C1, C2, C3],
      },
      ui: {},
    };

    // Import scene with exactly 3 layers
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));
    store.importSceneFileV1(validScene);

    const state = useSceneStore.getState();

    // Verify no migration (toast not shown)
    expect(state.ui.toast).toBeUndefined();
    expect(state.scene.layerOrder.length).toBe(3);
  });

  test('Migration tag is added to scene metadata', () => {
    const store = useSceneStore.getState();

    const C1 = 'layer_C1' as ID;
    const C2 = 'layer_C2' as ID;
    const C3 = 'layer_C3' as ID;
    const Legacy = 'layer_Legacy' as ID;
    const matId = 'mat_1' as ID;

    const legacyScene: SceneFileV1 = {
      version: 1,
      scene: {
        id: 'scene_test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {
          [matId]: { id: matId, name: 'Material 1', oriented: false },
        },
        layers: {
          [C1]: { id: C1, name: 'C1', z: 0, pieces: [] },
          [C2]: { id: C2, name: 'C2', z: 1, pieces: [] },
          [C3]: { id: C3, name: 'C3', z: 2, pieces: [] },
          [Legacy]: { id: Legacy, name: 'Legacy', z: 3, pieces: [] },
        },
        pieces: {},
        layerOrder: [C1, C2, C3, Legacy],
      },
      ui: {},
    };

    store.importSceneFileV1(legacyScene);

    const state = useSceneStore.getState();

    // Verify migration tag
    expect((state.scene as any).migrations).toBeDefined();
    expect((state.scene as any).migrations.layersV1).toBeDefined();
    expect((state.scene as any).migrations.layersV1.appliedAt).toBeDefined();
    expect(typeof (state.scene as any).migrations.layersV1.appliedAt).toBe('string');
  });
});
