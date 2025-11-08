import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import { isLayerUnlocked, isLayerFilled } from '@/state/layers.gating';

/**
 * Test suite: Progressive layer unlock (C1 → C2 → C3)
 *
 * Verifies that:
 * - C2 is locked until C1 has ≥1 piece
 * - C3 is locked until C2 has ≥1 piece
 * - Insertion attempts on locked layers are blocked with toast
 * - Keyboard selection remains operational (WCAG 2.1 compliance)
 */
describe('Progressive layer unlock (C1 → C2 → C3)', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);

    // Manually create C1, C2, C3 without pieces
    const C1 = store.addLayer('C1');
    const C2 = store.addLayer('C2');
    const C3 = store.addLayer('C3');

    // Set fixedLayerIds
    useSceneStore.setState((s) => ({
      ...s,
      scene: {
        ...s.scene,
        fixedLayerIds: { C1, C2, C3 },
      },
    }));
  });

  test('Empty scene: C1 unlocked, C2 and C3 locked', () => {
    const state = useSceneStore.getState();
    const { C1, C2, C3 } = state.scene.fixedLayerIds!;

    // C1 should be unlocked
    expect(isLayerUnlocked(state, 'C1')).toBe(true);

    // C2 and C3 should be locked (no pieces in C1)
    expect(isLayerUnlocked(state, 'C2')).toBe(false);
    expect(isLayerUnlocked(state, 'C3')).toBe(false);

    // Verify piece counts
    expect(isLayerFilled(state, 'C1')).toBe(false);
    expect(isLayerFilled(state, 'C2')).toBe(false);
    expect(isLayerFilled(state, 'C3')).toBe(false);
  });

  test('After adding piece to C1: C2 unlocked, C3 still locked', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C1, C2, C3 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1
    store.addRectPiece(C1, matId, 50, 50, 100, 100);

    const state2 = useSceneStore.getState();

    // C1 filled → C2 unlocked
    expect(isLayerFilled(state2, 'C1')).toBe(true);
    expect(isLayerUnlocked(state2, 'C1')).toBe(true);
    expect(isLayerUnlocked(state2, 'C2')).toBe(true);

    // C3 still locked (C2 empty)
    expect(isLayerFilled(state2, 'C2')).toBe(false);
    expect(isLayerUnlocked(state2, 'C3')).toBe(false);
  });

  test('After adding piece to C2: C3 unlocked', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C1, C2, C3 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1
    store.addRectPiece(C1, matId, 50, 50, 100, 100);

    // Add piece to C2
    store.addRectPiece(C2, matId, 50, 50, 200, 200);

    const state2 = useSceneStore.getState();

    // All layers unlocked
    expect(isLayerFilled(state2, 'C1')).toBe(true);
    expect(isLayerFilled(state2, 'C2')).toBe(true);
    expect(isLayerUnlocked(state2, 'C1')).toBe(true);
    expect(isLayerUnlocked(state2, 'C2')).toBe(true);
    expect(isLayerUnlocked(state2, 'C3')).toBe(true);
  });

  test('Attempt to add to C2 when C1 empty: blocked with toast', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C2 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Clear toast before test
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Attempt to add piece to C2 (should be blocked)
    const pieceId = store.addRectPiece(C2, matId, 50, 50, 100, 100);

    const state2 = useSceneStore.getState();

    // Piece should NOT be created (empty ID returned)
    expect(pieceId).toBe('');

    // Toast should be shown
    expect(state2.ui.toast).toBeDefined();
    expect(state2.ui.toast?.message).toContain('C2 verrouillée');
    expect(state2.ui.toast?.message).toContain('C1');

    // C2 should still be empty
    expect(state2.scene.layers[C2].pieces.length).toBe(0);
  });

  test('Attempt to add to C3 when C2 empty: blocked with toast', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C1, C3 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1 (to unlock C2)
    store.addRectPiece(C1, matId, 50, 50, 100, 100);

    // Clear toast before test
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Attempt to add piece to C3 (should be blocked)
    const pieceId = store.addRectPiece(C3, matId, 50, 50, 100, 100);

    const state2 = useSceneStore.getState();

    // Piece should NOT be created (empty ID returned)
    expect(pieceId).toBe('');

    // Toast should be shown
    expect(state2.ui.toast).toBeDefined();
    expect(state2.ui.toast?.message).toContain('C3 verrouillée');
    expect(state2.ui.toast?.message).toContain('C2');

    // C3 should still be empty
    expect(state2.scene.layers[C3].pieces.length).toBe(0);
  });

  test('Keyboard selection works even when layer is locked', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C1, C2, C3 } = state1.scene.fixedLayerIds!;

    // Verify C2 is locked but can still be set as active layer
    expect(isLayerUnlocked(state1, 'C2')).toBe(false);

    // Select C2 via setActiveLayer (keyboard shortcut '2')
    store.setActiveLayer(C2);

    const state2 = useSceneStore.getState();

    // C2 should be active despite being locked
    expect(state2.ui.activeLayer).toBe(C2);

    // Select C3 via setActiveLayer (keyboard shortcut '3')
    store.setActiveLayer(C3);

    const state3 = useSceneStore.getState();

    // C3 should be active despite being locked
    expect(state3.ui.activeLayer).toBe(C3);
  });

  test('Duplicate piece on locked layer: blocked with toast', () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C1, C2 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1
    const piece1Id = store.addRectPiece(C1, matId, 50, 50, 100, 100);

    // Add piece to C2 (unlocked after adding to C1)
    const piece2Id = store.addRectPiece(C2, matId, 50, 50, 200, 200);

    // Delete piece from C1 (locks C2 again)
    useSceneStore.setState((s) => ({
      ...s,
      scene: {
        ...s.scene,
        layers: {
          ...s.scene.layers,
          [C1]: {
            ...s.scene.layers[C1],
            pieces: s.scene.layers[C1].pieces.filter((id) => id !== piece1Id),
          },
        },
      },
    }));

    const state2 = useSceneStore.getState();

    // C2 should be locked again
    expect(isLayerUnlocked(state2, 'C2')).toBe(false);

    // Select piece on C2
    store.selectPiece(piece2Id);

    // Clear toast before test
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Attempt to duplicate piece on C2 (should be blocked)
    store.duplicateSelected();

    const state3 = useSceneStore.getState();

    // Toast should be shown
    expect(state3.ui.toast).toBeDefined();
    expect(state3.ui.toast?.message).toContain('C2 verrouillée');

    // C2 should still have only 1 piece (duplication blocked)
    expect(state3.scene.layers[C2].pieces.length).toBe(1);
  });

  test('insertRect to locked layer: blocked with toast', async () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C2 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Clear toast before test
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Attempt to insert on C2 (should be blocked)
    const pieceId = await store.insertRect({
      w: 50,
      h: 50,
      x: 100,
      y: 100,
      layerId: C2,
      materialId: matId,
    });

    const state2 = useSceneStore.getState();

    // Piece should NOT be created (null returned)
    expect(pieceId).toBe(null);

    // Toast should be shown
    expect(state2.ui.toast).toBeDefined();
    expect(state2.ui.toast?.message).toContain('C2 verrouillée');

    // C2 should still be empty
    expect(state2.scene.layers[C2].pieces.length).toBe(0);
  });

  test('startGhostInsert to locked layer: blocked with toast', async () => {
    const store = useSceneStore.getState();
    const state1 = useSceneStore.getState();
    const { C3 } = state1.scene.fixedLayerIds!;

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Clear toast before test
    useSceneStore.setState((s) => ({ ...s, ui: { ...s.ui, toast: undefined } }));

    // Attempt to start ghost insert on C3 (should be blocked)
    const pieceId = await store.startGhostInsert({
      w: 50,
      h: 50,
      layerId: C3,
      materialId: matId,
    });

    const state2 = useSceneStore.getState();

    // Piece should NOT be created (empty ID returned)
    expect(pieceId).toBe('');

    // Toast should be shown
    expect(state2.ui.toast).toBeDefined();
    expect(state2.ui.toast?.message).toContain('C3 verrouillée');

    // C3 should still be empty
    expect(state2.scene.layers[C3].pieces.length).toBe(0);
  });
});
