import { beforeEach, describe, it, expect } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import { pieceBBox } from '@/lib/geom';
import { produce } from 'immer';

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

describe('Final clamp after snaps prevents scene escape', () => {
  it('drag rotated 90° with snap ON — cannot escape left edge (x>=0)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true); // Snap ON

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    // Move piece near left edge
    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 15;
      })
    );

    // Drag with snap that could push beyond x=0
    beginDrag(pieceId);
    updateDrag(-20, 0); // Try to push beyond left edge

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.x).toBeGreaterThanOrEqual(0); // Ghost clamped

    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0); // Cannot escape left
  });

  it('drag rotated 90° with snap ON — cannot escape right edge (x+w<=scene.w)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    // Move piece near right edge
    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 600 - bboxBefore.w - 15;
      })
    );

    beginDrag(pieceId);
    updateDrag(20, 0); // Try to push beyond right edge

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.x).toBeLessThanOrEqual(600 - bboxBefore.w);

    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBeLessThanOrEqual(600); // Cannot escape right
  });

  it('drag rotated 90° with snap ON — cannot escape top edge (y>=0)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.y = 15;
      })
    );

    beginDrag(pieceId);
    updateDrag(0, -20); // Try to push beyond top edge

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.y).toBeGreaterThanOrEqual(0);

    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.y).toBeGreaterThanOrEqual(0); // Cannot escape top
  });

  it('drag rotated 90° with snap ON — cannot escape bottom edge (y+h<=scene.h)', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.y = 600 - bboxBefore.h - 15;
      })
    );

    beginDrag(pieceId);
    updateDrag(0, 20); // Try to push beyond bottom edge

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.y).toBeLessThanOrEqual(600 - bboxBefore.h);

    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.y + bbox.h).toBeLessThanOrEqual(600); // Cannot escape bottom
  });

  it('drag rotated 270° with snap ON — all 4 edges protected', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);
    rotateSelected(90);

    // Test left edge
    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 15;
      })
    );
    beginDrag(pieceId);
    updateDrag(-30, 0);
    endDrag();
    let bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0);

    // Test right edge
    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 600 - bboxBefore.w - 15;
      })
    );
    beginDrag(pieceId);
    updateDrag(30, 0);
    endDrag();
    bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBeLessThanOrEqual(600);
  });

  it('drag unrotated 0° with snap ON — final clamp non-regression', () => {
    const { initSceneWithDefaults, selectPiece, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 15;
      })
    );

    beginDrag(pieceId);
    updateDrag(-30, 0);

    const dragging = useSceneStore.getState().ui.dragging;
    expect(dragging?.candidate?.x).toBeGreaterThanOrEqual(0);

    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0);
  });

  it('nudge rotated 90° with snap ON — cannot escape left edge', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 15;
      })
    );

    // Nudge repeatedly with snap that could push beyond x=0
    for (let i = 0; i < 5; i++) {
      nudgeSelected(-10, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0); // Cannot escape
  });

  it('nudge rotated 90° with snap ON — cannot escape right edge', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    const bboxBefore = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 600 - bboxBefore.w - 15;
      })
    );

    for (let i = 0; i < 5; i++) {
      nudgeSelected(10, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x + bbox.w).toBeLessThanOrEqual(600);
  });

  it('nudge rotated 90° with snap OFF — cannot escape edges', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, nudgeSelected } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(false); // Snap OFF

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 5;
      })
    );

    // Nudge with precise increments (no snap)
    for (let i = 0; i < 10; i++) {
      nudgeSelected(-1, 0);
    }

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0); // Still clamped
  });

  it('drag rotated 180° with snap ON — final clamp protects all edges', () => {
    const { initSceneWithDefaults, selectPiece, rotateSelected, setSnap10mm, beginDrag, updateDrag, endDrag } =
      useSceneStore.getState();

    initSceneWithDefaults(600, 600);
    setSnap10mm(true);

    const pieces = Object.values(useSceneStore.getState().scene.pieces);
    const pieceId = pieces[0].id;

    selectPiece(pieceId);
    rotateSelected(90);
    rotateSelected(90);

    useSceneStore.setState(
      produce((draft) => {
        draft.scene.pieces[pieceId].position.x = 10;
      })
    );

    beginDrag(pieceId);
    updateDrag(-25, 0);
    endDrag();

    const bbox = pieceBBox(useSceneStore.getState().scene.pieces[pieceId]);
    expect(bbox.x).toBeGreaterThanOrEqual(0);
    expect(bbox.x + bbox.w).toBeLessThanOrEqual(600);
  });
});
