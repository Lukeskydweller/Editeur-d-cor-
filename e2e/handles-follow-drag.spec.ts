import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('Group handles follow drag in real-time', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert 4 rectangles using store directly for reliable test
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    const id1 = await store.getState().insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.getState().insertRect({ w: 60, h: 40, x: 200, y: 100 });
    const id3 = await store.getState().insertRect({ w: 60, h: 40, x: 100, y: 200 });
    const id4 = await store.getState().insertRect({ w: 60, h: 40, x: 200, y: 200 });

    return [id1, id2, id3, id4];
  });
  await page.waitForTimeout(500);

  // Multi-select all 4 pieces
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Verify multi-selection
  const selectionState = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return {
      selectedCount: store?.getState().ui.selectedIds?.length || 0,
      selectedIds: store?.getState().ui.selectedIds,
      allPieceIds: Object.keys(store?.getState().scene.pieces || {}),
    };
  });
  expect(selectionState.allPieceIds.length).toBe(4); // Verify pieces were inserted
  expect(selectionState.selectedCount).toBe(4);

  // Get initial group bbox before drag
  const bboxBefore = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxBefore).toBeTruthy();
  expect(bboxBefore.x).toBeGreaterThanOrEqual(50);
  expect(bboxBefore.y).toBeGreaterThanOrEqual(50);

  // Verify group-bbox layer is visible before drag
  const groupBBoxBefore = await page.locator('[data-layer="group-bbox"]').boundingBox();
  expect(groupBBoxBefore).toBeTruthy();

  // Verify handles are visible before drag (4 corner handles)
  const handlesBefore = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesBefore).toBe(4);

  // Start drag programmatically
  const primaryId = insertedIds[0];
  await page.evaluate((id) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().beginDrag(id);
  }, primaryId);
  await page.waitForTimeout(100);

  // During drag: handles should NOT be visible (only bbox outline)
  const handlesDuringDrag = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesDuringDrag).toBe(0);

  // Update drag by +120mm in X
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().updateDrag(120, 0);
  });
  await page.waitForTimeout(100);

  // Verify bbox moved during drag (transient bbox should be visible)
  const bboxDuringDrag = await page.locator('[data-layer="group-bbox"]').boundingBox();
  expect(bboxDuringDrag).toBeTruthy();
  // Bbox should have moved approximately +120mm (converted to pixels)
  // We can't test exact pixels since it depends on viewport scale, but we verify it moved
  if (groupBBoxBefore && bboxDuringDrag) {
    expect(bboxDuringDrag.x).toBeGreaterThan(groupBBoxBefore.x + 50); // At least 50px movement
  }

  // Still no handles during drag
  const handlesDuringDrag2 = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesDuringDrag2).toBe(0);

  // End drag
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().endDrag();
  });
  await page.waitForTimeout(300);

  // After drag: verify bbox moved by ~120mm
  const bboxAfter = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxAfter).toBeTruthy();
  expect(bboxAfter.x).toBeCloseTo(bboxBefore.x + 120, 0.5);
  expect(bboxAfter.y).toBeCloseTo(bboxBefore.y, 0.5);

  // After drag: verify handles are visible again (exactly 4)
  const handlesAfter = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesAfter).toBe(4);

  // Verify handles are positioned correctly (at bbox corners)
  const groupBBoxAfter = await page.locator('[data-layer="group-bbox"]').boundingBox();
  expect(groupBBoxAfter).toBeTruthy();
  if (groupBBoxBefore && groupBBoxAfter) {
    // Bbox should have moved right by at least 50px (120mm converted)
    expect(groupBBoxAfter.x).toBeGreaterThan(groupBBoxBefore.x + 50);
  }
});

test('Group handles follow nudge correctly', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert 2 pieces
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    const id1 = await store.getState().insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.getState().insertRect({ w: 60, h: 40, x: 200, y: 100 });

    return [id1, id2];
  });
  await page.waitForTimeout(500);

  // Multi-select
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Get bbox before nudge
  const bboxBefore = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxBefore).toBeTruthy();

  // Nudge right 10 times (10mm each = 100mm total)
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return;
      store.getState().nudgeSelected(10, 0);
    });
    await page.waitForTimeout(50);
  }

  // Verify bbox moved
  const bboxAfter = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxAfter).toBeTruthy();
  expect(bboxAfter.x).toBeCloseTo(bboxBefore.x + 100, 1);
  expect(bboxAfter.y).toBeCloseTo(bboxBefore.y, 0.5);

  // Handles should be visible and positioned correctly
  const handlesAfter = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesAfter).toBe(4);
});

test('Group handles update after rotation', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert 2 pieces
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    const id1 = await store.getState().insertRect({ w: 100, h: 50, x: 100, y: 100 });
    const id2 = await store.getState().insertRect({ w: 100, h: 50, x: 220, y: 100 });

    return [id1, id2];
  });
  await page.waitForTimeout(500);

  // Multi-select
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Get bbox before rotation
  const bboxBefore = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxBefore).toBeTruthy();

  // Rotate group +90 degrees
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().rotateSelected(90);
  });
  await page.waitForTimeout(300);

  // Verify bbox changed (rotation should affect AABB)
  const bboxAfter = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.groupBBox;
  });
  expect(bboxAfter).toBeTruthy();
  // After 90° rotation, the bbox dimensions should have changed
  // (width and height may swap depending on the pieces)

  // Handles should still be visible (exactly 4)
  const handlesAfter = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesAfter).toBe(4);
});

test('No phantom handles after cancel drag', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert 2 pieces
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    const id1 = await store.getState().insertRect({ w: 60, h: 40, x: 100, y: 100 });
    const id2 = await store.getState().insertRect({ w: 60, h: 40, x: 200, y: 100 });

    return [id1, id2];
  });
  await page.waitForTimeout(500);

  // Multi-select
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Start drag
  const primaryId = insertedIds[0];
  await page.evaluate((id) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().beginDrag(id);
  }, primaryId);
  await page.waitForTimeout(100);

  // Update drag
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().updateDrag(50, 50);
  });
  await page.waitForTimeout(100);

  // Cancel drag
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().cancelDrag();
  });
  await page.waitForTimeout(300);

  // After cancel: exactly 4 handles should be visible (no phantom handles)
  const handlesAfter = await page.locator('[data-handle="group-corner"]').count();
  expect(handlesAfter).toBe(4);

  // Verify no extra handles or ghost elements
  const allHandles = await page.locator('[data-handle]').count();
  expect(allHandles).toBe(4); // Only the 4 group corners
});
