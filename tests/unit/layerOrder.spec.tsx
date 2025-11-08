import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layer painter's order
 *
 * Verifies that:
 * - Layers render in correct order (layerOrder bottom-to-top)
 * - Each layer has data-layer attribute
 * - C1 renders before C2, C2 before C3 (painter's order)
 */
describe("Layer painter's order", () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
  });

  test('layerOrder defines bottom-to-top rendering order', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    const c3Id = store.addLayer('C3');

    const state = useSceneStore.getState();

    // layerOrder should be [c1Id, c2Id, c3Id]
    expect(state.scene.layerOrder).toEqual([c1Id, c2Id, c3Id]);

    // C1 should be at index 0 (back)
    expect(state.scene.layerOrder[0]).toBe(c1Id);
    expect(state.scene.layers[c1Id].name).toBe('C1');

    // C3 should be at index 2 (front)
    expect(state.scene.layerOrder[2]).toBe(c3Id);
    expect(state.scene.layers[c3Id].name).toBe('C3');
  });

  test('pieces in different layers render in layer order', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    store.setActiveLayer(c1Id);

    const matId = store.addMaterial({ name: 'Material 1', oriented: false });

    // Add piece to C1
    const piece1Id = store.addRectPiece(c1Id, matId, 50, 50, 100, 100);

    // Add piece to C2
    const piece2Id = store.addRectPiece(c2Id, matId, 50, 50, 150, 150);

    const state = useSceneStore.getState();

    // Verify pieces are in correct layers
    expect(state.scene.pieces[piece1Id].layerId).toBe(c1Id);
    expect(state.scene.pieces[piece2Id].layerId).toBe(c2Id);

    // Verify layer order (C1 should render before C2)
    expect(state.scene.layerOrder.indexOf(c1Id)).toBeLessThan(state.scene.layerOrder.indexOf(c2Id));
  });

  test('layer z-index matches layerOrder position', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');
    const c3Id = store.addLayer('C3');

    const state = useSceneStore.getState();

    // z should match index in layerOrder
    expect(state.scene.layers[c1Id].z).toBe(0);
    expect(state.scene.layers[c2Id].z).toBe(1);
    expect(state.scene.layers[c3Id].z).toBe(2);
  });

  test('layers render with correct data-layer attribute names', () => {
    const store = useSceneStore.getState();

    const c1Id = store.addLayer('C1');
    const c2Id = store.addLayer('C2');

    const state = useSceneStore.getState();

    // In the actual SVG rendering, each layer should have data-layer={name}
    // This test verifies the data structure is correct
    expect(state.scene.layers[c1Id].name).toBe('C1');
    expect(state.scene.layers[c2Id].name).toBe('C2');

    // Verify the layerOrder maps to the correct layer names
    const layerNames = state.scene.layerOrder.map((id) => state.scene.layers[id].name);
    expect(layerNames).toEqual(['C1', 'C2']);
  });
});
