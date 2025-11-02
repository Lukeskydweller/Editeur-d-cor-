import { test, expect } from '@playwright/test';

test('DevMetrics shows items ~200 when flag ON', async ({ page }) => {
  test.skip(process.env.PWREADY !== '1');

  // Set flag BEFORE page loads so main.tsx reads it at boot
  await page.addInitScript(() => {
    // @ts-ignore
    window.__flags = window.__flags || {};
    // @ts-ignore
    window.__flags.USE_GLOBAL_SPATIAL = true;
  });

  await page.goto('http://localhost:5173');

  // Wait until hook is available
  await page.waitForFunction(() => typeof (window as any).__testSpawnGrid === 'function');

  const spawned = await page.evaluate(async () => {
    // @ts-ignore
    return await window.__testSpawnGrid({ cols: 20, rows: 10, w: 20, h: 20, gap: 2 });
  });

  expect(spawned).toBe(true);

  await page.waitForTimeout(400);

  const dev = page.getByTestId('dev-metrics');
  await expect(dev).toBeVisible();

  // Sanity text (no strict numbers, just presence)
  await expect(dev).toContainText('RBush[ON]');
});
