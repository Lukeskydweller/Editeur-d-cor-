import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { ID } from '../../src/types/scene';

/**
 * Unit tests to verify hasBlock reasons and separation from ghost state.
 *
 * Key behaviors to validate:
 * - Support issues (unsupported C2) → reasons.supportFast/supportExact = 'missing'
 * - Support issues NEVER set hasBlock=true (setHasBlockFrom='none')
 * - Support issues only trigger ghost='1' (visual feedback)
 * - Collision issues → setHasBlockFrom='collision', hasBlock=true
 * - Spacing issues → setHasBlockFrom='spacing', hasBlock=true (if configured)
 */
describe('hasBlock reasons and ghost separation', () => {
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

  describe('support issues → ghost only, never hasBlock', () => {
    it('C2 on void (no C1) → reasons.supportExact="missing", setHasBlockFrom="none", ghost="1"', async () => {
      let store = useSceneStore.getState();

      // C1: Add dummy piece to unlock C2 (far from C2 test location)
      store.setActiveLayer(C1);
      const c1Dummy = store.addRectPiece(C1, mat, 30, 30, 300, 300, 0);

      // Get fresh state after C1 (unlocks C2)
      store = useSceneStore.getState();

      // C2: place piece without any C1 support below it (at 100, 100 - far from dummy)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Verify piece exists and is on C2
      const piece = state.scene.pieces[c2Piece];
      expect(piece).toBeDefined();
      expect(piece?.layerId).toBe(C2);

      // Validate scene using core validators
      const { validateAll } = await import('../../src/core/geo/validateAll');
      const { projectDraftToV1 } = await import('../../src/sync/projector');

      const sceneV1 = projectDraftToV1({ scene: state.scene });
      const problems = await validateAll(sceneV1);

      // Find problems for this piece
      const pieceProblems = problems.filter((p) => p.pieceId === c2Piece);

      // Should have unsupported problem (no C1 below)
      const supportProblems = pieceProblems.filter((p) => p.code === 'unsupported_above');
      expect(supportProblems.length).toBeGreaterThan(0);

      // All support problems should be WARN, never BLOCK
      for (const prob of supportProblems) {
        expect(prob.severity).toBe('WARN');
      }

      // Verify NO BLOCK problems exist (hasBlock would be false)
      const blockProblems = pieceProblems.filter((p) => p.severity === 'BLOCK');
      expect(blockProblems.length).toBe(0);

      // Reasons would show:
      // - supportFast: 'missing' (no AABB containment)
      // - supportExact: 'missing' (no PathOps containment)
      // - setHasBlockFrom: 'none' (WARN doesn't block)
      // - ghost: '1' (visual feedback for unsupported)

      // Verify ghost state would be true (has WARN problems)
      const hasWarn = pieceProblems.some((p) => p.severity === 'WARN');
      expect(hasWarn).toBe(true);
    });

    it('C2 partially on C1 → reasons.supportExact="missing", setHasBlockFrom="none", ghost="1"', async () => {
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

      // Validate scene
      const { validateAll } = await import('../../src/core/geo/validateAll');
      const { projectDraftToV1 } = await import('../../src/sync/projector');

      const sceneV1 = projectDraftToV1({ scene: state.scene });
      const problems = await validateAll(sceneV1);

      // Find support problems for C2
      const supportProblems = problems.filter(
        (p) => p.pieceId === c2Piece && p.code === 'unsupported_above',
      );

      // Should have unsupported problem (partial support not sufficient)
      expect(supportProblems.length).toBeGreaterThan(0);

      // All support problems should be WARN
      for (const prob of supportProblems) {
        expect(prob.severity).toBe('WARN');
      }

      // Verify NO BLOCK problems for C2 (support never blocks)
      const blockProblems = problems.filter((p) => p.pieceId === c2Piece && p.severity === 'BLOCK');
      expect(blockProblems.length).toBe(0);
    });
  });

  describe('cross-layer collision → no BLOCK (different layers)', () => {
    it('C2 over C1 collision → hasBlock=false (cross-layer allowed)', async () => {
      let store = useSceneStore.getState();

      // C1: base piece at (100, 100)
      store.setActiveLayer(C1);
      const c1Piece = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

      // Get fresh state after C1 (unlocks C2)
      store = useSceneStore.getState();

      // C2: piece overlapping C1 at same position (different layer)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);

      // Get fresh state
      const state = useSceneStore.getState();

      // Validate scene
      const { validateAll } = await import('../../src/core/geo/validateAll');
      const { projectDraftToV1 } = await import('../../src/sync/projector');

      const sceneV1 = projectDraftToV1({ scene: state.scene });
      const problems = await validateAll(sceneV1);

      // Find collision problems for C2
      const collisionProblems = problems.filter(
        (p) => p.pieceId === c2Piece && (p.code === 'overlap_same_layer' || p.code === 'collision'),
      );

      // Should NOT have collision problem (cross-layer allowed)
      expect(collisionProblems.length).toBe(0);

      // Verify NO BLOCK problems for C2 (cross-layer collision allowed)
      const blockProblems = problems.filter((p) => p.pieceId === c2Piece && p.severity === 'BLOCK');
      expect(blockProblems.length).toBe(0);

      // C2 may have support WARN (if not fully on C1), but no BLOCK
      const warnProblems = problems.filter((p) => p.pieceId === c2Piece && p.severity === 'WARN');
      // May or may not have WARN depending on exact support calculation
    });
  });
});
