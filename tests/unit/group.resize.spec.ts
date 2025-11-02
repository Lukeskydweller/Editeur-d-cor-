import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';

describe('Group resize - scale factor clamping', () => {
  beforeEach(() => {
    // Reset store to clean state
    const store = useSceneStore.getState();
    store.initScene(600, 600);

    // Add layer and material
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
  });

  it('computes groupBBox for multi-selection', async () => {
    const store = useSceneStore.getState();

    // Insert two rectangles
    const id1 = await store.insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 80, h: 60, x: 200, y: 200 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    // Select both
    store.setSelection([id1!, id2!]);

    const state = useSceneStore.getState();
    expect(state.ui.groupBBox).toBeDefined();
    expect(state.ui.groupBBox?.x).toBe(100);
    expect(state.ui.groupBBox?.y).toBe(100);
    expect(state.ui.groupBBox?.w).toBe(180); // 200 + 80 - 100
    expect(state.ui.groupBBox?.h).toBe(160); // 200 + 60 - 100
  });

  it('clears groupBBox when selection < 2', async () => {
    const store = useSceneStore.getState();

    const id1 = await store.insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 80, h: 60, x: 200, y: 200 });

    store.setSelection([id1!, id2!]);
    expect(useSceneStore.getState().ui.groupBBox).toBeDefined();

    // Select only one
    store.selectOnly(id1!);
    expect(useSceneStore.getState().ui.groupBBox).toBeUndefined();
  });

  it('enforces minimum 5mm per piece when scaling down', async () => {
    const store = useSceneStore.getState();
    store.setSnap10mm(false); // Disable snap for precise testing

    // Insert two small rectangles
    const id1 = await store.insertRect({ w: 10, h: 10, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 10, h: 10, x: 120, y: 100 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    store.setSelection([id1!, id2!]);

    const state = useSceneStore.getState();
    expect(state.ui.groupBBox).toBeDefined();

    // Start group resize with SE handle
    store.startGroupResize('se', { x: 130, y: 110 });

    // Try to shrink to very small size (would make pieces < 5mm)
    // Original bbox: x=100, y=100, w=30, h=10
    // Try to resize to w=10, h=3 (would make each piece 3.33mm × 3mm)
    store.updateGroupResize({ x: 110, y: 103 });

    const finalState = useSceneStore.getState();
    const piece1 = finalState.scene.pieces[id1!];
    const piece2 = finalState.scene.pieces[id2!];

    // Both pieces should be clamped to minimum 5mm
    expect(piece1.size.w).toBeGreaterThanOrEqual(5);
    expect(piece1.size.h).toBeGreaterThanOrEqual(5);
    expect(piece2.size.w).toBeGreaterThanOrEqual(5);
    expect(piece2.size.h).toBeGreaterThanOrEqual(5);

    // Commit
    store.endGroupResize(true);
  });

  it('scales all pieces proportionally around bbox center', async () => {
    const store = useSceneStore.getState();
    store.setSnap10mm(false);

    // Insert two rectangles at different positions
    const id1 = await store.insertRect({ w: 20, h: 20, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 40, h: 40, x: 140, y: 140 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    store.setSelection([id1!, id2!]);

    // groupBBox: x=100, y=100, w=80, h=80
    // center: (140, 140)

    const beforeState = useSceneStore.getState();
    const bbox = beforeState.ui.groupBBox!;
    const centerX = bbox.x + bbox.w / 2;
    const centerY = bbox.y + bbox.h / 2;

    expect(centerX).toBe(140);
    expect(centerY).toBe(140);

    // Start resize with SE handle
    store.startGroupResize('se', { x: 180, y: 180 });

    // Scale up by 1.5x: new w=120, h=120
    store.updateGroupResize({ x: 220, y: 220 });

    const afterState = useSceneStore.getState();
    const piece1 = afterState.scene.pieces[id1!];
    const piece2 = afterState.scene.pieces[id2!];

    // Piece 1 should scale from 20×20 to 30×30
    expect(piece1.size.w).toBeCloseTo(30, 1);
    expect(piece1.size.h).toBeCloseTo(30, 1);

    // Piece 2 should scale from 40×40 to 60×60
    expect(piece2.size.w).toBeCloseTo(60, 1);
    expect(piece2.size.h).toBeCloseTo(60, 1);

    // Verify positions scaled around center (140, 140)
    // piece1 original: (100, 100), distance from center: (-40, -40)
    // scaled distance: (-60, -60), new pos: (80, 80)
    expect(piece1.position.x).toBeCloseTo(80, 1);
    expect(piece1.position.y).toBeCloseTo(80, 1);

    // piece2 original: (140, 140), distance from center of bbox (140, 140): (0, 0)
    // After scaling position stays at (140, 140) since distance from center is 0
    // But wait - piece2 is at corner of bbox, not at center!
    // Let me recalculate: bbox is (100, 100) to (180, 180)
    // piece1: (100, 100) to (120, 120)
    // piece2: (140, 140) to (180, 180)
    // center of bbox: (140, 140)
    // piece2 position (140, 140) relative to center (140, 140) = offset (0, 0)
    // After 1.5x scale, piece2 should still be at offset (0, 0) from new center
    // New bbox center is still (140, 140), so piece2 stays at (140, 140)
    expect(piece2.position.x).toBeCloseTo(140, 1);
    expect(piece2.position.y).toBeCloseTo(140, 1);

    store.endGroupResize(true);
  });

  it('rollback on cancel (commit=false)', async () => {
    const store = useSceneStore.getState();

    const id1 = await store.insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 80, h: 60, x: 200, y: 200 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    store.setSelection([id1!, id2!]);

    const origPiece1 = { ...useSceneStore.getState().scene.pieces[id1!] };
    const origPiece2 = { ...useSceneStore.getState().scene.pieces[id2!] };

    // Start and update resize
    store.startGroupResize('se', { x: 280, y: 260 });
    store.updateGroupResize({ x: 320, y: 300 });

    // Verify pieces changed
    const midState = useSceneStore.getState();
    expect(midState.scene.pieces[id1!].size.w).not.toBe(origPiece1.size.w);

    // Cancel resize
    store.endGroupResize(false);

    // Verify rollback
    const finalState = useSceneStore.getState();
    expect(finalState.scene.pieces[id1!].position.x).toBe(origPiece1.position.x);
    expect(finalState.scene.pieces[id1!].position.y).toBe(origPiece1.position.y);
    expect(finalState.scene.pieces[id1!].size.w).toBe(origPiece1.size.w);
    expect(finalState.scene.pieces[id1!].size.h).toBe(origPiece1.size.h);

    expect(finalState.scene.pieces[id2!].position.x).toBe(origPiece2.position.x);
    expect(finalState.scene.pieces[id2!].position.y).toBe(origPiece2.position.y);
    expect(finalState.scene.pieces[id2!].size.w).toBe(origPiece2.size.w);
    expect(finalState.scene.pieces[id2!].size.h).toBe(origPiece2.size.h);
  });

  it('supports all 8 resize handles', async () => {
    const store = useSceneStore.getState();
    store.setSnap10mm(false);

    const id1 = await store.insertRect({ w: 40, h: 40, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 40, h: 40, x: 160, y: 160 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    store.setSelection([id1!, id2!]);

    // Test each handle
    const handles: Array<{ handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' }> = [
      'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
    ];

    for (const handle of handles) {
      const beforeState = useSceneStore.getState();
      const origSize1 = { w: beforeState.scene.pieces[id1!].size.w, h: beforeState.scene.pieces[id1!].size.h };

      store.startGroupResize(handle as any, { x: 150, y: 150 });

      // Apply a larger change to ensure we overcome minimum size constraints
      const delta = handle.includes('e') || handle.includes('s') ? 20 : -20;
      store.updateGroupResize({
        x: 150 + (handle.includes('e') ? delta : handle.includes('w') ? -delta : 0),
        y: 150 + (handle.includes('s') ? delta : handle.includes('n') ? -delta : 0)
      });

      const afterState = useSceneStore.getState();
      const newSize1 = { w: afterState.scene.pieces[id1!].size.w, h: afterState.scene.pieces[id1!].size.h };

      // Verify some change occurred (handles work) - check width OR height changed
      const changed = newSize1.w !== origSize1.w || newSize1.h !== origSize1.h;
      expect(changed).toBe(true);

      // Commit
      store.endGroupResize(true);
    }
  });

  it('no change = no history push', async () => {
    const store = useSceneStore.getState();

    const id1 = await store.insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.insertRect({ w: 80, h: 60, x: 200, y: 200 });

    store.setSelection([id1!, id2!]);

    const historyLengthBefore = useSceneStore.getState().ui.history?.past.length ?? 0;

    // Start and immediately end without any updateGroupResize
    store.startGroupResize('se', { x: 280, y: 260 });
    store.endGroupResize(true);

    const historyLengthAfter = useSceneStore.getState().ui.history?.past.length ?? 0;

    // No change should mean no history push
    expect(historyLengthAfter).toBe(historyLengthBefore);
  });
});
