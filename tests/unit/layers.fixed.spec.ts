import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore, getFixedLayerIds, getFixedLayerIdByName } from '@/state/useSceneStore';
import { FIXED_LAYER_NAMES } from '@/constants/layers';

/**
 * Test suite: Layers V1 — socle fixe
 *
 * Verifies that:
 * - fixedLayerIds are always resolved for C1/C2/C3
 * - Layer names match FIXED_LAYER_NAMES constants
 * - Keyboard mapping 1/2/3 points to C1/C2/C3 by stable names (not by layerOrder index)
 */
describe('Layers V1 — socle fixe', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('résout toujours des ids stables pour C1/C2/C3', () => {
    const store = useSceneStore.getState();
    // Simulate initSceneWithDefaults which calls ensureFixedLayerIds
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const ids = state.scene.fixedLayerIds!;

    // Verify all 3 fixed layer IDs are present
    expect(ids).toBeDefined();
    expect(ids.C1).toBeTruthy();
    expect(ids.C2).toBeTruthy();
    expect(ids.C3).toBeTruthy();

    // Verify layers exist in scene.layers
    expect(state.scene.layers[ids.C1]).toBeDefined();
    expect(state.scene.layers[ids.C2]).toBeDefined();
    expect(state.scene.layers[ids.C3]).toBeDefined();

    // Verify layer names match
    expect(state.scene.layers[ids.C1].name).toBe('C1');
    expect(state.scene.layers[ids.C2].name).toBe('C2');
    expect(state.scene.layers[ids.C3].name).toBe('C3');
  });

  test('FIXED_LAYER_NAMES contient exactement [C1, C2, C3]', () => {
    expect(FIXED_LAYER_NAMES).toEqual(['C1', 'C2', 'C3']);
  });

  test('getFixedLayerIds selector retourne les IDs fixes', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const ids = getFixedLayerIds(state);

    expect(ids).toBeDefined();
    expect(ids.C1).toBeTruthy();
    expect(ids.C2).toBeTruthy();
    expect(ids.C3).toBeTruthy();
  });

  test('getFixedLayerIdByName selector retourne le bon ID', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const c1Id = getFixedLayerIdByName(state, 'C1');
    const c2Id = getFixedLayerIdByName(state, 'C2');
    const c3Id = getFixedLayerIdByName(state, 'C3');

    expect(c1Id).toBeTruthy();
    expect(c2Id).toBeTruthy();
    expect(c3Id).toBeTruthy();

    // Verify these IDs match the layers with correct names
    expect(state.scene.layers[c1Id!].name).toBe('C1');
    expect(state.scene.layers[c2Id!].name).toBe('C2');
    expect(state.scene.layers[c3Id!].name).toBe('C3');
  });

  test('fixedLayerIds reste stable après réordonnancement (mapping clavier ne change pas)', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state1 = useSceneStore.getState();
    const c1IdBefore = state1.scene.fixedLayerIds!.C1;
    const c2IdBefore = state1.scene.fixedLayerIds!.C2;
    const c3IdBefore = state1.scene.fixedLayerIds!.C3;

    // Simulate reordering (user moves C3 to front)
    // This should NOT affect fixedLayerIds
    store.moveLayerToFront(c3IdBefore);

    const state2 = useSceneStore.getState();
    const c1IdAfter = state2.scene.fixedLayerIds!.C1;
    const c2IdAfter = state2.scene.fixedLayerIds!.C2;
    const c3IdAfter = state2.scene.fixedLayerIds!.C3;

    // Verify fixedLayerIds are unchanged (stable mapping)
    expect(c1IdAfter).toBe(c1IdBefore);
    expect(c2IdAfter).toBe(c2IdBefore);
    expect(c3IdAfter).toBe(c3IdBefore);

    // Verify keyboard shortcuts 1/2/3 still point to C1/C2/C3 by name (not by layerOrder index)
    // layerOrder may have changed, but fixedLayerIds remains stable
    const ids = state2.scene.fixedLayerIds!;
    expect(ids.C1).toBe(c1IdBefore); // Key '1' → C1
    expect(ids.C2).toBe(c2IdBefore); // Key '2' → C2
    expect(ids.C3).toBe(c3IdBefore); // Key '3' → C3
  });

  test('activeLayer est défini sur C1 après init', () => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    const c1Id = state.scene.fixedLayerIds!.C1;

    // Verify activeLayer is set to C1
    expect(state.ui.activeLayer).toBe(c1Id);
  });

  test('import de scène préserve/résout fixedLayerIds', () => {
    const store = useSceneStore.getState();

    // Create initial scene
    store.initSceneWithDefaults(600, 600);
    const state1 = useSceneStore.getState();
    const c1Id = state1.scene.fixedLayerIds!.C1;

    // Export scene
    const exported = store.toSceneFileV1();

    // Reset scene
    store.initScene(600, 600);

    // Import scene
    store.importSceneFileV1(exported);

    const state2 = useSceneStore.getState();

    // Verify fixedLayerIds is resolved after import
    expect(state2.scene.fixedLayerIds).toBeDefined();
    expect(state2.scene.fixedLayerIds!.C1).toBeTruthy();
    expect(state2.scene.fixedLayerIds!.C2).toBeTruthy();
    expect(state2.scene.fixedLayerIds!.C3).toBeTruthy();

    // Verify layer names match
    expect(state2.scene.layers[state2.scene.fixedLayerIds!.C1].name).toBe('C1');
    expect(state2.scene.layers[state2.scene.fixedLayerIds!.C2].name).toBe('C2');
    expect(state2.scene.layers[state2.scene.fixedLayerIds!.C3].name).toBe('C3');
  });
});
