import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Fixed layer order (canonical painter's order)
 *
 * Verifies that:
 * - layerOrder is always canonicalized to [C1, C2, C3, ...legacy]
 * - Order is enforced after init, import, and load operations
 * - Keyboard shortcuts 1/2/3 remain stable (always point to C1/C2/C3)
 */
describe('Fixed layer order (canonical)', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('initSceneWithDefaults() canonicalizes layerOrder to [C1, C2, C3]', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const { C1, C2, C3 } = state.scene.fixedLayerIds!;

    // Verify layerOrder starts with [C1, C2, C3]
    expect(state.scene.layerOrder.length).toBe(3);
    expect(state.scene.layerOrder[0]).toBe(C1);
    expect(state.scene.layerOrder[1]).toBe(C2);
    expect(state.scene.layerOrder[2]).toBe(C3);
  });

  test('import with disordered layerOrder canonicalizes to [C1, C2, C3, ...legacy]', () => {
    const store = useSceneStore.getState();

    // Create initial scene
    store.initSceneWithDefaults(600, 600);

    const state1 = useSceneStore.getState();
    const { C1, C2, C3 } = state1.scene.fixedLayerIds!;

    // Manually create a disordered scene (simulate old scene file)
    const disorderedScene = {
      version: 1 as const,
      scene: {
        id: 'test-disordered',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {
          [C1]: { id: C1, name: 'C1', z: 0, pieces: [] },
          [C2]: { id: C2, name: 'C2', z: 1, pieces: [] },
          [C3]: { id: C3, name: 'C3', z: 2, pieces: [] },
        },
        pieces: {},
        // Disordered: [C3, C1, C2] instead of [C1, C2, C3]
        layerOrder: [C3, C1, C2],
      },
      ui: {},
    };

    // Import disordered scene
    store.importSceneFileV1(disorderedScene);

    const state2 = useSceneStore.getState();

    // Verify layerOrder is canonicalized to [C1, C2, C3]
    expect(state2.scene.layerOrder.length).toBe(3);
    expect(state2.scene.layerOrder[0]).toBe(C1);
    expect(state2.scene.layerOrder[1]).toBe(C2);
    expect(state2.scene.layerOrder[2]).toBe(C3);
  });

  test('keyboard shortcuts 1/2/3 always map to C1/C2/C3 (stable mapping)', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const { C1, C2, C3 } = state.scene.fixedLayerIds!;

    // Verify keyboard shortcuts via layerOrder indices
    // Keyboard mapping uses layerOrder[0/1/2] for keys 1/2/3
    expect(state.scene.layerOrder[0]).toBe(C1); // Key '1' → C1
    expect(state.scene.layerOrder[1]).toBe(C2); // Key '2' → C2
    expect(state.scene.layerOrder[2]).toBe(C3); // Key '3' → C3

    // Verify layer names match
    expect(state.scene.layers[C1].name).toBe('C1');
    expect(state.scene.layers[C2].name).toBe('C2');
    expect(state.scene.layers[C3].name).toBe('C3');
  });

  test("painter's order is immutable: C1 (bottom) → C3 (top)", () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const { C1, C2, C3 } = state.scene.fixedLayerIds!;

    // Verify layerOrder represents painter's order (index 0 = bottom)
    expect(state.scene.layerOrder).toEqual([C1, C2, C3]);

    // Z-indices should match (though not strictly required by painter's order)
    expect(state.scene.layers[C1].z).toBeLessThan(state.scene.layers[C2].z);
    expect(state.scene.layers[C2].z).toBeLessThan(state.scene.layers[C3].z);
  });

  test('canonical order preserved across autosave/restore', () => {
    const store = useSceneStore.getState();

    // Create scene
    store.initSceneWithDefaults(600, 600);

    const state1 = useSceneStore.getState();
    const { C1, C2, C3 } = state1.scene.fixedLayerIds!;

    // Export for manual save
    const exported = store.toSceneFileV1();

    // Reset scene
    store.initScene(600, 600);

    // Import (simulating autosave restore)
    store.importSceneFileV1(exported);

    const state2 = useSceneStore.getState();

    // Verify canonical order is preserved
    expect(state2.scene.layerOrder).toEqual([C1, C2, C3]);
    expect(state2.scene.fixedLayerIds).toEqual({ C1, C2, C3 });
  });
});
