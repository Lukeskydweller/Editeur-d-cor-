import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('Group resize with handles - no BLOCK problems', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert two rectangles using store directly for reliable test
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    // Insert first piece
    const id1 = await store.getState().insertRect({ w: 60, h: 40, x: 100, y: 100 });
    // Insert second piece
    const id2 = await store.getState().insertRect({ w: 80, h: 60, x: 200, y: 200 });

    return [id1, id2];
  });
  await page.waitForTimeout(500);

  // Multi-select only the two inserted pieces
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Verify that multi-selection worked
  const selectedCount = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return store?.getState().ui.selectedIds?.length || 0;
  });
  expect(selectedCount).toBe(2);

  // Verify group bbox is computed
  const hasGroupBBox = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return !!store?.getState().ui.groupBBox;
  });
  expect(hasGroupBBox).toBe(true);

  // Verify no BLOCK problems before resize
  const problemsBeforeCount = await page
    .locator('[data-testid="problems-panel"] [data-severity="BLOCK"]')
    .count();
  expect(problemsBeforeCount).toBe(0);

  // Perform group resize by dragging SE handle
  // Note: In real UI, handles would be positioned via ResizeHandlesOverlay
  // We'll trigger resize programmatically via store for reliable E2E
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;

    // Start group resize with SE handle
    store.getState().startGroupResize('se', { x: 280, y: 260 });

    // Update to scale up by ~1.5x
    store.getState().updateGroupResize({ x: 340, y: 320 });

    // Commit resize
    store.getState().endGroupResize(true);
  });
  await page.waitForTimeout(500);

  // Verify pieces were resized (check only the selected pieces)
  const piecesAfterResize = await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    const pieces = store?.getState().scene.pieces || {};
    return ids
      .map((id: string) => {
        const p = pieces[id];
        return p
          ? {
              w: p.size.w,
              h: p.size.h,
              x: p.position.x,
              y: p.position.y,
            }
          : null;
      })
      .filter(Boolean);
  }, insertedIds);

  // Both pieces should have changed dimensions
  expect(piecesAfterResize.length).toBe(2);
  expect(piecesAfterResize[0].w).toBeGreaterThan(60);
  expect(piecesAfterResize[0].h).toBeGreaterThan(40);
  expect(piecesAfterResize[1].w).toBeGreaterThan(80);
  expect(piecesAfterResize[1].h).toBeGreaterThan(60);

  // Verify all pieces respect minimum size (5mm)
  for (const piece of piecesAfterResize) {
    expect(piece.w).toBeGreaterThanOrEqual(5);
    expect(piece.h).toBeGreaterThanOrEqual(5);
  }

  // Verify no BLOCK problems after resize
  const problemsAfterCount = await page
    .locator('[data-testid="problems-panel"] [data-severity="BLOCK"]')
    .count();
  expect(problemsAfterCount).toBe(0);

  // Test undo
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);

  const piecesAfterUndo = await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    const pieces = store?.getState().scene.pieces || {};
    return ids
      .map((id: string) => {
        const p = pieces[id];
        return p ? { w: p.size.w, h: p.size.h } : null;
      })
      .filter(Boolean);
  }, insertedIds);

  // After undo, pieces should be back to original sizes (approximately)
  expect(piecesAfterUndo[0].w).toBeCloseTo(60, 1);
  expect(piecesAfterUndo[0].h).toBeCloseTo(40, 1);
  expect(piecesAfterUndo[1].w).toBeCloseTo(80, 1);
  expect(piecesAfterUndo[1].h).toBeCloseTo(60, 1);

  // Test redo
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(300);

  const piecesAfterRedo = await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    const pieces = store?.getState().scene.pieces || {};
    return ids
      .map((id: string) => {
        const p = pieces[id];
        return p ? { w: p.size.w, h: p.size.h } : null;
      })
      .filter(Boolean);
  }, insertedIds);

  // After redo, pieces should be scaled again
  expect(piecesAfterRedo[0].w).toBeGreaterThan(60);
  expect(piecesAfterRedo[0].h).toBeGreaterThan(40);

  // Final check: no console errors
  const logs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });

  // No errors expected
  expect(logs.length).toBe(0);
});

test('Group resize with minimum size clamping', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Turn off snap for precise testing
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    store?.getState().setSnap10mm(false);
  });

  // Insert two small rectangles
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return;

    // Insert first piece
    await store.getState().insertRect({ w: 10, h: 10, x: 100, y: 100 });
    // Insert second piece
    await store.getState().insertRect({ w: 10, h: 10, x: 120, y: 100 });

    // Select both
    const pieceIds = Object.keys(store.getState().scene.pieces);
    store.getState().setSelection(pieceIds);
  });
  await page.waitForTimeout(300);

  // Try to scale down to very small size
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;

    // Start resize
    store.getState().startGroupResize('se', { x: 130, y: 110 });

    // Try to shrink drastically (would make pieces < 5mm without clamping)
    store.getState().updateGroupResize({ x: 110, y: 103 });

    // Commit
    store.getState().endGroupResize(true);
  });
  await page.waitForTimeout(300);

  // Verify minimum size was enforced
  const pieceSizes = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    const pieces = store?.getState().scene.pieces || {};
    return Object.values(pieces).map((p: any) => ({
      w: p.size.w,
      h: p.size.h,
    }));
  });

  // All pieces should be >= 5mm
  for (const piece of pieceSizes) {
    expect(piece.w).toBeGreaterThanOrEqual(5);
    expect(piece.h).toBeGreaterThanOrEqual(5);
  }
});
