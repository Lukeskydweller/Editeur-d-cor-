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

describe('Rotation-aware drag: ghost == commit position', () => {
  it('drag rotated 90° — ghost == commit (snap OFF)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(false); // Disable snap for precise comparison

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;
    const originalPiece = pieces[0];

    // Rotate 90°
    selectPiece(pieceId);
    rotateSelected(90);

    const rotatedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxBefore = pieceBBox(rotatedPiece);

    // Start drag
    beginDrag(pieceId);

    // Drag with arbitrary offset (not from center)
    const dx = 37; // Non-trivial offset
    const dy = 42;
    updateDrag(dx, dy);

    // Check ghost position
    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging).toBeDefined();
    expect(dragging?.candidate).toBeDefined();

    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // End drag (commit)
    endDrag();

    // Check committed position
    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    // Ghost AABB position should exactly match committed AABB position
    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);

    // Also verify AABB moved by expected delta
    expect(bboxAfter.x).toBeCloseTo(bboxBefore.x + dx, 1);
    expect(bboxAfter.y).toBeCloseTo(bboxBefore.y + dy, 1);
  });

  it('drag rotated 90° — ghost == commit (snap ON)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true); // Enable snap

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 90°
    selectPiece(pieceId);
    rotateSelected(90);

    // Start drag
    beginDrag(pieceId);

    // Drag to trigger snap
    const dx = 23; // Will be snapped to 10mm grid
    const dy = 27;
    updateDrag(dx, dy);

    // Check ghost position (after snap)
    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // End drag
    endDrag();

    // Check committed position
    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    // Ghost and commit must match exactly (even with snap)
    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('drag rotated 270° — ghost == commit (snap ON)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 270°
    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);
    rotateSelected(90);

    const rotatedPiece = useSceneStore.getState().scene.pieces[pieceId];
    expect(rotatedPiece.rotationDeg).toBe(270);

    // Start drag
    beginDrag(pieceId);

    // Drag
    updateDrag(50, 30);

    // Ghost position
    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // Commit
    endDrag();

    // Verify
    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('drag unrotated 0° — non regression ghost == commit (snap ON)', () => {
    const { initSceneWithDefaults, selectPiece, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);

    // No rotation (0°)
    beginDrag(pieceId);
    updateDrag(25, 35);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    endDrag();

    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('drag unrotated 0° — non regression ghost == commit (snap OFF)', () => {
    const { initSceneWithDefaults, selectPiece, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(false);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);

    beginDrag(pieceId);
    updateDrag(17, 23);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    endDrag();

    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('drag rotated 180° — ghost == commit (snap ON)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 180°
    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);

    const rotatedPiece = useSceneStore.getState().scene.pieces[pieceId];
    expect(rotatedPiece.rotationDeg).toBe(180);

    beginDrag(pieceId);
    updateDrag(40, 50);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    endDrag();

    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('drag rotated 90° — clamp at scene edge keeps ghost==commit', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(false);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    // Rotate 90°
    selectPiece(pieceId);
    rotateSelected(90);

    beginDrag(pieceId);

    // Drag far beyond scene bounds (should clamp)
    updateDrag(-1000, -1000);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // Ghost should be clamped to scene edge
    expect(ghostPos.x).toBeGreaterThanOrEqual(0);
    expect(ghostPos.y).toBeGreaterThanOrEqual(0);

    endDrag();

    const committedPiece = useSceneStore.getState().scene.pieces[pieceId];
    const bboxAfter = pieceBBox(committedPiece);

    // Committed position must match clamped ghost
    expect(bboxAfter.x).toBe(ghostPos.x);
    expect(bboxAfter.y).toBe(ghostPos.y);
  });

  it('snap-to-pieces with rotated target keeps ghost==commit', () => {
    const { initSceneWithDefaults, addRectAtCenter, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(false);
    addRectAtCenter(100, 50); // Add target piece

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const [p1, p2] = pieces;

    // Rotate first piece 90°
    selectPiece(p1.id);
    rotateSelected(90);

    const rotatedP1 = useSceneStore.getState().scene.pieces[p1.id];
    const bboxP1 = pieceBBox(rotatedP1);

    // Drag second piece to snap near p1's rotated edge
    selectPiece(p2.id);
    beginDrag(p2.id);

    // Move close to p1's right edge (should trigger snap)
    const targetX = bboxP1.x + bboxP1.w + 3; // 3mm away = within snap threshold
    const p2Bbox = pieceBBox(useSceneStore.getState().scene.pieces[p2.id]);
    const dx = targetX - p2Bbox.x;
    updateDrag(dx, 0);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // Should have snap guides
    const guides = useSceneStore.getState().ui.guides;
    expect(guides).toBeDefined();

    endDrag();

    const committedP2 = useSceneStore.getState().scene.pieces[p2.id];
    const bboxAfterP2 = pieceBBox(committedP2);

    // Ghost and commit must match (with snap applied)
    expect(bboxAfterP2.x).toBe(ghostPos.x);
    expect(bboxAfterP2.y).toBe(ghostPos.y);
  });

  it('group drag with mixed rotations — ghost == commit', () => {
    const { initSceneWithDefaults, addRectAtCenter, selectPiece, rotateSelected, selectAll, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);
    addRectAtCenter(80, 60); // Second piece

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const [p1, p2] = pieces;

    // Rotate first piece 90°
    selectPiece(p1.id);
    rotateSelected(90);

    // Select both (group drag)
    selectAll();

    const selectedIds = useSceneStore.getState().ui.selectedIds;
    expect(selectedIds?.length).toBe(2);

    // Store initial AABBs
    const bboxP1Before = pieceBBox(useSceneStore.getState().scene.pieces[p1.id]);
    const bboxP2Before = pieceBBox(useSceneStore.getState().scene.pieces[p2.id]);

    // Start group drag (primary = p2, second selected)
    beginDrag(p2.id);
    updateDrag(60, 40);

    const dragging = useSceneStore.getState().ui.dragging;
    const ghostPrimaryPos = {
      x: dragging!.candidate!.x,
      y: dragging!.candidate!.y,
    };

    // Compute expected offset for p1
    const groupOffsets = dragging!.groupOffsets;
    expect(groupOffsets).toBeDefined();

    const ghostP1Pos = {
      x: ghostPrimaryPos.x + groupOffsets![p1.id].dx,
      y: ghostPrimaryPos.y + groupOffsets![p1.id].dy,
    };

    endDrag();

    // Check both pieces committed to ghost positions
    const bboxP1After = pieceBBox(useSceneStore.getState().scene.pieces[p1.id]);
    const bboxP2After = pieceBBox(useSceneStore.getState().scene.pieces[p2.id]);

    expect(bboxP2After.x).toBe(ghostPrimaryPos.x);
    expect(bboxP2After.y).toBe(ghostPrimaryPos.y);

    expect(bboxP1After.x).toBe(ghostP1Pos.x);
    expect(bboxP1After.y).toBe(ghostP1Pos.y);
  });
});
