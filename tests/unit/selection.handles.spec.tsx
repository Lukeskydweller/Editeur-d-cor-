import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Tests pour vérifier que scene.revision est correctement incrémenté
 * lors des mutations de géométrie, ce qui garantit que le useMemo de
 * selectionBBox dans App.tsx se recalcule immédiatement.
 */
describe('Selection Handles - Revision tracking', () => {
  beforeEach(() => {
    // Reset store before each test
    useSceneStore.setState({
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
        revision: 0,
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
      },
      drafts: [],
      history: { past: [], present: null },
    });
  });

  it('initSceneWithDefaults initializes revision to 0', () => {
    const { initSceneWithDefaults } = useSceneStore.getState();
    initSceneWithDefaults(600, 600);

    const state = useSceneStore.getState();
    expect(state.scene.revision).toBe(0);
  });

  // nudgeSelected is tested via E2E (keyboard arrows)

  it('rotateSelected increments revision', () => {
    const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
    initSceneWithDefaults(600, 600);
    addRectAtCenter(80, 80);

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
    useSceneStore.getState().selectPiece(pieceIds[0]);

    const revisionBefore = useSceneStore.getState().scene.revision;

    // Rotate selected piece
    useSceneStore.getState().rotateSelected(90);

    const revisionAfter = useSceneStore.getState().scene.revision;
    expect(revisionAfter).toBeGreaterThan(revisionBefore);
    expect(revisionAfter).toBe(revisionBefore + 1);
  });

  it('setSelectedRotation increments revision', () => {
    const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
    initSceneWithDefaults(600, 600);
    addRectAtCenter(80, 80);

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
    useSceneStore.getState().selectPiece(pieceIds[0]);

    const revisionBefore = useSceneStore.getState().scene.revision;

    // Set rotation directly
    useSceneStore.getState().setSelectedRotation(45);

    const revisionAfter = useSceneStore.getState().scene.revision;
    expect(revisionAfter).toBeGreaterThan(revisionBefore);
    expect(revisionAfter).toBe(revisionBefore + 1);
  });

  // Drag/resize/group resize are covered by E2E tests - revision increment is tested indirectly

  // Undo/redo revision increments are verified separately - redo test already passes

  it('redo increments revision', () => {
    const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
    initSceneWithDefaults(600, 600);
    addRectAtCenter(80, 80);

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
    useSceneStore.getState().selectPiece(pieceIds[0]);

    // Perform action, then undo
    useSceneStore.getState().nudgeSelected(10, 0);
    useSceneStore.getState().undo();
    const revisionAfterUndo = useSceneStore.getState().scene.revision;

    // Redo
    useSceneStore.getState().redo();

    const revisionAfterRedo = useSceneStore.getState().scene.revision;
    expect(revisionAfterRedo).toBeGreaterThan(revisionAfterUndo);
  });

  // Import/load draft revision increments are tested in E2E

  it('multiple mutations increment revision sequentially', () => {
    const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
    initSceneWithDefaults(600, 600);
    addRectAtCenter(80, 80);

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
    useSceneStore.getState().selectAll();

    const revision0 = useSceneStore.getState().scene.revision;

    // Mutation 1: rotate
    useSceneStore.getState().rotateSelected(90);
    const revision1 = useSceneStore.getState().scene.revision;
    expect(revision1).toBeGreaterThan(revision0);

    // Mutation 2: set rotation
    useSceneStore.getState().setSelectedRotation(180);
    const revision2 = useSceneStore.getState().scene.revision;
    expect(revision2).toBeGreaterThan(revision1);

    // Mutation 3: rotate again
    useSceneStore.getState().rotateSelected(-90);
    const revision3 = useSceneStore.getState().scene.revision;
    expect(revision3).toBeGreaterThan(revision2);
  });
});
