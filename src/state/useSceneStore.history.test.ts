import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSceneStore } from './useSceneStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useSceneStore - history and autosave', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useSceneStore.setState({
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
      },
      ui: {
        selectedId: undefined,
        selectedIds: undefined,
        primaryId: undefined,
        flashInvalidAt: undefined,
        dragging: undefined,
        marquee: undefined,
        snap10mm: true,
        guides: undefined,
        history: {
          past: [],
          future: [],
          limit: 100,
        },
      },
    });
  });

  describe('undo/redo with duplicateSelected', () => {
    it('duplicateSelected then undo reverts state', () => {
      const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected, undo } =
        useSceneStore.getState();

      // Setup: create layer, material, piece
      addLayer('Layer 1');
      const [layerId] = useSceneStore.getState().scene.layerOrder;
      const materialId = addMaterial({ name: 'Mat1', oriented: false });
      addRectPiece(layerId, materialId, 100, 50, 10, 10);

      const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces1.length).toBe(1);

      selectPiece(pieces1[0]);
      duplicateSelected();

      const pieces2 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces2.length).toBe(2);

      // Undo
      undo();

      const pieces3 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces3.length).toBe(1);
      expect(pieces3[0]).toBe(pieces1[0]);
    });

    it('undo then redo reapplies state', () => {
      const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected, undo, redo } =
        useSceneStore.getState();

      addLayer('Layer 1');
      const [layerId] = useSceneStore.getState().scene.layerOrder;
      const materialId = addMaterial({ name: 'Mat1', oriented: false });
      addRectPiece(layerId, materialId, 100, 50, 10, 10);

      const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
      selectPiece(pieces1[0]);
      duplicateSelected();

      const pieces2 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces2.length).toBe(2);

      undo();
      const pieces3 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces3.length).toBe(1);

      redo();
      const pieces4 = Object.keys(useSceneStore.getState().scene.pieces);
      expect(pieces4.length).toBe(2);
    });
  });

  describe('undo/redo with nudgeSelected', () => {
    it('nudgeSelected pushes to history only if moved', () => {
      const { addLayer, addMaterial, addRectPiece, selectPiece, nudgeSelected, undo } =
        useSceneStore.getState();

      addLayer('L1');
      const [layerId] = useSceneStore.getState().scene.layerOrder;
      const materialId = addMaterial({ name: 'Mat1', oriented: false });
      addRectPiece(layerId, materialId, 100, 50, 10, 10);

      const pieces = Object.keys(useSceneStore.getState().scene.pieces);
      selectPiece(pieces[0]);

      const originalPos = { ...useSceneStore.getState().scene.pieces[pieces[0]].position };

      nudgeSelected(10, 10);

      const newPos = useSceneStore.getState().scene.pieces[pieces[0]].position;
      expect(newPos.x).toBe(originalPos.x + 10);
      expect(newPos.y).toBe(originalPos.y + 10);

      undo();

      const restoredPos = useSceneStore.getState().scene.pieces[pieces[0]].position;
      expect(restoredPos.x).toBe(originalPos.x);
      expect(restoredPos.y).toBe(originalPos.y);
    });
  });

  describe('history FIFO limit', () => {
    it('past length is capped at limit', () => {
      const { addRectAtCenter, deleteSelected, selectPiece } = useSceneStore.getState();

      // Set a low limit for testing
      useSceneStore.setState({
        ui: {
          ...useSceneStore.getState().ui,
          history: {
            past: [],
            future: [],
            limit: 5,
          },
        },
      });

      // Perform 10 addRectAtCenter operations (each pushes to history)
      for (let i = 0; i < 10; i++) {
        addRectAtCenter(50, 50);
      }

      const history = useSceneStore.getState().ui.history;
      expect(history?.past.length).toBe(5);
    });
  });

  describe('autosave', () => {
    it('autosave is called after mutation', () => {
      const { addRectAtCenter } = useSceneStore.getState();

      // addRectAtCenter is a commit action that should trigger autosave
      addRectAtCenter(100, 50);

      const saved = localStorageMock.getItem('editeur.scene.v1');
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.scene).toBeDefined();
      expect(Object.keys(parsed.scene.pieces).length).toBe(1);
    });

    it('restore from autosave on boot', () => {
      const { addRectAtCenter } = useSceneStore.getState();

      // Create a scene using a commit action
      addRectAtCenter(100, 50);

      const saved = localStorageMock.getItem('editeur.scene.v1');
      expect(saved).not.toBeNull();

      // Clear state
      useSceneStore.setState({
        scene: {
          id: 'empty',
          createdAt: new Date().toISOString(),
          size: { w: 600, h: 600 },
          materials: {},
          layers: {},
          pieces: {},
          layerOrder: [],
        },
        ui: {
          selectedId: undefined,
          selectedIds: undefined,
          primaryId: undefined,
          flashInvalidAt: undefined,
          dragging: undefined,
          marquee: undefined,
          snap10mm: true,
          guides: undefined,
          history: {
            past: [],
            future: [],
            limit: 100,
          },
        },
      });

      // Call initSceneWithDefaults which should restore
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const restoredScene = useSceneStore.getState().scene;
      expect(Object.keys(restoredScene.pieces).length).toBe(1);
      // ensureFixedLayerIds creates C1/C2/C3 + migration clamps to exactly 3 layers
      expect(Object.keys(restoredScene.layers).length).toBe(3);
      expect(Object.keys(restoredScene.materials).length).toBe(1);
      // Verify fixedLayerIds are set after restore
      expect(restoredScene.fixedLayerIds).toBeDefined();
    });
  });

  describe('selection preservation', () => {
    it('selection is preserved in history snapshots', () => {
      const { addLayer, addMaterial, addRectPiece, selectPiece, nudgeSelected, undo } =
        useSceneStore.getState();

      addLayer('L1');
      const [l1] = useSceneStore.getState().scene.layerOrder;

      const materialId = addMaterial({ name: 'Mat1', oriented: false });
      addRectPiece(l1, materialId, 100, 50, 100, 100);

      const pieces = Object.keys(useSceneStore.getState().scene.pieces);
      selectPiece(pieces[0]);

      expect(useSceneStore.getState().ui.selectedId).toBe(pieces[0]);

      const originalPos = { ...useSceneStore.getState().scene.pieces[pieces[0]].position };

      // Move piece (pushes to history)
      nudgeSelected(10, 10);

      // Selection should still be there
      expect(useSceneStore.getState().ui.selectedId).toBe(pieces[0]);

      undo();

      // Selection should be restored and piece moved back
      expect(useSceneStore.getState().ui.selectedId).toBe(pieces[0]);
      const restoredPos = useSceneStore.getState().scene.pieces[pieces[0]].position;
      expect(restoredPos.x).toBe(originalPos.x);
      expect(restoredPos.y).toBe(originalPos.y);
    });
  });
});
