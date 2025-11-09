import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import { rectsOverlap } from '../../src/lib/geom';
import { pieceBBox } from '../../src/lib/geom';
import type { ID } from '../../src/types/scene';
import { DUPLICATE_OFFSET_MM } from '../../src/state/constants';

/**
 * Tests for duplicate escape mechanism.
 *
 * Key behaviors:
 * - When duplicating a piece that would collide at default offset (DUPLICATE_OFFSET_MM),
 *   the system applies additional escape offsets (DUPLICATE_OFFSET_MM per attempt, max 5 attempts)
 *   to find a collision-free position
 * - Only checks same-layer collisions
 * - Works for both single piece and group duplication
 */
describe('duplicate: escape mechanism', () => {
  let C1: ID, C2: ID, C3: ID;
  let mat: ID;

  beforeEach(() => {
    // Reset Zustand store between tests
    localStorage.clear();

    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(800, 600);

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

  describe('single piece duplication', () => {
    it('duplicate piece with no collision → uses offset that avoids collision', () => {
      let store = useSceneStore.getState();

      // C1: place a piece at position where default offset won't overlap
      // Use smaller piece and larger offset to ensure no collision
      store.setActiveLayer(C1);
      const original = store.addRectPiece(C1, mat, 40, 40, 100, 100, 0);
      expect(original).not.toBe('');

      // Get fresh state and original position
      store = useSceneStore.getState();
      const originalPos = store.scene.pieces[original].position;

      // Duplicate
      store.selectPiece(original);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Should have 2 pieces now
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBe(2);

      // Find the duplicate (not the original)
      const duplicate = pieces.find((p) => p.id !== original);
      expect(duplicate).toBeDefined();
      if (!duplicate) return;

      // Original spans 100-140, default duplicate at 120 would span 120-160 (OVERLAPS 120-140)
      // So escape should kick in and place it at non-overlapping position
      // Piece should not collide with original
      const originalBBox = pieceBBox(store.scene.pieces[original]);
      const duplicateBBox = pieceBBox(duplicate);
      expect(rectsOverlap(originalBBox, duplicateBBox)).toBe(false);
    });

    it('duplicate piece with collision at default offset → apply escape offset', () => {
      let store = useSceneStore.getState();

      // C1: place original piece
      store.setActiveLayer(C1);
      const original = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

      // Place blocker at default duplicate position (120, 120)
      const blocker = store.addRectPiece(C1, mat, 60, 60, 120, 120, 0);

      // Get fresh state and original position
      store = useSceneStore.getState();
      const originalPos = store.scene.pieces[original].position;

      // Duplicate
      store.selectPiece(original);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Should have 3 pieces now
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBe(3);

      // Find the duplicate (not original or blocker)
      const duplicate = pieces.find((p) => p.id !== original && p.id !== blocker);
      expect(duplicate).toBeDefined();
      if (!duplicate) return;

      // Duplicate should NOT be at default offset (collision avoided)
      const defaultX = originalPos.x + DUPLICATE_OFFSET_MM;
      const defaultY = originalPos.y + DUPLICATE_OFFSET_MM;
      const isAtDefault = duplicate.position.x === defaultX && duplicate.position.y === defaultY;
      expect(isAtDefault).toBe(false);

      // Duplicate should not collide with blocker
      const duplicateBBox = pieceBBox(duplicate);
      const blockerBBox = pieceBBox(store.scene.pieces[blocker]);
      expect(rectsOverlap(duplicateBBox, blockerBBox)).toBe(false);
    });

    it('duplicate piece with multiple blockers → find escape position', () => {
      let store = useSceneStore.getState();

      // C1: place original piece
      store.setActiveLayer(C1);
      const original = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

      // Place blockers at first two escape positions
      // With DUPLICATE_OFFSET_MM=60: attempt 0 at (100,100), attempt 1 at (160,160), attempt 2 at (220,220)
      const blocker1 = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0); // Default offset
      const blocker2 = store.addRectPiece(C1, mat, 60, 60, 160, 160, 0); // Escape attempt 1

      // Duplicate
      store.selectPiece(original);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Should have 4 pieces now
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBe(4);

      // Find the duplicate
      const duplicate = pieces.find(
        (p) => p.id !== original && p.id !== blocker1 && p.id !== blocker2,
      );
      expect(duplicate).toBeDefined();
      if (!duplicate) return;

      // Duplicate should not collide with any blocker
      const duplicateBBox = pieceBBox(duplicate);
      const blocker1BBox = pieceBBox(store.scene.pieces[blocker1]);
      const blocker2BBox = pieceBBox(store.scene.pieces[blocker2]);

      expect(rectsOverlap(duplicateBBox, blocker1BBox)).toBe(false);
      expect(rectsOverlap(duplicateBBox, blocker2BBox)).toBe(false);
    });

    it('duplicate respects same-layer only (cross-layer not blocked)', () => {
      let store = useSceneStore.getState();

      // C1: place original piece (40×40 to avoid self-collision with default offset)
      store.setActiveLayer(C1);
      const c1Original = store.addRectPiece(C1, mat, 30, 30, 100, 100, 0);

      // Get fresh state after C1 piece (unlocks C2)
      store = useSceneStore.getState();

      // C2: place piece at what could overlap with C1 duplicate position
      // This should NOT block C1 duplication (cross-layer freedom)
      store.setActiveLayer(C2);
      const c2Piece = store.addRectPiece(C2, mat, 60, 60, 115, 115, 0);

      // Get fresh state and duplicate C1 piece
      store = useSceneStore.getState();
      store.selectPiece(c1Original);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Find C1 duplicate
      const c1Pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(c1Pieces.length).toBe(2); // Original + duplicate
      const c1Duplicate = c1Pieces.find((p) => p.id !== c1Original);
      expect(c1Duplicate).toBeDefined();
      if (!c1Duplicate) return;

      // C1 duplicate should not be blocked by C2 piece (cross-layer freedom)
      // It may overlap with C2 in 2D space, but that's allowed
      // Just verify the duplicate exists and doesn't collide with C1 original
      const c1OriginalBBox = pieceBBox(store.scene.pieces[c1Original]);
      const c1DuplicateBBox = pieceBBox(c1Duplicate);
      expect(rectsOverlap(c1OriginalBBox, c1DuplicateBBox)).toBe(false);
    });
  });

  describe('group duplication', () => {
    it('duplicate group with no collision → default offset', () => {
      let store = useSceneStore.getState();

      // C1: place two pieces for group
      store.setActiveLayer(C1);
      const piece1 = store.addRectPiece(C1, mat, 40, 40, 100, 100, 0);
      const piece2 = store.addRectPiece(C1, mat, 40, 40, 150, 100, 0);

      // Select both and duplicate
      store.setSelection([piece1, piece2]);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Should have 4 pieces now
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBe(4);

      // Find duplicates
      const duplicates = pieces.filter((p) => p.id !== piece1 && p.id !== piece2);
      expect(duplicates.length).toBe(2);

      // Duplicates should be at default offset (DUPLICATE_OFFSET_MM)
      for (const dup of duplicates) {
        const original = pieces.find(
          (p) =>
            (p.id === piece1 || p.id === piece2) &&
            p.position.x + DUPLICATE_OFFSET_MM === dup.position.x &&
            p.position.y + DUPLICATE_OFFSET_MM === dup.position.y,
        );
        expect(original).toBeDefined();
      }
    });

    it('duplicate group with collision → apply escape offset', () => {
      let store = useSceneStore.getState();

      // C1: place two pieces for group
      store.setActiveLayer(C1);
      const piece1 = store.addRectPiece(C1, mat, 40, 40, 100, 100, 0);
      const piece2 = store.addRectPiece(C1, mat, 40, 40, 150, 100, 0);

      // Place blocker at default duplicate position of piece1
      const blocker = store.addRectPiece(C1, mat, 40, 40, 120, 120, 0);

      // Select group and duplicate
      store.setSelection([piece1, piece2]);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Should have 5 pieces now
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBe(5);

      // Find duplicates (not originals or blocker)
      const duplicates = pieces.filter(
        (p) => p.id !== piece1 && p.id !== piece2 && p.id !== blocker,
      );
      expect(duplicates.length).toBe(2);

      // Duplicates should not collide with blocker
      const blockerBBox = pieceBBox(store.scene.pieces[blocker]);
      for (const dup of duplicates) {
        const dupBBox = pieceBBox(dup);
        expect(rectsOverlap(dupBBox, blockerBBox)).toBe(false);
      }
    });

    it('group duplication maintains relative positions', () => {
      let store = useSceneStore.getState();

      // C1: place two pieces with specific spacing
      store.setActiveLayer(C1);
      const piece1 = store.addRectPiece(C1, mat, 40, 40, 100, 100, 0);
      const piece2 = store.addRectPiece(C1, mat, 30, 30, 160, 110, 0);

      // Get fresh state for original positions
      store = useSceneStore.getState();
      const originalDx =
        store.scene.pieces[piece2].position.x - store.scene.pieces[piece1].position.x;
      const originalDy =
        store.scene.pieces[piece2].position.y - store.scene.pieces[piece1].position.y;

      // Select group and duplicate
      store.setSelection([piece1, piece2]);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Find duplicates
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      const duplicates = pieces.filter((p) => p.id !== piece1 && p.id !== piece2);
      expect(duplicates.length).toBe(2);

      // Check relative positions are maintained
      const [dup1, dup2] = duplicates;
      const dupDx = dup2.position.x - dup1.position.x;
      const dupDy = dup2.position.y - dup1.position.y;

      expect(dupDx).toBe(originalDx);
      expect(dupDy).toBe(originalDy);
    });
  });

  describe('escape max attempts', () => {
    it('stops after max attempts even if collision persists', () => {
      let store = useSceneStore.getState();

      // C1: place original piece
      store.setActiveLayer(C1);
      const original = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

      // Fill the escape path with blockers (all 5 attempts)
      for (let i = 0; i <= 5; i++) {
        const offset = 20 + i * 10;
        store.addRectPiece(C1, mat, 60, 60, 100 + offset, 100 + offset, 0);
      }

      // Duplicate
      store.selectPiece(original);
      store.duplicateSelected();

      // Get fresh state
      store = useSceneStore.getState();

      // Duplicate should exist (even if in collision)
      const pieces = Object.values(store.scene.pieces).filter((p) => p.layerId === C1);
      expect(pieces.length).toBeGreaterThan(6); // Original + 6 blockers + duplicate
    });
  });
});
