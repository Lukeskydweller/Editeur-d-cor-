import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import { __spatialInternal } from '../../src/lib/spatial/globalIndex';

describe('spatial index wiring', () => {
  const originalFlag = window.__flags?.USE_GLOBAL_SPATIAL;

  beforeEach(() => {
    // Enable flag for these tests
    window.__flags = { USE_GLOBAL_SPATIAL: true };

    // Reset spatial index
    __spatialInternal.resetForTest();

    // Initialize store
    const store = useSceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
  });

  afterEach(() => {
    // Restore original flag
    if (originalFlag !== undefined) {
      window.__flags = { USE_GLOBAL_SPATIAL: originalFlag };
    }
    __spatialInternal.resetForTest();
  });

  it('addRectPiece syncs to spatial index', async () => {
    const store = useSceneStore.getState();
    const layerId = store.scene.layerOrder[0];
    const materialId = Object.keys(store.scene.materials)[0];

    // Add a piece
    const id = store.addRectPiece(layerId, materialId, 40, 40, 100, 100);

    // Check that spatial index was updated
    const stats = __spatialInternal.index?.stats();
    expect(stats?.items).toBe(1);
  });

  it('insertRect syncs to spatial index', async () => {
    const store = useSceneStore.getState();

    // Insert a piece
    const id = await store.insertRect({ w: 50, h: 50, x: 200, y: 200 });
    expect(id).toBeTruthy();

    // Check that spatial index was updated
    const stats = __spatialInternal.index?.stats();
    expect(stats?.items).toBeGreaterThanOrEqual(1);
  });

  it('movePiece updates spatial index', () => {
    const store = useSceneStore.getState();
    const layerId = store.scene.layerOrder[0];
    const materialId = Object.keys(store.scene.materials)[0];

    // Add a piece
    const id = store.addRectPiece(layerId, materialId, 40, 40, 100, 100);

    // Move the piece
    store.movePiece(id, 200, 200);

    // Spatial index should still have 1 item (updated, not removed)
    const stats = __spatialInternal.index?.stats();
    expect(stats?.items).toBe(1);
  });

  it('updateResize updates spatial index', () => {
    const store = useSceneStore.getState();
    const layerId = store.scene.layerOrder[0];
    const materialId = Object.keys(store.scene.materials)[0];

    // Add a piece
    const id = store.addRectPiece(layerId, materialId, 40, 40, 100, 100);

    // Start resize
    store.startResize(id, 'e', { x: 140, y: 120 });

    // Update resize (drag right edge)
    store.updateResize({ x: 160, y: 120 });

    // Spatial index should still have 1 item (updated)
    const stats = __spatialInternal.index?.stats();
    expect(stats?.items).toBe(1);

    // Commit resize
    store.endResize(true);

    // Still 1 item
    expect(__spatialInternal.index?.stats().items).toBe(1);
  });

  it.skip('deleteSelected removes from spatial index', () => {
    const store = useSceneStore.getState();
    const layerId = store.scene.layerOrder[0];
    const materialId = Object.keys(store.scene.materials)[0];

    // Add two more pieces
    const id1 = store.addRectPiece(layerId, materialId, 40, 40, 100, 100);
    const id2 = store.addRectPiece(layerId, materialId, 40, 40, 200, 100);

    // Record count before delete
    const beforeDelete = __spatialInternal.index?.stats().items ?? 0;

    // Select and delete first piece
    store.selectPiece(id1);
    store.deleteSelected();

    // Should have 1 fewer item
    const afterDelete = __spatialInternal.index?.stats().items ?? 0;
    expect(afterDelete).toBe(beforeDelete - 1);
  });

  it('flag OFF does not sync to spatial index', () => {
    // Disable flag
    window.__flags = { USE_GLOBAL_SPATIAL: false };
    __spatialInternal.resetForTest();

    const store = useSceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    const layerId = store.scene.layerOrder[0];
    const materialId = Object.keys(store.scene.materials)[0];

    // Add a piece
    store.addRectPiece(layerId, materialId, 40, 40, 100, 100);

    // Spatial index should NOT be created when flag is OFF
    const stats = __spatialInternal.index?.stats();
    expect(stats).toBeUndefined();
  });
});
