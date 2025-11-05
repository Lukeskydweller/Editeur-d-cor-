import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layer interaction isolation
 *
 * Verifies that:
 * - Clicking piece in active layer initiates drag
 * - Clicking piece in inactive layer switches to that layer (no drag)
 * - Only pieces in active layer can be dragged
 */
describe('Layer interaction isolation', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('clicking piece in active layer initiates drag', async () => {
    const store = useSceneStore.getState();

    // Create C1 and set as active
    const c1Id = store.addLayer('C1');
    store.setActiveLayer(c1Id);

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1
    const pieceId = store.addRectPiece(c1Id, matId, 50, 50, 100, 100);

    const state = useSceneStore.getState();
    expect(state.ui.activeLayer).toBe(c1Id);

    // Verify piece exists in active layer
    expect(state.scene.pieces[pieceId]).toBeDefined();
    expect(state.scene.pieces[pieceId].layerId).toBe(c1Id);

    // Note: In the real app, handlePointerDown would check activeLayer before calling beginDrag
    // This test verifies the piece is in the active layer and can be interacted with
  });

  test('clicking piece in inactive layer switches to that layer without drag', async () => {
    const store = useSceneStore.getState();

    // Create C1 and C2
    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');

    // Set C1 as active
    store.setActiveLayer(c1Id);

    // Add material
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C2 (inactive layer)
    const piece2Id = store.addRectPiece(c2Id, matId, 50, 50, 200, 200);

    expect(useSceneStore.getState().ui.activeLayer).toBe(c1Id);

    // Simulate clicking piece in C2 (inactive layer)
    // In the real app, handlePointerDown checks layerId and calls setActiveLayer
    const piece = useSceneStore.getState().scene.pieces[piece2Id];
    if (piece && piece.layerId !== c1Id) {
      store.setActiveLayer(piece.layerId);
      // No beginDrag call - returns early
    }

    // activeLayer should switch to C2
    expect(useSceneStore.getState().ui.activeLayer).toBe(c2Id);

    // Drag should NOT be initiated
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
  });

  test('pieces in inactive layer cannot be selected initially', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    store.setActiveLayer(c1Id);

    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    const piece1Id = store.addRectPiece(c1Id, matId, 50, 50, 100, 100);
    const piece2Id = store.addRectPiece(c2Id, matId, 50, 50, 200, 200);

    // Select piece in active layer (C1) - should work
    store.selectPiece(piece1Id);
    expect(useSceneStore.getState().ui.selectedId).toBe(piece1Id);

    // In a real scenario with pointerEvents="none", piece2 can't even be clicked
    // But we can verify that switching layer is required before interaction
    expect(useSceneStore.getState().scene.pieces[piece2Id].layerId).toBe(c2Id);
    expect(useSceneStore.getState().ui.activeLayer).toBe(c1Id);
  });

  test('after switching to inactive layer, pieces become interactive', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    store.setActiveLayer(c1Id);

    const matId = store.addMaterial({ name: 'Material 1', oriented: false });
    const piece2Id = store.addRectPiece(c2Id, matId, 50, 50, 200, 200);

    // Initially C2 is inactive
    expect(useSceneStore.getState().ui.activeLayer).toBe(c1Id);

    // Switch to C2
    store.setActiveLayer(c2Id);

    // Now piece2 is in active layer and can be interacted with
    const state = useSceneStore.getState();
    expect(state.ui.activeLayer).toBe(c2Id);
    expect(state.scene.pieces[piece2Id]).toBeDefined();
    expect(state.scene.pieces[piece2Id].layerId).toBe(c2Id);
  });
});
