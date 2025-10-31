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
      snap10mm: false, // Disable snap for precise clamp tests
      lockEdge: false,
      guides: undefined,
      resizing: undefined,
      history: { past: [], future: [], limit: 100 },
    },
  });
});

describe('Rotation-aware AABB clamp to scene edges', () => {
  it('drag rotated 90° can reach left edge (x=0) and cannot go <0', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 90° (120x80 -> 80x120 AABB)
    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Drag far left (should clamp to x=0)
    beginDrag(pieceId);
    updateDrag(-1000, 0);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.x).toBe(0);

    endDrag();

    const bboxAfter = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bboxAfter.x).toBe(0); // Left edge at scene boundary
    expect(bboxAfter.x).toBeGreaterThanOrEqual(0);
  });

  it('drag rotated 90° can reach top edge (y=0) and cannot go <0', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    beginDrag(pieceId);
    updateDrag(0, -1000);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.y).toBe(0);

    endDrag();

    const bboxAfter = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bboxAfter.y).toBe(0); // Top edge at scene boundary
    expect(bboxAfter.y).toBeGreaterThanOrEqual(0);
  });

  it('drag rotated 90° can reach right edge (x+w=scene.w)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    beginDrag(pieceId);
    updateDrag(1000, 0); // Drag far right

    const dragging = useSceneStore.getState().ui.dragging;
    // Right edge should be at scene.w
    expect(dragging?.candidate?.x).toBe(600 - bboxBefore.w);

    endDrag();

    const bboxAfter = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bboxAfter.x + bboxAfter.w).toBe(600); // Right edge at scene boundary
    expect(bboxAfter.x + bboxAfter.w).toBeLessThanOrEqual(600);
  });

  it('drag rotated 90° can reach bottom edge (y+h=scene.h)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    beginDrag(pieceId);
    updateDrag(0, 1000); // Drag far down

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.y).toBe(600 - bboxBefore.h);

    endDrag();

    const bboxAfter = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bboxAfter.y + bboxAfter.h).toBe(600); // Bottom edge at scene boundary
    expect(bboxAfter.y + bboxAfter.h).toBeLessThanOrEqual(600);
  });

  it('drag rotated 270° — symmetric clamp to all 4 edges', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 270°
    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Test left edge
    beginDrag(pieceId);
    updateDrag(-1000, 0);
    endDrag();
    let bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBe(0);

    // Test right edge
    beginDrag(pieceId);
    updateDrag(1000, 0);
    endDrag();
    bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBe(600);
  });

  it('drag unrotated 0° — non regression clamp to all 4 edges', () => {
    const { initSceneWithDefaults, selectPiece, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Test left
    beginDrag(pieceId);
    updateDrag(-1000, 0);
    endDrag();
    let bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBe(0);

    // Test right
    beginDrag(pieceId);
    updateDrag(1000, 0);
    endDrag();
    bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBe(600);
  });

  it('nudge rotated 90° with arrows — clamp to left edge', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Nudge far left
    for (let i = 0; i < 100; i++) {
      nudgeSelected(-10, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBe(0);
    expect(bbox.x).toBeGreaterThanOrEqual(0);
  });

  it('nudge rotated 90° with arrows — clamp to right edge', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Nudge far right
    for (let i = 0; i < 100; i++) {
      nudgeSelected(10, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBe(600);
    expect(bbox.x + bbox.w).toBeLessThanOrEqual(600);
  });

  it('nudge rotated 90° with snap ON — clamp to edges', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Nudge far left with snap ON
    for (let i = 0; i < 100; i++) {
      nudgeSelected(-10, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBe(0);
    expect(bbox.x).toBeGreaterThanOrEqual(0);
  });

  it('drag rotated 180° — clamp symmetric (no dimension swap)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 180° (no dimension swap)
    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Test all 4 edges
    beginDrag(pieceId);
    updateDrag(-1000, 0);
    endDrag();
    let bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBe(0);

    beginDrag(pieceId);
    updateDrag(1000, 0);
    endDrag();
    bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBe(600);
  });
});
