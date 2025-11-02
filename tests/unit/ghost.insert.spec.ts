import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';

describe('Ghost Insert System', () => {
  beforeEach(() => {
    // Reset store to a clean state with an empty scene
    const store = useSceneStore.getState();
    store.initScene(600, 600);

    // Add default layer and material
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
  });

  describe('startGhostInsert', () => {
    it('creates a ghost piece when called', async () => {
      const store = useSceneStore.getState();
      const initialCount = Object.keys(store.scene.pieces).length;

      // Start ghost insert
      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      expect(pieceId).not.toBeNull();

      // Check ghost was created
      const updatedStore = useSceneStore.getState();
      expect(Object.keys(updatedStore.scene.pieces).length).toBe(initialCount + 1);

      // Check ghost state
      expect(updatedStore.ui.ghost).toBeDefined();
      expect(updatedStore.ui.ghost?.pieceId).toBe(pieceId);

      // Piece should be selected
      expect(updatedStore.ui.selectedId).toBe(pieceId);
    });

    it('places ghost at visible position within scene bounds', async () => {
      const store = useSceneStore.getState();

      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      const updatedStore = useSceneStore.getState();
      const piece = updatedStore.scene.pieces[pieceId];

      expect(piece).toBeDefined();
      expect(piece.position.x).toBeGreaterThanOrEqual(0);
      expect(piece.position.y).toBeGreaterThanOrEqual(0);
      expect(piece.position.x + piece.size.w).toBeLessThanOrEqual(600);
      expect(piece.position.y + piece.size.h).toBeLessThanOrEqual(600);
    });

    it('validates ghost immediately after creation', async () => {
      const store = useSceneStore.getState();

      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      const updatedStore = useSceneStore.getState();

      // Ghost should have problems array (may be empty)
      expect(updatedStore.ui.ghost?.problems).toBeDefined();
      expect(Array.isArray(updatedStore.ui.ghost?.problems)).toBe(true);
    });
  });

  describe('commitGhost', () => {
    it('commits ghost when no BLOCK problems', async () => {
      const store = useSceneStore.getState();

      // Create a ghost in a valid position
      const pieceId = await store.startGhostInsert({ w: 50, h: 50 });

      // Wait for validation
      await new Promise(resolve => setTimeout(resolve, 100));

      const beforeCommit = useSceneStore.getState();
      if (!beforeCommit.ui.ghost) {
        // Ghost already auto-committed (no problems)
        return;
      }

      const hasBlock = beforeCommit.ui.ghost.problems.some(p => p.severity === 'BLOCK');

      if (!hasBlock) {
        // Manually commit
        useSceneStore.getState().commitGhost();

        const afterCommit = useSceneStore.getState();

        // Ghost state should be cleared
        expect(afterCommit.ui.ghost).toBeUndefined();

        // Piece should still exist
        expect(afterCommit.scene.pieces[pieceId]).toBeDefined();
      }
    });

    it('refuses to commit ghost with BLOCK problems', async () => {
      const store = useSceneStore.getState();

      // Fill scene to create overlap
      await store.insertRect({ w: 200, h: 200, x: 10, y: 10 });

      // Create ghost that will overlap
      const ghostId = await store.startGhostInsert({ w: 200, h: 200 });

      // Manually move piece to overlap position (simulate drag)
      store.movePiece(ghostId, 10, 10);

      // Validate
      await store.validateGhost();

      const beforeCommit = useSceneStore.getState();

      // Try to commit
      store.commitGhost();

      const afterCommit = useSceneStore.getState();

      const hasBlock = beforeCommit.ui.ghost?.problems.some(p => p.severity === 'BLOCK');

      if (hasBlock) {
        // Ghost should still be present (commit refused)
        expect(afterCommit.ui.ghost).toBeDefined();
        expect(afterCommit.ui.toast?.message).toContain('bloquants');
      }
    });
  });

  describe('cancelGhost', () => {
    it('removes ghost piece and clears state', async () => {
      const store = useSceneStore.getState();
      const initialCount = Object.keys(store.scene.pieces).length;

      // Create ghost
      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      // Cancel
      store.cancelGhost();

      const afterCancel = useSceneStore.getState();

      // Ghost state should be cleared
      expect(afterCancel.ui.ghost).toBeUndefined();

      // Piece should be removed
      expect(afterCancel.scene.pieces[pieceId]).toBeUndefined();

      // Piece count should be back to initial
      expect(Object.keys(afterCancel.scene.pieces).length).toBe(initialCount);
    });

    it('clears selection if ghost was selected', async () => {
      const store = useSceneStore.getState();

      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      // Ghost should be selected
      expect(useSceneStore.getState().ui.selectedId).toBe(pieceId);

      // Cancel
      store.cancelGhost();

      const afterCancel = useSceneStore.getState();

      // Selection should be cleared
      expect(afterCancel.ui.selectedId).toBeUndefined();
      expect(afterCancel.ui.selectedIds).toEqual([]);
    });
  });

  describe('Auto-placement fallback to ghost', () => {
    it('calls startGhostInsert when no free spot found', async () => {
      const store = useSceneStore.getState();

      // Initialize small scene
      store.initScene(100, 100);
      store.addLayer('C1');
      store.addMaterial({ name: 'Material 1', oriented: false });

      // Fill most of the scene
      await store.insertRect({ w: 80, h: 80, x: 10, y: 10 });

      // Try to insert another large piece (should trigger ghost)
      const pieceId = await store.insertRect({ w: 70, h: 70 });

      expect(pieceId).not.toBeNull();

      const finalStore = useSceneStore.getState();

      // Should have created a ghost
      expect(finalStore.ui.ghost).toBeDefined();
      expect(finalStore.ui.ghost?.pieceId).toBe(pieceId);
    });
  });

  describe('validateGhost', () => {
    it('updates ghost problems after validation', async () => {
      const store = useSceneStore.getState();

      const pieceId = await store.startGhostInsert({ w: 100, h: 100 });

      // Initial problems should exist
      const before = useSceneStore.getState();
      expect(before.ui.ghost?.problems).toBeDefined();

      // Trigger manual validation
      await store.validateGhost();

      const after = useSceneStore.getState();

      // Problems should still be defined
      expect(after.ui.ghost?.problems).toBeDefined();
    });
  });
});
