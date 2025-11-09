import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { ID } from '../../src/types/scene';

/**
 * Tests for same-layer drag validation.
 *
 * Key behaviors:
 * - Cross-layer freedom: C2 over C1, C3 over C2 → no BLOCK
 * - Intra-layer collision: C1/C1, C2/C2, C3/C3 → BLOCK
 * - Support: lack of support shows as data-ghost="1" but never blocks drag
 */
describe('drag: same-layer validation only', () => {
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
    // (initSceneWithDefaults creates a 120×80mm piece on C1 at position 40,40)
    // We need to manually clear pieces and update layer.pieces arrays
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
    it('drag C2 over C1 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place piece at (50, 50) with size 60×60
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);
      expect(c1Piece).not.toBe(''); // Verify piece was created

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place piece at (150, 50) with size 60×60
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 150, 50, 0);
      expect(c2Piece).not.toBe(''); // Verify piece was created

      // Verify pieces are on different layers
      store = useSceneStore.getState();
      expect(store.scene.pieces[c1Piece]?.layerId).toBe(C1);
      expect(store.scene.pieces[c2Piece]?.layerId).toBe(C2);

      // Select C2 and start drag
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Drag C2 to overlap C1 (dx = -100, dy = 0)
      store.updateDrag(-100, 0);

      // Get fresh state after drag
      const state = useSceneStore.getState();

      // Candidate should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C1 over C2 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place piece first (to unlock C2)
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 150, 50, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place piece
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 50, 50, 0);

      // Get fresh state and select C1, then drag it over C2
      store = useSceneStore.getState();
      store.selectPiece(c1Piece);
      store.beginDrag(c1Piece);
      store.updateDrag(-100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C3 over C2 → no BLOCK (different layers)', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place piece first (to unlock C2)
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 200, 200, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place piece (to unlock C3)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 50, 50, 0);

      // Get fresh state after C2 piece (unlocks C3)
      store = useSceneStore.getState();

      // C3: set active layer and place piece at different position
      store.setActiveLayer(C3);
      const c3Piece = store.addRectPiece(C3, mat, 60, 60, 150, 50, 0);

      // Get fresh state and drag C3 over C2
      store = useSceneStore.getState();
      store.selectPiece(c3Piece);
      store.beginDrag(c3Piece);
      store.updateDrag(-100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });
  });

  describe('intra-layer collision blocking', () => {
    it('drag C2 over C2 → BLOCK (same layer collision)', () => {
      let store = useSceneStore.getState();

      // C1: add dummy piece to unlock C2
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 300, 300, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place two pieces
      store.setActiveLayer(C2);
      const c2PieceA = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);
      const c2PieceB = store.addRectPiece(C2, mat, 60, 60, 200, 100, 0);

      // Get fresh state and drag piece B to overlap piece A
      store = useSceneStore.getState();
      store.selectPiece(c2PieceB);
      store.beginDrag(c2PieceB);
      store.updateDrag(-100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });

    it('drag C1 over C1 → BLOCK (same layer collision)', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place two pieces
      store.setActiveLayer(C1);
      const c1PieceA = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);
      const c1PieceB = store.addRectPiece(C1, mat, 60, 60, 200, 100, 0);

      // Drag piece B to overlap piece A (from 200 to 100, delta = -100)
      store.selectPiece(c1PieceB);
      store.beginDrag(c1PieceB);
      store.updateDrag(-100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });

    it('drag C3 over C3 → BLOCK (same layer collision)', () => {
      let store = useSceneStore.getState();

      // C3: set active layer and place two pieces
      store.setActiveLayer(C3);
      const c3PieceA = store.addRectPiece(C3, mat, 60, 60, 100, 100, 0);
      const c3PieceB = store.addRectPiece(C3, mat, 60, 60, 200, 100, 0);

      // Drag piece B to overlap piece A (from 200 to 100, delta = -100)
      store.selectPiece(c3PieceB);
      store.beginDrag(c3PieceB);
      store.updateDrag(-100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });
  });

  describe('group drag: cross-layer freedom', () => {
    it('drag C2 group over C1 pieces → no BLOCK', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place pieces
      store.setActiveLayer(C1);
      const c1A = store.addRectPiece(C1, mat, 40, 40, 50, 50, 0);
      const c1B = store.addRectPiece(C1, mat, 40, 40, 100, 50, 0);

      // Get fresh state after C1 pieces (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place two pieces for group
      store.setActiveLayer(C2);
      const c2A = store.addRectPiece(C2, mat, 40, 40, 50, 150, 0);
      const c2B = store.addRectPiece(C2, mat, 40, 40, 100, 150, 0);

      // Get fresh state and select both C2 pieces (group)
      store = useSceneStore.getState();
      store.setSelection([c2A, c2B]);
      store.beginDrag(c2A);

      // Drag group over C1 pieces (dy = -100)
      store.updateDrag(0, -100);

      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C2 group with internal collision → no self-blocking', () => {
      let store = useSceneStore.getState();

      // C2: set active layer and place two adjacent pieces
      store.setActiveLayer(C2);
      const c2A = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);
      const c2B = store.addRectPiece(C2, mat, 60, 60, 160, 100, 0);

      // Get fresh state and select both (group)
      store = useSceneStore.getState();
      store.setSelection([c2A, c2B]);
      store.beginDrag(c2A);

      // Drag group by small delta (should not block on internal group members)
      store.updateDrag(10, 10);

      const state = useSceneStore.getState();

      // Should be valid (ignores internal group collisions)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });
  });

  describe('support-driven ghosts: never block drag', () => {
    it('drag C2 to unsupported position → no BLOCK, only ghost after drop', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place a piece
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place a piece on C1
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);

      // Get fresh state and drag C2 to partially unsupported position
      store = useSceneStore.getState();
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);
      store.updateDrag(30, 0); // Moves to 90, extends beyond C1 right edge at 110

      const state = useSceneStore.getState();

      // Drag should NOT be blocked (support is not a BLOCK reason)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);

      // End drag
      store.endDrag();

      // After drop, piece should be ghost (not fully supported)
      // This is tested by data-ghost attribute in E2E tests
      const finalState = useSceneStore.getState();
      const finalPiece = finalState.scene.pieces[c2Piece];
      expect(finalPiece).toBeDefined();
    });

    it('drag C2 completely off C1 support → no BLOCK, only ghost', () => {
      let store = useSceneStore.getState();

      // C1: set active layer and place a piece
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: set active layer and place a piece on C1
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);

      // Get fresh state and drag C2 completely off C1
      store = useSceneStore.getState();
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);
      store.updateDrag(100, 100); // Moves to 160,160 - far from C1

      const state = useSceneStore.getState();

      // Should NOT be blocked (support is not blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);

      // End drag and verify piece exists
      store.endDrag();
      const finalState = useSceneStore.getState();
      expect(finalState.scene.pieces[c2Piece]).toBeDefined();
    });
  });
});
