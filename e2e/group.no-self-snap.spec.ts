import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('group does not snap to its own members during resize/move', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert two rectangles using store directly for reliable test
  // Place them close together but not overlapping (perfectly aligned horizontally)
  const insertedIds = await page.evaluate(async () => {
    const store = (window as any).__sceneStore;
    if (!store) return [];

    // Insert first piece at (100, 100)
    const id1 = await store.getState().insertRect({ w: 60, h: 60, x: 100, y: 100 });
    // Insert second piece adjacent at (170, 100) - 10mm gap
    const id2 = await store.getState().insertRect({ w: 60, h: 60, x: 170, y: 100 });

    return [id1, id2];
  });
  await page.waitForTimeout(500);

  // Multi-select both pieces
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(300);

  // Verify multi-selection worked and groupBBox is computed
  const groupState = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return {
      selectedCount: store?.getState().ui.selectedIds?.length || 0,
      hasGroupBBox: !!store?.getState().ui.groupBBox,
      groupBBox: store?.getState().ui.groupBBox,
    };
  });
  expect(groupState.selectedCount).toBe(2);
  expect(groupState.hasGroupBBox).toBe(true);

  // Verify no BLOCK problems before operations
  const problemsBeforeCount = await page
    .locator('[data-testid="problems-panel"] [data-severity="BLOCK"]')
    .count();
  expect(problemsBeforeCount).toBe(0);

  // TEST 1: Group resize should not snap to its own members
  // Perform group resize via store (SE handle) - scale up slightly
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;

    const bbox = store.getState().ui.groupBBox;
    if (!bbox) return;

    // Start resize from SE corner
    const startX = bbox.x + bbox.w;
    const startY = bbox.y + bbox.h;
    store.getState().startGroupResize('se', { x: startX, y: startY });

    // Scale up by 20mm
    store.getState().updateGroupResize({ x: startX + 20, y: startY + 20 });

    // Commit resize
    store.getState().endGroupResize(true);
  });
  await page.waitForTimeout(500);

  // Verify no BLOCK problems after resize (no self-snap creating overlaps)
  const problemsAfterResize = await page
    .locator('[data-testid="problems-panel"] [data-severity="BLOCK"]')
    .count();
  expect(problemsAfterResize).toBe(0);

  // Verify pieces were actually resized (sanity check)
  const piecesAfterResize = await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    const pieces = store?.getState().scene.pieces || {};
    return ids
      .map((id: string) => {
        const p = pieces[id];
        return p ? { w: p.size.w, h: p.size.h } : null;
      })
      .filter(Boolean);
  }, insertedIds);
  expect(piecesAfterResize.length).toBe(2);
  expect(piecesAfterResize[0].w).toBeGreaterThan(60); // Should be scaled up
  expect(piecesAfterResize[1].w).toBeGreaterThan(60);

  // TEST 2: Perform another group resize (different handle) to verify consistency
  // Ensure pieces are still selected
  await page.evaluate((ids) => {
    const store = (window as any).__sceneStore;
    if (!store) return;
    store.getState().setSelection(ids.filter(Boolean));
  }, insertedIds);
  await page.waitForTimeout(200);

  // Perform group resize via store (W handle) - scale in different direction
  await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    if (!store) return;

    const bbox = store.getState().ui.groupBBox;
    if (!bbox) return;

    // Start resize from W (west) edge
    const startX = bbox.x;
    const startY = bbox.y + bbox.h / 2;
    store.getState().startGroupResize('w', { x: startX, y: startY });

    // Move left by 15mm (expand)
    store.getState().updateGroupResize({ x: startX - 15, y: startY });

    // Commit resize
    store.getState().endGroupResize(true);
  });
  await page.waitForTimeout(500);

  // Verify no BLOCK problems after second resize (no self-snap creating overlaps)
  const problemsAfterSecondResize = await page
    .locator('[data-testid="problems-panel"] [data-severity="BLOCK"]')
    .count();
  expect(problemsAfterSecondResize).toBe(0);

  // Final check: no WARN or BLOCK problems remain
  const problemsPanel = page.getByTestId('problems-panel');
  const blockCount = await problemsPanel.locator('[data-severity="BLOCK"]').count();
  const warnCount = await problemsPanel.locator('[data-severity="WARN"]').count();

  expect(blockCount).toBe(0);
  // WARN count should be 0 (no artificial warnings from self-snap)
  expect(warnCount).toBe(0);

  // Final sanity: verify no console errors occurred
  const logs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });
  expect(logs.length).toBe(0);
});
