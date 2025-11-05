import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import { MAX_LAYERS } from '@/constants/validation';

/**
 * Test suite: MAX_LAYERS enforcement
 *
 * Verifies that:
 * - addLayer blocks creation beyond MAX_LAYERS (3)
 * - Toast message displayed when limit reached
 * - Scene remains unchanged after blocked attempt
 */
describe('MAX_LAYERS enforcement', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('addLayer creates layers up to MAX_LAYERS', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    expect(useSceneStore.getState().scene.layerOrder).toHaveLength(1);
    expect(c1Id).toBeDefined();

    const c2Id = store.addLayer('C2');
    expect(useSceneStore.getState().scene.layerOrder).toHaveLength(2);
    expect(c2Id).toBeDefined();

    const c3Id = store.addLayer('C3');
    expect(useSceneStore.getState().scene.layerOrder).toHaveLength(3);
    expect(c3Id).toBeDefined();
  });

  test('addLayer blocks C4 when MAX_LAYERS=3 reached', () => {
    const store = useSceneStore.getState();

    // Create 3 layers
    store.addLayer('C1');
    store.addLayer('C2');
    store.addLayer('C3');

    expect(useSceneStore.getState().scene.layerOrder).toHaveLength(MAX_LAYERS);

    // Try to add C4 - should be blocked
    const c4Id = store.addLayer('C4');

    // Layer count should still be 3
    expect(useSceneStore.getState().scene.layerOrder).toHaveLength(MAX_LAYERS);

    // C4 should not exist in layers
    const state = useSceneStore.getState();
    const c4Layer = Object.values(state.scene.layers).find(l => l.name === 'C4');
    expect(c4Layer).toBeUndefined();
  });

  test('addLayer shows toast when limit reached', () => {
    const store = useSceneStore.getState();

    // Create 3 layers
    store.addLayer('C1');
    store.addLayer('C2');
    store.addLayer('C3');

    // Try to add C4 - should trigger toast
    store.addLayer('C4');

    // Toast should be set
    const state = useSceneStore.getState();
    expect(state.ui.toast).toBeDefined();
    expect(state.ui.toast?.message).toContain(`${MAX_LAYERS}`);
    expect(state.ui.toast?.message).toContain('couches');
    expect(state.ui.toast?.until).toBeGreaterThan(Date.now());
  });

  test('MAX_LAYERS constant is 3', () => {
    expect(MAX_LAYERS).toBe(3);
  });
});
