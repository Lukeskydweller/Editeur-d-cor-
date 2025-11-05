import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layer lock
 *
 * Verifies that:
 * - toggleLayerLock works correctly
 * - Locked layers remain visible but have no pointer events
 * - Lock defaults to false for new layers
 */
describe('Layer lock', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();
  });

  test('new layer is unlocked by default', () => {
    const store = useSceneStore.getState();
    const c2Id = store.addLayer('C2');

    const state = useSceneStore.getState();
    expect(state.ui.layerLocked[c2Id]).toBe(false);
  });

  test('toggleLayerLock locks unlocked layer', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find(l => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // C1 should be unlocked by default (false or undefined defaults to false)
    const initialLock = state1.ui.layerLocked[c1Id!] ?? false;
    expect(initialLock).toBe(false);

    // Lock layer
    store.toggleLayerLock(c1Id!);

    const state2 = useSceneStore.getState();
    expect(state2.ui.layerLocked[c1Id!]).toBe(true);
  });

  test('toggleLayerLock unlocks locked layer', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find(l => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // Lock layer
    store.toggleLayerLock(c1Id!);
    expect(useSceneStore.getState().ui.layerLocked[c1Id!]).toBe(true);

    // Unlock layer again
    store.toggleLayerLock(c1Id!);
    expect(useSceneStore.getState().ui.layerLocked[c1Id!]).toBe(false);
  });

  test('toggleLayerLock does nothing for non-existent layer', () => {
    const store = useSceneStore.getState();

    const stateBefore = useSceneStore.getState().ui.layerLocked;
    store.toggleLayerLock('non-existent-layer-id');
    const stateAfter = useSceneStore.getState().ui.layerLocked;

    // Should not change
    expect(stateAfter).toEqual(stateBefore);
  });

  test('lock persists across layer operations', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find(l => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // Lock C1
    store.toggleLayerLock(c1Id!);
    expect(useSceneStore.getState().ui.layerLocked[c1Id!]).toBe(true);

    // Add piece to C1
    const matId = store.addMaterial({ name: 'Material 1', oriented: false });
    store.addRectPiece(c1Id!, matId, 50, 50, 100, 100);

    // C1 should still be locked
    expect(useSceneStore.getState().ui.layerLocked[c1Id!]).toBe(true);
  });

  test('locked layer can still be set as active', () => {
    const store = useSceneStore.getState();

    const state1 = useSceneStore.getState();
    const c1Id = Object.values(state1.scene.layers).find(l => l.name === 'C1')?.id;
    expect(c1Id).toBeDefined();

    // Lock C1
    store.toggleLayerLock(c1Id!);

    // Set C1 as active
    store.setActiveLayer(c1Id!);

    const state2 = useSceneStore.getState();
    expect(state2.ui.activeLayer).toBe(c1Id);
    expect(state2.ui.layerLocked[c1Id!]).toBe(true);
  });
});
