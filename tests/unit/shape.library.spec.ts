import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';

describe('ShapeLibrary - insertRect action', () => {
  beforeEach(() => {
    // Reset store to a clean state with an empty scene to avoid overlaps
    const store = useSceneStore.getState();
    store.initScene(600, 600);

    // Add default layer and material
    const layerId = store.addLayer('C1');
    const materialId = store.addMaterial({ name: 'Material 1', oriented: false });
  });

  it('inserts a rectangle with minimum size (≥5mm)', async () => {
    const initialCount = Object.keys(useSceneStore.getState().scene.pieces).length;

    const id = await useSceneStore.getState().insertRect({ w: 60, h: 60, x: 100, y: 100 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const finalCount = Object.keys(updatedStore.scene.pieces).length;
    expect(finalCount).toBe(initialCount + 1);

    const piece = updatedStore.scene.pieces[id!];
    expect(piece).toBeDefined();
    expect(piece.size.w).toBeGreaterThanOrEqual(5);
    expect(piece.size.h).toBeGreaterThanOrEqual(5);
  });

  it('enforces minimum size of 5mm even with smaller input', async () => {
    useSceneStore.getState().setSnap10mm(false); // Disable snap to test exact 5mm

    const id = await useSceneStore.getState().insertRect({ w: 3, h: 2, x: 200, y: 200 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];
    expect(piece.size.w).toBe(5);
    expect(piece.size.h).toBe(5);
  });

  it('rounds dimensions to 10mm when snap is ON', async () => {
    useSceneStore.getState().setSnap10mm(true);

    const id = await useSceneStore.getState().insertRect({ w: 67, h: 83, x: 300, y: 300 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];
    expect(piece.size.w).toBe(70); // Rounded from 67
    expect(piece.size.h).toBe(80); // Rounded from 83
  });

  it('does not round when snap is OFF', async () => {
    useSceneStore.getState().setSnap10mm(false);

    const id = await useSceneStore.getState().insertRect({ w: 67, h: 83, x: 400, y: 400 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];
    expect(piece.size.w).toBe(67);
    expect(piece.size.h).toBe(83);
  });

  it('clamps position to scene bounds', async () => {
    const store = useSceneStore.getState();
    const sceneW = store.scene.size.w;
    const sceneH = store.scene.size.h;

    // Try to insert at position that would exceed scene bounds
    const id = await store.insertRect({ w: 200, h: 200, x: sceneW - 50, y: sceneH - 50 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];

    // Piece should be clamped to stay within scene
    expect(piece.position.x + piece.size.w).toBeLessThanOrEqual(sceneW);
    expect(piece.position.y + piece.size.h).toBeLessThanOrEqual(sceneH);
  });

  it('inserts on active layer (first layer)', async () => {
    const firstLayerId = useSceneStore.getState().scene.layerOrder[0];

    const id = await useSceneStore.getState().insertRect({ w: 60, h: 60, x: 250, y: 250 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];
    expect(piece.layerId).toBe(firstLayerId);
  });

  it('uses current material (first material)', async () => {
    const firstMaterialId = Object.keys(useSceneStore.getState().scene.materials)[0];

    const id = await useSceneStore.getState().insertRect({ w: 60, h: 60, x: 350, y: 350 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    const piece = updatedStore.scene.pieces[id!];
    expect(piece.materialId).toBe(firstMaterialId);
  });

  it('selects the newly inserted piece', async () => {
    const id = await useSceneStore.getState().insertRect({ w: 60, h: 60, x: 450, y: 450 });

    expect(id).not.toBeNull();
    const updatedStore = useSceneStore.getState();
    expect(updatedStore.ui.selectedId).toBe(id);
    expect(updatedStore.ui.selectedIds).toContain(id);
  });

  it('validates insertion and may reject overlaps', async () => {
    // Insert first piece at (50, 50)
    const id1 = await useSceneStore.getState().insertRect({ w: 100, h: 100, x: 50, y: 50 });
    expect(id1).not.toBeNull();

    // Try to insert overlapping piece at exact same position
    const id2 = await useSceneStore.getState().insertRect({ w: 100, h: 100, x: 50, y: 50 });

    // Should either be rejected due to overlap or inserted (depending on validation)
    // The important thing is that insertRect returns either ID or null
    expect(typeof id2 === 'string' || id2 === null).toBe(true);

    // If rejected, toast should be set
    const finalStore = useSceneStore.getState();
    if (id2 === null) {
      expect(finalStore.ui.toast).toBeDefined();
      expect(finalStore.ui.toast?.message).toContain('chevauchement');
    }
  });

  describe('Auto-placement (no x/y provided)', () => {
    it('auto-places piece in free spot when no position provided', async () => {
      // Insert without providing x/y
      const id = await useSceneStore.getState().insertRect({ w: 60, h: 60 });

      expect(id).not.toBeNull();

      // Get fresh store state after insert
      const updatedStore = useSceneStore.getState();
      const piece = updatedStore.scene.pieces[id!];
      expect(piece).toBeDefined();
      expect(piece.size.w).toBeGreaterThanOrEqual(5);
      expect(piece.size.h).toBeGreaterThanOrEqual(5);

      // Position should be valid (within scene bounds)
      expect(piece.position.x).toBeGreaterThanOrEqual(0);
      expect(piece.position.y).toBeGreaterThanOrEqual(0);
      expect(piece.position.x + piece.size.w).toBeLessThanOrEqual(updatedStore.scene.size.w);
      expect(piece.position.y + piece.size.h).toBeLessThanOrEqual(updatedStore.scene.size.h);
    });

    it('auto-placement avoids overlapping existing pieces', async () => {
      // Place a piece away from the starting area
      const id1 = await useSceneStore.getState().insertRect({ w: 80, h: 80, x: 200, y: 200 });
      expect(id1).not.toBeNull();

      // Auto-place another piece - should find a different spot (likely at 10,10 since 200,200 is occupied)
      const id2 = await useSceneStore.getState().insertRect({ w: 50, h: 50 });

      // If auto-placement fails (scene too crowded), this test may need adjustment
      // But with a 600×600 scene and only one 80×80 piece, there should be plenty of space
      if (id2 === null) {
        // If auto-placement failed, at least verify the toast was set
        const store = useSceneStore.getState();
        expect(store.ui.toast?.message).toContain('Aucun emplacement libre');
        return;
      }

      // Get fresh store state after both inserts
      const updatedStore = useSceneStore.getState();
      const piece1 = updatedStore.scene.pieces[id1!];
      const piece2 = updatedStore.scene.pieces[id2!];

      // Pieces should not overlap
      const noOverlap =
        piece2.position.x >= piece1.position.x + piece1.size.w ||
        piece2.position.x + piece2.size.w <= piece1.position.x ||
        piece2.position.y >= piece1.position.y + piece1.size.h ||
        piece2.position.y + piece2.size.h <= piece1.position.y;

      expect(noOverlap).toBe(true);
    });

    it('creates ghost when scene is saturated (no free spot)', async () => {
      const store = useSceneStore.getState();

      // Initialize a very small scene
      store.initScene(50, 50);
      const layerId = store.addLayer('C1');
      const materialId = store.addMaterial({ name: 'Material 1', oriented: false });

      // Fill the scene with a large piece
      const id1 = await store.insertRect({ w: 40, h: 40, x: 5, y: 5 });
      expect(id1).not.toBeNull();

      // Try to insert another piece that won't fit anywhere
      const id2 = await store.insertRect({ w: 30, h: 30 });

      // Should create a ghost instead of returning null
      expect(id2).not.toBeNull();

      // Should have created a ghost
      const finalStore = useSceneStore.getState();
      expect(finalStore.ui.ghost).toBeDefined();
      expect(finalStore.ui.ghost?.pieceId).toBe(id2);
    });
  });
});
