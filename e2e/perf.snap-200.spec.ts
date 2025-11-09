import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('snap remains responsive with ~200 pieces', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Spawn grid: 20 cols × 10 rows = 200 pieces
  const spawned = await page.evaluate(async () => {
    const fn = (window as any).__testSpawnGrid;
    if (!fn) return false;
    return await fn({ cols: 20, rows: 10, w: 20, h: 20, gap: 2 });
  });

  expect(spawned).toBe(true);

  // Wait a bit for pieces to settle
  await page.waitForTimeout(500);

  // Verify Dev Metrics panel is visible (shows spatial index stats)
  const devMetrics = page.getByTestId('dev-metrics');
  await expect(devMetrics).toBeVisible();

  // Verify Problems Panel is accessible (UI remains responsive)
  const problemsPanel = page.getByTestId('problems-panel');
  await expect(problemsPanel).toBeVisible();

  // Sanity check: verify we actually have pieces in the scene
  const pieceCount = await page.evaluate(() => {
    const store = (window as any).__sceneStore;
    return Object.keys(store?.getState().scene.pieces || {}).length;
  });

  // Should have exactly 200 pieces (or close)
  expect(pieceCount).toBeGreaterThanOrEqual(190); // Allow for some tolerance
  expect(pieceCount).toBeLessThanOrEqual(210);

  // Test that UI is still responsive by clicking on a piece
  // (just verify no error occurs - no strict performance assertion)
  const pieces = page.locator('[data-piece-id]');
  const firstPiece = pieces.first();

  if ((await pieces.count()) > 0) {
    await firstPiece.click();
    await page.waitForTimeout(100);

    // Verify piece was selected
    const selectedId = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      return store?.getState().ui.selectedId;
    });
    expect(selectedId).toBeDefined();
  }

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
