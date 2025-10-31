import { beforeEach, describe, it, expect } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import { pieceBBox } from '@/lib/geom';

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
      snap10mm: false,
      lockEdge: false,
      guides: undefined,
      resizing: undefined,
      history: { past: [], future: [], limit: 100 },
    },
  });
});

describe('Validation uses correct piece.position after AABB conversion', () => {
  it('rotated 90° piece at left edge (x=0) should be valid during drag', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Drag to left edge
    beginDrag(pieceId);
    updateDrag(-1000, 0);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate).toBeDefined();
    expect(dragging?.candidate?.x).toBe(0); // AABB at left edge
    expect(dragging?.candidate?.valid).toBe(true); // Should be valid!
  });

  it('rotated 90° piece at right edge should be valid during drag', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Drag to right edge
    beginDrag(pieceId);
    updateDrag(1000, 0);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate).toBeDefined();
    expect(dragging?.candidate?.x).toBe(600 - bboxBefore.w); // AABB at right edge
    expect(dragging?.candidate?.valid).toBe(true); // Should be valid!
  });

  it('rotated 90° piece at bottom edge should be valid during drag', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Drag to bottom edge
    beginDrag(pieceId);
    updateDrag(0, 1000);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate).toBeDefined();
    expect(dragging?.candidate?.y).toBe(600 - bboxBefore.h); // AABB at bottom edge
    expect(dragging?.candidate?.valid).toBe(true); // Should be valid!
  });

  it('rotated 90° piece at top edge should be valid during drag', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Drag to top edge
    beginDrag(pieceId);
    updateDrag(0, -1000);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate).toBeDefined();
    expect(dragging?.candidate?.y).toBe(0); // AABB at top edge
    expect(dragging?.candidate?.valid).toBe(true); // Should be valid!
  });

  it('rotated 270° piece at all 4 edges should be valid', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Test left edge
    beginDrag(pieceId);
    updateDrag(-1000, 0);
    let dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.valid).toBe(true);
    endDrag();

    // Test right edge
    beginDrag(pieceId);
    updateDrag(1000, 0);
    dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.valid).toBe(true);
    endDrag();

    // Test top edge
    beginDrag(pieceId);
    updateDrag(0, -1000);
    dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.valid).toBe(true);
    endDrag();

    // Test bottom edge
    beginDrag(pieceId);
    updateDrag(0, 1000);
    dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.valid).toBe(true);
    endDrag();
  });
});
