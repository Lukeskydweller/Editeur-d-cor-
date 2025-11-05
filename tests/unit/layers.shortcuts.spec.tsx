import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layer keyboard shortcuts
 *
 * Verifies that:
 * - Digit1/2/3 switches to C1/C2/C3
 * - KeyV toggles visibility of active layer
 * - KeyL toggles lock of active layer
 *
 * Note: These tests verify state changes only.
 * Full keyboard event handling is tested in E2E tests.
 */
describe('Layer keyboard shortcuts (state logic)', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('switching to layer 1 (C1) via setActiveLayer', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');

    // Initially no active layer
    expect(useSceneStore.getState().ui.activeLayer).toBeUndefined();

    // Simulate Digit1 → setActiveLayer(c1Id)
    store.setActiveLayer(c1Id);

    expect(useSceneStore.getState().ui.activeLayer).toBe(c1Id);
  });

  test('switching to layer 2 (C2) via setActiveLayer', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');

    store.setActiveLayer(c1Id);
    expect(useSceneStore.getState().ui.activeLayer).toBe(c1Id);

    // Simulate Digit2 → setActiveLayer(c2Id)
    store.setActiveLayer(c2Id);

    expect(useSceneStore.getState().ui.activeLayer).toBe(c2Id);
  });

  test('switching to layer 3 (C3) via setActiveLayer', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    const c3Id = store.addLayer('C3');

    store.setActiveLayer(c1Id);

    // Simulate Digit3 → setActiveLayer(c3Id)
    store.setActiveLayer(c3Id);

    expect(useSceneStore.getState().ui.activeLayer).toBe(c3Id);
  });

  test('KeyV toggles visibility of active layer', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    store.setActiveLayer(c1Id);

    // Initially visible
    expect(useSceneStore.getState().ui.layerVisibility[c1Id]).toBe(true);

    // Simulate KeyV → toggleLayerVisibility(activeLayer)
    store.toggleLayerVisibility(c1Id);

    expect(useSceneStore.getState().ui.layerVisibility[c1Id]).toBe(false);

    // Press V again
    store.toggleLayerVisibility(c1Id);

    expect(useSceneStore.getState().ui.layerVisibility[c1Id]).toBe(true);
  });

  test('KeyL toggles lock of active layer', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    store.setActiveLayer(c1Id);

    // Initially unlocked
    expect(useSceneStore.getState().ui.layerLocked[c1Id]).toBe(false);

    // Simulate KeyL → toggleLayerLock(activeLayer)
    store.toggleLayerLock(c1Id);

    expect(useSceneStore.getState().ui.layerLocked[c1Id]).toBe(true);

    // Press L again
    store.toggleLayerLock(c1Id);

    expect(useSceneStore.getState().ui.layerLocked[c1Id]).toBe(false);
  });

  test('layerOrder provides correct mapping for digit shortcuts', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    const c3Id = store.addLayer('C3');

    const state = useSceneStore.getState();

    // layerOrder should be [c1Id, c2Id, c3Id]
    expect(state.scene.layerOrder).toEqual([c1Id, c2Id, c3Id]);

    // Digit1 → layerOrder[0] → C1
    expect(state.scene.layerOrder[0]).toBe(c1Id);

    // Digit2 → layerOrder[1] → C2
    expect(state.scene.layerOrder[1]).toBe(c2Id);

    // Digit3 → layerOrder[2] → C3
    expect(state.scene.layerOrder[2]).toBe(c3Id);
  });
});
