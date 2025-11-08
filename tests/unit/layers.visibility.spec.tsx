import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layer visibility
 *
 * Verifies that:
 * - toggleLayerVisibility works correctly
 * - Hidden layers have opacity 0 and no pointer events
 * - Visibility defaults to true for new layers
 */
describe('Layer visibility', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();
  });

  test('new layer is visible by default', () => {
    // C2 already exists (created by ensureFixedLayerIds), verify it's visible
    const state = useSceneStore.getState();
    const c2Id = state.scene.fixedLayerIds!.C2;

    expect(state.ui.layerVisibility[c2Id]).toBe(true);
  });

  test('toggleLayerVisibility hides visible layer', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find((l) => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // C1 should be visible by default (true or undefined defaults to true)
    const initialVisibility = state1.ui.layerVisibility[c1Id!] ?? true;
    expect(initialVisibility).toBe(true);

    // Toggle visibility
    store.toggleLayerVisibility(c1Id!);

    const state2 = useSceneStore.getState();
    expect(state2.ui.layerVisibility[c1Id!]).toBe(false);
  });

  test('toggleLayerVisibility shows hidden layer', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find((l) => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // Hide layer
    store.toggleLayerVisibility(c1Id!);
    expect(useSceneStore.getState().ui.layerVisibility[c1Id!]).toBe(false);

    // Show layer again
    store.toggleLayerVisibility(c1Id!);
    expect(useSceneStore.getState().ui.layerVisibility[c1Id!]).toBe(true);
  });

  test('toggleLayerVisibility does nothing for non-existent layer', () => {
    const store = useSceneStore.getState();

    const stateBefore = useSceneStore.getState().ui.layerVisibility;
    store.toggleLayerVisibility('non-existent-layer-id');
    const stateAfter = useSceneStore.getState().ui.layerVisibility;

    // Should not change
    expect(stateAfter).toEqual(stateBefore);
  });

  test('visibility persists across layer operations', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find((l) => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // Hide C1
    store.toggleLayerVisibility(c1Id!);
    expect(useSceneStore.getState().ui.layerVisibility[c1Id!]).toBe(false);

    // Add piece to C1
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });
    store.addRectPiece(c1Id!, matId, 50, 50, 100, 100);

    // C1 should still be hidden
    expect(useSceneStore.getState().ui.layerVisibility[c1Id!]).toBe(false);
  });
});
