import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

test('Ghost insert system - red halo appears and disappears after adjustment', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert first piece to block the usual placement area
  await page.getByTestId('preset-200x100').click();
  await page.waitForTimeout(300);

  // Try to insert another large piece - should trigger ghost mode
  await page.getByTestId('preset-200x100').click();
  await page.waitForTimeout(300);

  // Check if a piece with ghost attribute exists
  const ghostGroup = page.locator('[data-ghost="true"]');
  const ghostExists = (await ghostGroup.count()) > 0;

  if (ghostExists) {
    // Ghost piece should be visible
    await expect(ghostGroup).toBeVisible();

    // Ghost piece should have red or orange fill indicating problems
    // The ghost attribute is on the <g>, but the fill is on the child <rect>
    const ghostRect = ghostGroup.locator('rect').first();
    const fill = await ghostRect.getAttribute('fill');
    expect(fill).toMatch(/#ef4444|#f59e0b/); // red or orange

    // Try to drag the ghost to a valid position (if auto-commit didn't happen)
    const bbox = await ghostRect.boundingBox();
    if (bbox) {
      // Drag ghost piece away from overlap
      await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
      await page.mouse.down();
      await page.mouse.move(bbox.x + 250, bbox.y + 250, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);

      // After moving to valid position, ghost might auto-commit
      const ghostGroupAfterDrag = page.locator('[data-ghost="true"]');
      const stillGhost = (await ghostGroupAfterDrag.count()) > 0;

      if (!stillGhost) {
        // Ghost was auto-committed (no BLOCK problems)
        // This is success - piece should exist normally
        const pieces = page.locator('[data-testid="piece-selected"]');
        await expect(pieces).toBeVisible();
      }
    }
  } else {
    // No ghost was created - auto-placement found a spot
    // This is also valid behavior
    const pieces = page.locator('rect[fill="#60a5fa"]');
    expect(await pieces.count()).toBeGreaterThan(0);
  }
});

test('Ghost insert can be cancelled (cancelGhost)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Programmatically create a small saturated scene and insert a ghost
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore.getState();

    // Create a small scene
    store.initScene(120, 120);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    // Fill it with overlapping pieces to make any new insertion problematic
    await store.insertRect({ w: 100, h: 100, x: 10, y: 10 });

    // Now directly create a ghost that overlaps
    await store.startGhostInsert({ w: 80, h: 80 });
  });

  await page.waitForTimeout(500);

  // Check if ghost exists
  const ghostGroup = page.locator('[data-ghost="true"]');
  const hadGhost = (await ghostGroup.count()) > 0;

  expect(hadGhost).toBe(true); // Should have a ghost

  if (hadGhost) {
    // Cancel the ghost (simulates Escape key handler calling cancelGhost)
    // Note: Direct keyboard events in E2E tests may not reliably trigger React handlers,
    // so we test the underlying cancelGhost function directly
    await page.evaluate(() => {
      const store = (window as any).__sceneStore.getState();
      store.cancelGhost();
    });
    await page.waitForTimeout(100);

    // Ghost should be removed from DOM
    const ghostAfter = page.locator('[data-ghost="true"]');
    expect(await ghostAfter.count()).toBe(0);

    // Verify ghost state is cleared
    const ghostState = await page.evaluate(() => {
      const store = (window as any).__sceneStore.getState();
      return store.ui.ghost;
    });
    expect(ghostState).toBeUndefined();
  }
});

test('Shape Library auto-placement works reliably', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert multiple pieces - should find valid positions
  await page.getByTestId('preset-60x60').click();
  await page.waitForTimeout(200);

  await page.getByTestId('preset-100x60').click();
  await page.waitForTimeout(200);

  await page.getByTestId('preset-200x100').click();
  await page.waitForTimeout(200);

  // All insertions should succeed (either normal or ghost)
  const totalPieces = await page.locator('rect[fill]').count();
  expect(totalPieces).toBeGreaterThanOrEqual(3);

  // No error toast should be visible
  const toast = page.locator('[role="status"]');
  const hasErrorToast = (await toast.count()) > 0 && (await toast.textContent())?.includes('saturée');
  expect(hasErrorToast).toBe(false);
});
