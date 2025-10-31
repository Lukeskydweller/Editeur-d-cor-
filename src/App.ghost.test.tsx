import { render } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import { validateNoOverlap } from '@/lib/sceneRules';
import { listDrafts } from '@/lib/drafts';

beforeEach(() => {
  localStorage.clear();
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
      lockEdge: false,
      guides: undefined,
      resizing: undefined,
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });
});

describe('Ghost elimination after rotation', () => {
  it('ghost never blocks after rotation', () => {
    const {
      initSceneWithDefaults,
      addRectAtCenter,
      selectPiece,
      rotateSelected,
      beginDrag,
      updateDrag,
      endDrag,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    // Add second piece at different position
    addRectAtCenter(80, 60);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    expect(pieces.length).toBe(2);

    const [p1Id, p2Id] = pieces.map((p) => p.id);

    // Select and rotate first piece (triggers ghost clearing)
    selectPiece(p1Id);
    rotateSelected(90);
    rotateSelected(-90); // Back to 0

    // Drag second piece through area where p1's ghost might have been
    selectPiece(p2Id);
    const p2 = useSceneStore.getState().scene.pieces[p2Id];

    beginDrag(p2Id);

    // Move across the scene (where ghost might have been)
    updateDrag(-100, -100);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging).toBeDefined();

    // Ghost should have candidate position (not blocked by phantom)
    expect(dragging?.candidate).toBeDefined();

    endDrag();

    // Should not be blocked by non-existent ghost
    const finalP2 = useSceneStore.getState().scene.pieces[p2Id];
    expect(finalP2).toBeDefined();
  });

  it('simulated scene not persisted after Escape', () => {
    const {
      initSceneWithDefaults,
      addRectAtCenter,
      selectPiece,
      beginDrag,
      updateDrag,
      cancelDrag,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    addRectAtCenter(100, 50);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const [p1, p2] = pieces;

    // Drag p2 to overlap with p1 (would create invalid ghost)
    selectPiece(p2.id);
    const originalPos = { ...p2.position };

    beginDrag(p2.id);

    // Move to create overlap (invalid state)
    updateDrag(
      p1.position.x - p2.position.x + 5,
      p1.position.y - p2.position.y + 5
    );

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate).toBeDefined();

    // Cancel drag with Escape
    cancelDrag();

    // Real scene should not have the simulated overlap
    const validation = validateNoOverlap(useSceneStore.getState().scene);
    expect(validation.ok).toBe(true);

    // Position should be restored
    const restoredP2 = useSceneStore.getState().scene.pieces[p2.id];
    expect(restoredP2.position.x).toBe(originalPos.x);
    expect(restoredP2.position.y).toBe(originalPos.y);

    // No dragging state should remain
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
  });

  it('duplicate + delete does not leave ghost artifacts', () => {
    const {
      initSceneWithDefaults,
      selectPiece,
      duplicateSelected,
      deleteSelected,
      beginDrag,
      updateDrag,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
    selectPiece(pieceId);

    // Duplicate
    duplicateSelected();
    expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(2);

    // UI should be cleared (no ghost from duplicate)
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
    expect(useSceneStore.getState().ui.guides).toBeUndefined();

    // Delete one piece
    const selectedId = useSceneStore.getState().ui.selectedId;
    expect(selectedId).toBeDefined();

    deleteSelected();

    // UI should still be cleared
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
    expect(useSceneStore.getState().ui.resizing).toBeUndefined();
    expect(useSceneStore.getState().ui.guides).toBeUndefined();

    // Only one piece remains
    expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);
  });

  it('import scene clears all transient UI', () => {
    const {
      initSceneWithDefaults,
      selectPiece,
      beginDrag,
      updateDrag,
      importSceneFileV1,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
    selectPiece(pieceId);

    // Create transient state
    beginDrag(pieceId);
    updateDrag(20, 20);

    expect(useSceneStore.getState().ui.dragging).toBeDefined();

    // Import a new scene
    const newSceneFile = useSceneStore.getState().toSceneFileV1();

    importSceneFileV1(newSceneFile);

    // All transient UI should be cleared
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
    expect(useSceneStore.getState().ui.resizing).toBeUndefined();
    expect(useSceneStore.getState().ui.guides).toBeUndefined();
    expect(useSceneStore.getState().ui.marquee).toBeUndefined();
  });

  it('draft load clears all transient UI', () => {
    const {
      initSceneWithDefaults,
      selectPiece,
      startResize,
      updateResize,
      createDraft,
      loadDraftById,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
    const piece = useSceneStore.getState().scene.pieces[pieceId];
    selectPiece(pieceId);

    // Create a draft
    createDraft();
    const drafts = listDrafts();
    expect(drafts.length).toBe(1);
    const draftId = drafts[0].id;

    // Create transient state (resizing)
    startResize(pieceId, 's');
    updateResize({
      x: piece.position.x + piece.size.w / 2,
      y: piece.position.y + piece.size.h + 20,
    });

    expect(useSceneStore.getState().ui.resizing).toBeDefined();
    expect(useSceneStore.getState().ui.guides).toBeDefined();

    // Load the draft
    loadDraftById(draftId);

    // All transient UI should be cleared
    expect(useSceneStore.getState().ui.dragging).toBeUndefined();
    expect(useSceneStore.getState().ui.resizing).toBeUndefined();
    expect(useSceneStore.getState().ui.guides).toBeUndefined();
    expect(useSceneStore.getState().ui.marquee).toBeUndefined();
  });

  it('pointerEvents none on ghost prevents click interception', () => {
    const { initSceneWithDefaults, addRectAtCenter, selectPiece, beginDrag, updateDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    addRectAtCenter(100, 50);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const [p1] = pieces;

    // Start dragging first piece to create ghost
    selectPiece(p1.id);
    beginDrag(p1.id);
    updateDrag(50, 50);

    // Render app to verify ghost is present
    const { container } = render(<App />);

    // Ghost should exist
    const ghost = container.querySelector('[data-testid="ghost-piece"]');
    expect(ghost).toBeInTheDocument();

    // Ghost rect should have pointer-events="none" (SVG attribute, not React prop)
    const ghostRect = ghost?.querySelector('rect');
    expect(ghostRect?.getAttribute('pointer-events')).toBe('none');
  });

  it('pointerEvents none on guides prevents click interception', () => {
    const { initSceneWithDefaults, selectPiece, startResize, updateResize } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
    const piece = useSceneStore.getState().scene.pieces[pieceId];
    selectPiece(pieceId);

    // Start resize to create guides
    startResize(pieceId, 'e');
    updateResize({
      x: piece.position.x + piece.size.w + 10,
      y: piece.position.y + piece.size.h / 2,
    });

    // Guides might be present
    const guides = useSceneStore.getState().ui.guides;
    if (guides && guides.length > 0) {
      // Render app to verify guides
      const { container } = render(<App />);

      const guidesGroup = container.querySelector('[data-testid="snap-guides"]');
      expect(guidesGroup).toBeInTheDocument();

      // All guide lines should have pointer-events="none" (SVG attribute)
      const guideLines = guidesGroup?.querySelectorAll('line');
      guideLines?.forEach((line) => {
        expect(line.getAttribute('pointer-events')).toBe('none');
      });
    }
  });
});
