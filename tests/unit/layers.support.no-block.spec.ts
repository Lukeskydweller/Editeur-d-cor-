import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { ID } from '../../src/types/scene';

/**
 * Tests to ensure support validation never sets hasBlock=true.
 *
 * Key requirement (from spec):
 * - Support issues should only drive data-ghost='1' (visual feedback)
 * - Support should NEVER cause hasBlock=true (pieces remain manipulable)
 * - Support problems have severity: 'WARN', not 'BLOCK'
 */
describe('layers: support never causes hasBlock', () => {
  let C1: ID, C2: ID, C3: ID;
  let mat: ID;

  beforeEach(() => {
    // Reset Zustand store between tests
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

  describe('C2 unsupported → ghost but no block', () => {
    it('drag C2 off C1 support → hasBlock=false during drag', () => {
      let store = useSceneStore.getState();

      // C1: base piece at (50, 50) size 60×60
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);
      expect(c1Base).not.toBe('');

      // Get fresh state after C1 (unlocks C2)
      store = useSceneStore.getState();

      // C2: piece fully on C1 at (60, 60) size 40×40
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);
      expect(c2Piece).not.toBe('');

      // Get fresh state
      store = useSceneStore.getState();

      // Select and start drag
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Drag C2 off C1 support (move right by 80mm, now at x=140)
      // C1 extends from 50 to 110, C2 at 140-180 is completely off support
      store.updateDrag(80, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // During drag, validation only checks same-layer collisions, not support
      // So dragging.candidate.valid should be true (no same-layer collision)
      const dragging = state.ui.dragging;
      expect(dragging).toBeDefined();
      if (dragging) {
        expect(dragging.candidate?.valid).toBe(true);
      }

      // No ghost during drag (ghost only for collisions, not support)
      const ghost = state.ui.ghost;
      expect(ghost).toBeUndefined();
    });
  });

  describe('committed ghost (support-driven) never blocks', () => {
    it('C2 partially off C1 → isGhost=true but hasBlock=false', async () => {
      let store = useSceneStore.getState();

      // C1: base piece at (50, 50) size 60×60 (extends to 110, 110)
      store.setActiveLayer(C1);
      const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

      // Get fresh state after C1 (unlocks C2)
      store = useSceneStore.getState();

      // C2: piece partially off C1 support at (90, 50) size 60×60 (extends to 150, 110)
      // C1 only goes to 110, so C2 extends 40mm beyond support
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 90, 50, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Piece should exist
      const piece = state.scene.pieces[c2Piece];
      expect(piece).toBeDefined();

      // Validate the scene
      const { validateAll } = await import('../../src/core/geo/validateAll');
      const { projectDraftToV1 } = await import('../../src/sync/projector');

      const sceneV1 = projectDraftToV1({ scene: state.scene });
      const problems = await validateAll(sceneV1);

      // Find support problems for this piece
      const supportProblems = problems.filter(
        (p) => p.pieceId === c2Piece && p.code === 'unsupported_above',
      );

      // Should have at least one unsupported problem (not fully supported)
      expect(supportProblems.length).toBeGreaterThan(0);

      // All support problems should be WARN, not BLOCK
      for (const prob of supportProblems) {
        expect(prob.severity).toBe('WARN');
      }

      // Verify hasBlock would be false (no BLOCK severity problems for this piece)
      const blockProblems = problems.filter((p) => p.pieceId === c2Piece && p.severity === 'BLOCK');
      expect(blockProblems.length).toBe(0);
    });
  });
});
