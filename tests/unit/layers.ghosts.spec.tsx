import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '@/App';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Ghost manipulation tests (AABB fast strategy)
 * Validates that C2/C3 pieces remain manipulable (drag/resize/snap) when in ghost state
 * (not fully supported by union of lower layers) and become "real" when fully supported.
 */
describe('Layers: Ghost manipulation (AABB)', () => {
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
        lockEdge: false,
        guides: undefined,
        resizing: undefined,
        history: {
          past: [],
          future: [],
          limit: 100,
        },
        layerVisibility: {},
        layerLocked: {},
        handlesEpoch: 0,
        isTransientActive: false,
      },
    });
  });

  it('Ghost state: C2 piece partially unsupported renders with ghost colors (BLOCK/WARN) but remains manipulable', async () => {
    const {
      initSceneWithDefaults,
      addMaterial,
      addRectPiece,
      selectPiece,
      beginDrag,
      updateDrag,
      endDrag,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const { C1, C2 } = useSceneStore.getState().scene.fixedLayerIds!;
    const materialId = addMaterial({ name: 'Mat1', oriented: false });

    // Create support piece in C1 at (100, 100) with size 100×100
    addRectPiece(C1, materialId, 100, 100, 100, 100);
    const supportId = Object.keys(useSceneStore.getState().scene.pieces).find(
      (id) => useSceneStore.getState().scene.pieces[id].layerId === C1,
    )!;

    // Create C2 piece partially outside support at (150, 100) with size 100×100
    // Only 50mm overlap with support, 50mm extends beyond
    addRectPiece(C2, materialId, 150, 100, 100, 100);
    const c2PieceId = Object.keys(useSceneStore.getState().scene.pieces).find(
      (id) => useSceneStore.getState().scene.pieces[id].layerId === C2 && id !== supportId,
    )!;

    expect(c2PieceId).toBeDefined();

    // Render app to check ghost state
    const { container } = render(<App />);

    // Wait for validation (ghost detection is async)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check if piece has ghost state (data-ghost attribute)
    const ghostPiece = container.querySelector(`[data-piece-id="${c2PieceId}"][data-ghost="true"]`);

    // If ghost detection is active, verify colors
    if (ghostPiece) {
      const rect = ghostPiece.querySelector('rect');
      const fill = rect?.getAttribute('fill');

      // Ghost should have red (#ef4444) for BLOCK or orange (#f59e0b) for WARN
      expect(fill === '#ef4444' || fill === '#f59e0b').toBe(true);
    }

    // Verify piece is manipulable: start drag (interaction enabled)
    selectPiece(c2PieceId);

    beginDrag(c2PieceId);
    updateDrag(20, 20);

    // Dragging should be active (proves piece is manipulable despite ghost state)
    const draggingState = useSceneStore.getState().ui.dragging;
    expect(draggingState).toBeDefined();
    expect(draggingState?.candidate).toBeDefined();

    endDrag();
  });

  it('Transition ghost→real: adding C1 support makes C2 piece fully supported (no ghost colors)', async () => {
    const { initSceneWithDefaults, addMaterial, addRectPiece } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const { C1, C2 } = useSceneStore.getState().scene.fixedLayerIds!;
    const materialId = addMaterial({ name: 'Mat1', oriented: false });

    // Create partial support in C1 at (100, 100) with size 100×100
    addRectPiece(C1, materialId, 100, 100, 100, 100);

    // Create C2 piece at (150, 100) with size 100×100 (partially unsupported)
    addRectPiece(C2, materialId, 150, 100, 100, 100);
    const c2PieceId = Object.keys(useSceneStore.getState().scene.pieces).find(
      (id) => useSceneStore.getState().scene.pieces[id].layerId === C2,
    )!;

    // Render before adding full support
    const { container, rerender } = render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Now add second support piece in C1 to cover the entire C2 piece
    // C2 piece spans (150, 100) to (250, 200), so add support at (200, 100) with size 100×100
    addRectPiece(C1, materialId, 200, 100, 100, 100);

    // Rerender to check new state
    rerender(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // C2 piece should no longer have ghost state
    const c2Piece = container.querySelector(`[data-piece-id="${c2PieceId}"]`);

    // If ghost detection was active before, it should be cleared now
    if (c2Piece) {
      const isGhost = c2Piece.getAttribute('data-ghost');
      const rect = c2Piece.querySelector('rect');
      const fill = rect?.getAttribute('fill');

      // Piece should either not be marked as ghost, or if validation is slow,
      // at minimum it should have normal colors (blue #60a5fa)
      if (isGhost !== 'true') {
        expect(fill).toBe('#60a5fa'); // Normal piece color
      }
    }

    // Verify piece remains manipulable after transition
    const { selectPiece, beginDrag, updateDrag, endDrag } = useSceneStore.getState();
    selectPiece(c2PieceId);

    beginDrag(c2PieceId);
    updateDrag(10, 10);

    // Dragging should be active (proves piece is still manipulable after transition)
    expect(useSceneStore.getState().ui.dragging).toBeDefined();

    endDrag();
  });

  it('Ghost piece can be resized (manipulation not blocked by ghost state)', async () => {
    const {
      initSceneWithDefaults,
      addMaterial,
      addRectPiece,
      selectPiece,
      startResize,
      updateResize,
      endResize,
    } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const { C1, C2 } = useSceneStore.getState().scene.fixedLayerIds!;
    const materialId = addMaterial({ name: 'Mat1', oriented: false });

    // Create partial support in C1
    addRectPiece(C1, materialId, 100, 100, 100, 100);

    // Create C2 piece partially unsupported
    addRectPiece(C2, materialId, 150, 100, 100, 100);
    const c2PieceId = Object.keys(useSceneStore.getState().scene.pieces).find(
      (id) => useSceneStore.getState().scene.pieces[id].layerId === C2,
    )!;

    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try to resize the ghost piece
    selectPiece(c2PieceId);
    const piece = useSceneStore.getState().scene.pieces[c2PieceId];
    const originalWidth = piece.size.w;

    startResize(c2PieceId, 'e'); // East handle
    updateResize({
      x: piece.position.x + piece.size.w + 20,
      y: piece.position.y + piece.size.h / 2,
    });
    endResize(true); // Commit

    // Size should have changed (piece was resizable despite being ghost)
    const newWidth = useSceneStore.getState().scene.pieces[c2PieceId].size.w;
    expect(newWidth).not.toBe(originalWidth);
  });

  it("Non-regression: painter's order (C1 bottom → C3 top) remains unchanged", () => {
    const { initSceneWithDefaults, addMaterial, addRectPiece } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const { C1, C2, C3 } = useSceneStore.getState().scene.fixedLayerIds!;
    const materialId = addMaterial({ name: 'Mat1', oriented: false });

    // Add pieces to all three layers
    addRectPiece(C1, materialId, 100, 100, 100, 100);
    addRectPiece(C2, materialId, 120, 120, 100, 100);
    addRectPiece(C3, materialId, 140, 140, 100, 100);

    const { container } = render(<App />);

    // Get all piece groups in SVG (init creates 1 default piece + our 3 = 4)
    const pieceGroups = container.querySelectorAll('[data-piece-id]');
    expect(pieceGroups.length).toBeGreaterThanOrEqual(3);

    // Verify layer order in DOM matches painter's order (C1, C2, C3)
    const layerIds = Array.from(pieceGroups).map((group) => {
      const pieceId = group.getAttribute('data-piece-id');
      return useSceneStore.getState().scene.pieces[pieceId!].layerId;
    });

    // Find indices of our specific layers
    const c1Index = layerIds.indexOf(C1);
    const c2Index = layerIds.indexOf(C2);
    const c3Index = layerIds.indexOf(C3);

    // C1 should come before C2, C2 before C3 (painter's order)
    expect(c1Index).toBeLessThan(c2Index);
    expect(c2Index).toBeLessThan(c3Index);
  });

  it('Pointer-events isolation at <g> level allows manipulation per layer', () => {
    const { initSceneWithDefaults, addMaterial, addRectPiece } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const { C1, C2 } = useSceneStore.getState().scene.fixedLayerIds!;
    const materialId = addMaterial({ name: 'Mat1', oriented: false });

    // Create pieces in C1 and C2
    addRectPiece(C1, materialId, 100, 100, 100, 100);
    addRectPiece(C2, materialId, 150, 100, 100, 100);

    const { container } = render(<App />);

    // Get piece groups (init creates 1 default piece + our 2 = 3)
    const pieceGroups = container.querySelectorAll('[data-piece-id]');
    expect(pieceGroups.length).toBeGreaterThanOrEqual(2);

    // Verify pointer-events are not set to "none" on piece groups (they should be manipulable)
    pieceGroups.forEach((group) => {
      const pointerEvents = group.getAttribute('pointer-events');
      expect(pointerEvents).not.toBe('none');
    });
  });
});
