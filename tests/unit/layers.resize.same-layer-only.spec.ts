import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { ID } from '../../src/types/scene';

/**
 * Tests for same-layer resize validation.
 *
 * Key behaviors:
 * - Cross-layer freedom: C2 over C1, C3 over C2 → no BLOCK
 * - Intra-layer collision: C1/C1, C2/C2, C3/C3 → BLOCK
 */
describe('resize: same-layer validation only', () => {
  let C1: ID, C2: ID, C3: ID;
  let mat: ID;

  beforeEach(() => {
    // Reset Zustand store between tests (recommended pattern)
    // https://docs.pmnd.rs/zustand/guides/testing
    localStorage.clear();

    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(600, 400);

    // Get fresh state after initialization
    let state = useSceneStore.getState();
    const fixed = state.scene.fixedLayerIds;
    if (!fixed) {
      throw new Error('No fixed layers after initSceneWithDefaults');
    }

    C1 = fixed.C1;
    C2 = fixed.C2;
    C3 = fixed.C3;

    mat = Object.values(state.scene.materials)[0].id;

    // Remove default pieces created by initSceneWithDefaults
    useSceneStore.setState((prev) => ({
      ...prev,
      scene: {
        ...prev.scene,
        pieces: {},
        layers: {
          ...prev.scene.layers,
          [C1]: { ...prev.scene.layers[C1], pieces: [] },
          [C2]: { ...prev.scene.layers[C2], pieces: [] },
          [C3]: { ...prev.scene.layers[C3], pieces: [] },
        },
      },
    }));

    // Verify clean state
    state = useSceneStore.getState();
    const pieceCount = Object.keys(state.scene.pieces).length;
    if (pieceCount !== 0) {
      throw new Error(`Expected 0 pieces after cleanup, found ${pieceCount}`);
    }
  });

  describe('cross-layer freedom', () => {
    it('resize C2 into C1 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: place piece at (50, 50) with size 60×60
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);
      expect(c1Piece).not.toBe('');

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: place piece at (120, 50) with size 40×40 (adjacent to C1, gap = 10)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 120, 50, 0);
      expect(c2Piece).not.toBe('');

      // Verify pieces are on different layers
      store = useSceneStore.getState();
      expect(store.scene.pieces[c1Piece]?.layerId).toBe(C1);
      expect(store.scene.pieces[c2Piece]?.layerId).toBe(C2);

      // Select C2 and start resize from right edge
      store.selectPiece(c2Piece);
      store.startResize(c2Piece, 'e');

      // Resize C2 to the left to overlap C1 (expand width by 20mm)
      store.updateResize(-20, 0);

      // Get fresh state after resize
      const state = useSceneStore.getState();

      // Should not have BLOCK from cross-layer collision
      const resizing = state.ui.resizing;
      expect(resizing).toBeDefined();
      if (!resizing) return;

      // Ghost should not show BLOCK (no cross-layer blocking)
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(false);
    });

    it('resize C1 into C2 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: place piece at (50, 50) with size 40×40
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 40, 40, 50, 50, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: place piece at (100, 50) with size 60×60 (adjacent to C1, gap = 10)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 100, 50, 0);

      // Get fresh state and select C1, then resize it into C2
      store = useSceneStore.getState();
      store.selectPiece(c1Piece);
      store.startResize(c1Piece, 'e');

      // Resize C1 to the right to overlap C2 (expand width by 20mm)
      store.updateResize(20, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should not have BLOCK from cross-layer collision
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(false);
    });

    it('resize C3 into C2 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: place dummy piece to unlock C2
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 200, 200, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: place piece at (50, 50) with size 60×60 (to unlock C3)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 50, 50, 0);

      // Get fresh state after C2 piece (unlocks C3)
      store = useSceneStore.getState();

      // C3: place piece at (120, 50) with size 40×40 (adjacent to C2)
      store.setActiveLayer(C3);
      const c3Piece = store.addRectPiece(C3, mat, 40, 40, 120, 50, 0);

      // Get fresh state and resize C3 into C2
      store = useSceneStore.getState();
      store.selectPiece(c3Piece);
      store.startResize(c3Piece, 'w');

      // Resize C3 to the left to overlap C2 (expand width by 20mm)
      store.updateResize(-20, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should not have BLOCK from cross-layer collision
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(false);
    });
  });

  describe('intra-layer collision blocking', () => {
    it('resize C2 into C2 → BLOCK (same layer collision)', async () => {
      let store = useSceneStore.getState();

      // C1: add dummy piece to unlock C2
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 300, 300, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: place two pieces on same layer
      store.setActiveLayer(C2);
      const c2PieceA = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);
      const c2PieceB = store.addRectPiece(C2, mat, 40, 40, 170, 100, 0);

      // Get fresh state and resize piece B into piece A
      store = useSceneStore.getState();
      store.selectPiece(c2PieceB);
      store.startResize(c2PieceB, 'w', { x: 170, y: 120 });

      // Resize to the left to overlap piece A (move pointer left by 20mm)
      store.updateResize({ x: 150, y: 120 });

      // Wait for async validation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get fresh state
      const state = useSceneStore.getState();

      // Should have BLOCK from same-layer collision
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(true);
    });

    it('resize C1 into C1 → BLOCK (same layer collision)', async () => {
      let store = useSceneStore.getState();

      // C1: place two pieces on same layer
      store.setActiveLayer(C1);
      const c1PieceA = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);
      const c1PieceB = store.addRectPiece(C1, mat, 40, 40, 170, 100, 0);

      // Resize piece B into piece A
      store.selectPiece(c1PieceB);
      store.startResize(c1PieceB, 'w', { x: 170, y: 120 });
      store.updateResize({ x: 150, y: 120 });

      // Wait for async validation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get fresh state
      const state = useSceneStore.getState();

      // Should have BLOCK from same-layer collision
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(true);
    });

    it('resize C3 into C3 → BLOCK (same layer collision)', async () => {
      let store = useSceneStore.getState();

      // C1: add dummy piece to unlock C2
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 300, 300, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: add dummy piece to unlock C3
      store.setActiveLayer(C2);
      const c2Dummy = store.addRectPiece(C2, mat, 30, 30, 350, 300, 0);

      // Get fresh state after C2 piece (unlocks C3)
      store = useSceneStore.getState();

      // C3: place two pieces on same layer
      store.setActiveLayer(C3);
      const c3PieceA = store.addRectPiece(C3, mat, 60, 60, 100, 100, 0);
      const c3PieceB = store.addRectPiece(C3, mat, 40, 40, 170, 100, 0);

      // Resize piece B into piece A
      store.selectPiece(c3PieceB);
      store.startResize(c3PieceB, 'w', { x: 170, y: 120 });
      store.updateResize({ x: 150, y: 120 });

      // Wait for async validation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get fresh state
      const state = useSceneStore.getState();

      // Should have BLOCK from same-layer collision
      const ghost = state.ui.ghost;
      const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
      expect(hasBlock).toBe(true);
    });
  });

  describe('resize commit blocking', () => {
    it('endResize with collision → rollback to origin', () => {
      let store = useSceneStore.getState();

      // C1: place two pieces on same layer
      store.setActiveLayer(C1);
      const c1PieceA = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);
      const c1PieceB = store.addRectPiece(C1, mat, 40, 40, 170, 100, 0);

      // Get fresh state and original size
      store = useSceneStore.getState();
      const originalSize = store.scene.pieces[c1PieceB].size.w;

      // Resize piece B into piece A
      store.selectPiece(c1PieceB);
      store.startResize(c1PieceB, 'w');
      store.updateResize(-20, 0);

      // Attempt to commit (should rollback)
      store.endResize();

      // Get fresh state
      const state = useSceneStore.getState();

      // Size should be rolled back to original
      expect(state.scene.pieces[c1PieceB].size.w).toBe(originalSize);

      // Toast should show block message (if present)
      if (state.ui.toast?.message) {
        expect(state.ui.toast.message).toContain('bloqué');
      }
    });
  });
});
