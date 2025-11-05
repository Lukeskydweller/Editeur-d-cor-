import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: activeLayer state management
 *
 * Verifies that:
 * - setActiveLayer action correctly updates activeLayer
 * - Default active layer is C1 after initSceneWithDefaults
 * - setActiveLayer validates layer exists before setting
 */
describe('Active layer state', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('initSceneWithDefaults sets C1 as active layer', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();

    const state = useSceneStore.getState();

    // C1 should exist
    const c1Layer = Object.values(state.scene.layers).find(l => l.name === 'C1');
    expect(c1Layer).toBeDefined();

    // C1 should be the active layer
    expect(state.ui.activeLayer).toBe(c1Layer?.id);
  });

  test('setActiveLayer updates activeLayer when layer exists', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();

    // Add C2
    const c2Id = store.addLayer('C2');

    // Set C2 as active
    store.setActiveLayer(c2Id);

    expect(useSceneStore.getState().ui.activeLayer).toBe(c2Id);
  });

  test('setActiveLayer does nothing when layer does not exist', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();

    const originalActiveLayer = useSceneStore.getState().ui.activeLayer;

    // Try to set non-existent layer
    store.setActiveLayer('non-existent-layer-id');

    // activeLayer should not change
    expect(useSceneStore.getState().ui.activeLayer).toBe(originalActiveLayer);
  });

  test('activeLayer resets to undefined after initScene', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();

    expect(useSceneStore.getState().ui.activeLayer).toBeDefined();

    // Reset scene
    store.initScene(600, 600);

    expect(useSceneStore.getState().ui.activeLayer).toBeUndefined();
  });
});
