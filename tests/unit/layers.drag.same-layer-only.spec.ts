import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { ID } from '../../src/types/scene';

describe('drag: same-layer validation only', () => {
  let C1: ID, C2: ID, C3: ID;
  let mat: ID;

  beforeEach(() => {
    // Clear localStorage to ensure clean state
    localStorage.clear();

    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(600, 400);

    // Get state AFTER initSceneWithDefaults (Zustand updates are synchronous)
    const state = useSceneStore.getState();
    const fixed = state.scene.fixedLayerIds;
    if (!fixed) {
      console.error('initSceneWithDefaults did not create fixedLayerIds');
      console.error('scene.layerOrder:', state.scene.layerOrder);
      console.error('scene.layers:', Object.keys(state.scene.layers));
      throw new Error('No fixed layers');
    }

    C1 = fixed.C1;
    C2 = fixed.C2;
    C3 = fixed.C3;

    mat = Object.values(state.scene.materials)[0].id;
  });

  describe('cross-layer freedom', () => {
    it('drag C2 over C1 → no BLOCK (different layers)', () => {
      const store = useSceneStore.getState();

      console.log('C1 pieces BEFORE add:', store.scene.layers[C1]?.pieces);
      console.log('C2 pieces BEFORE add:', store.scene.layers[C2]?.pieces);

      // C1: place a piece at (50, 50) with size 60×60
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);
      let freshState = useSceneStore.getState();
      console.log('c1Piece ID:', c1Piece);
      console.log('C1 pieces after add:', freshState.scene.layers[C1]?.pieces);

      // C2: place a piece at different position (150, 50) with size 60×60
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 150, 50, 0);
      freshState = useSceneStore.getState();
      console.log('c2Piece ID:', c2Piece);
      console.log('C2 pieces after add:', freshState.scene.layers[C2]?.pieces);

      // Verify initial positions and layerIds
      freshState = useSceneStore.getState();
      console.log(
        'c1Piece layerId:',
        freshState.scene.pieces[c1Piece]?.layerId,
        'Expected C1:',
        C1,
      );
      console.log(
        'c2Piece layerId:',
        freshState.scene.pieces[c2Piece]?.layerId,
        'Expected C2:',
        C2,
      );

      // Select C2 and start drag
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Enable debug logging
      (window as any).__DBG_DRAG__ = true;

      // Drag C2 to overlap C1 (dx = -100, dy = 0)
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Debug logging
      if (state.ui.dragging?.candidate?.valid === false) {
        console.log('FAILED: drag C2 over C1');
        console.log('c2Piece layerId:', state.scene.pieces[c2Piece]?.layerId);
        console.log('c1Piece layerId:', state.scene.pieces[c1Piece]?.layerId);
        console.log('candidate:', JSON.stringify(state.ui.dragging?.candidate, null, 2));
      }

      // Candidate should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C1 over C2 → no BLOCK (different layers)', () => {
      const store = useSceneStore.getState();

      // C2: place a piece first
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 50, 50, 0);

      // C1: place a piece at different position
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 150, 50, 0);

      // Select C1 and drag it over C2
      store.selectPiece(c1Piece);
      store.beginDrag(c1Piece);
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C3 over C2 → no BLOCK (different layers)', () => {
      const store = useSceneStore.getState();

      // C2: place a piece
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 50, 50, 0);

      // C3: place a piece at different position
      store.setActiveLayer(C3);
      const c3Piece = store.addRectPiece(C3, mat, 60, 60, 150, 50, 0);

      // Drag C3 over C2
      store.selectPiece(c3Piece);
      store.beginDrag(c3Piece);
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });
  });

  describe('intra-layer collision blocking', () => {
    it('drag C2 over C2 → BLOCK (same layer collision)', () => {
      const store = useSceneStore.getState();

      // C2: place two pieces
      store.setActiveLayer(C2);
      const c2PieceA = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);
      const c2PieceB = store.addRectPiece(C2, mat, 60, 60, 200, 100, 0);

      // Drag piece B to overlap piece A (from 200 to 100, delta = -100)
      store.selectPiece(c2PieceB);
      store.beginDrag(c2PieceB);
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });

    it('drag C1 over C1 → BLOCK (same layer collision)', () => {
      const store = useSceneStore.getState();

      // C1: place two pieces
      store.setActiveLayer(C1);
      const c1PieceA = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);
      const c1PieceB = store.addRectPiece(C1, mat, 60, 60, 200, 100, 0);

      // Drag piece B to overlap piece A (from 200 to 100, delta = -100)
      store.selectPiece(c1PieceB);
      store.beginDrag(c1PieceB);
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });

    it('drag C3 over C3 → BLOCK (same layer collision)', () => {
      const store = useSceneStore.getState();

      // C3: place two pieces
      store.setActiveLayer(C3);
      const c3PieceA = store.addRectPiece(C3, mat, 60, 60, 100, 100, 0);
      const c3PieceB = store.addRectPiece(C3, mat, 60, 60, 200, 100, 0);

      // Drag piece B to overlap piece A (from 200 to 100, delta = -100)
      store.selectPiece(c3PieceB);
      store.beginDrag(c3PieceB);
      store.updateDrag(-100, 0);

      const state = useSceneStore.getState();

      // Should be invalid (same-layer collision)
      expect(state.ui.dragging?.candidate?.valid).toBe(false);
    });
  });

  describe('group drag: cross-layer freedom', () => {
    it('drag C2 group over C1 pieces → no BLOCK', () => {
      const store = useSceneStore.getState();

      // C1: place pieces
      store.setActiveLayer(C1);
      const c1A = store.addRectPiece(C1, mat, 40, 40, 50, 50, 0);
      const c1B = store.addRectPiece(C1, mat, 40, 40, 100, 50, 0);

      // C2: place two pieces for group
      store.setActiveLayer(C2);
      const c2A = store.addRectPiece(C2, mat, 40, 40, 50, 150, 0);
      const c2B = store.addRectPiece(C2, mat, 40, 40, 100, 150, 0);

      // Select both C2 pieces (group)
      store.setSelection([c2A, c2B]);
      store.beginDrag(c2A);

      // Drag group over C1 pieces (dy = -100)
      store.updateDrag(0, -100);

      const state = useSceneStore.getState();

      // Should be valid (no cross-layer blocking)
      expect(state.ui.dragging?.candidate?.valid).toBe(true);
    });

    it('drag C2 group with internal collision → no self-blocking', () => {
      const store = useSceneStore.getState();

      // C2: place two adjacent pieces
      store.setActiveLayer(C2);
      const c2A = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);
      const c2B = store.addRectPiece(C2, mat, 60, 60, 160, 100, 0);

      // Select both (group)
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
      const store = useSceneStore.getState();

      // C1: place a piece
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

      // C2: place a piece on C1
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);

      // Drag C2 to partially unsupported position (extends beyond C1)
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
      const store = useSceneStore.getState();

      // C1: place a piece
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

      // C2: place a piece on C1
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);

      // Drag C2 completely off C1 (to area with no support)
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
