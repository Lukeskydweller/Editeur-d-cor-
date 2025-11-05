import { test, expect } from '@playwright/test';

test.describe('Group resize live preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('svg');

    // Wait for geo worker ready
    await page.evaluate(async () => {
      const fn = (window as any).__waitGeoReady;
      if (fn) await fn();
    });
  });

  test('shows live transformed shapes during group resize', async ({ page }) => {
    // Create 3 pieces for group selection
    const pieceIds = await page.evaluate(async () => {
      const store = (window as any).__sceneStore;
      if (!store) return [];

      const id1 = await store.getState().insertRect({ w: 40, h: 60, x: 100, y: 100 });
      const id2 = await store.getState().insertRect({ w: 50, h: 50, x: 150, y: 100 });
      const id3 = await store.getState().insertRect({ w: 60, h: 40, x: 210, y: 100 });

      return [id1, id2, id3].filter(Boolean);
    });

    // Select all 3 pieces
    await page.evaluate((ids) => {
      const store = (window as any).__sceneStore;
      if (!store) return;
      store.getState().setSelection(ids);
    }, pieceIds);

    await page.waitForTimeout(300);

    // Wait for handles to appear
    await page.waitForSelector('[data-testid="selection-handles-group"]');

    // Get a group corner handle
    const handle = page.locator('[data-handle="group-corner"]').first();
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();

    // Start drag from handle
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();

    // Move pointer to trigger resize
    await page.mouse.move(handleBox!.x - 30, handleBox!.y - 30, { steps: 5 });
    await page.waitForTimeout(150); // Let RAF update

    // Verify preview overlay is visible
    const previewOverlay = page.locator('[data-testid="group-resize-preview-overlay"]');
    await expect(previewOverlay).toBeVisible();

    // Verify scale indicator shows
    const scaleText = previewOverlay.locator('text');
    await expect(scaleText).toBeVisible();
    const scaleValue = await scaleText.textContent();
    expect(scaleValue).toMatch(/×\d+\.\d+/); // Format: ×1.23

    // Verify dashed bbox is visible
    const dashedBbox = previewOverlay.locator('rect[stroke-dasharray="4 2"]');
    await expect(dashedBbox).toBeVisible();

    // CRITICAL: Verify scene.pieces has NOT been mutated during drag
    const piecesSizesBeforeEnd = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return [];
      const pieces = store.getState().scene.pieces;
      return Object.values(pieces).map((p: any) => ({ w: p.size.w, h: p.size.h }));
    });

    // Original sizes should be unchanged
    expect(piecesSizesBeforeEnd).toEqual([
      { w: 40, h: 60 },
      { w: 50, h: 50 },
      { w: 60, h: 40 },
    ]);

    // End resize
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Verify preview overlay is gone
    await expect(previewOverlay).not.toBeVisible();

    // Verify handles have remounted (visible again)
    await expect(page.locator('[data-testid="selection-handles-group"]')).toBeVisible();

    // Verify pieces have NOW been mutated (after commit)
    const piecesSizesAfterEnd = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return [];
      const pieces = store.getState().scene.pieces;
      return Object.values(pieces).map((p: any) => ({ w: p.size.w, h: p.size.h }));
    });

    // Sizes should have changed (scaled)
    expect(piecesSizesAfterEnd[0].w).not.toBe(40);
    expect(piecesSizesAfterEnd[0].h).not.toBe(60);
  });

  test('no scene mutation during drag verified via API', async ({ page }) => {
    // Create and select 2 pieces
    const pieceIds = await page.evaluate(async () => {
      const store = (window as any).__sceneStore;
      if (!store) return [];

      const id1 = await store.getState().insertRect({ w: 40, h: 60, x: 100, y: 100 });
      const id2 = await store.getState().insertRect({ w: 50, h: 50, x: 150, y: 100 });

      store.getState().setSelection([id1, id2].filter(Boolean));
      return [id1, id2].filter(Boolean);
    });

    await page.waitForTimeout(300);
    await page.waitForSelector('[data-testid="selection-handles-group"]');

    // Take snapshot before drag
    const snapshotBefore = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return '';
      return JSON.stringify(store.getState().scene.pieces);
    });

    // Perform drag
    const handle = page.locator('[data-handle="group-corner"]').first();
    const handleBox = await handle.boundingBox();
    expect(handleBox).not.toBeNull();

    await page.mouse.move(handleBox!.x + 4, handleBox!.y + 4);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 25, handleBox!.y + 25, { steps: 3 });
    await page.waitForTimeout(150);

    // Take snapshot during drag (should be identical)
    const snapshotDuring = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return '';
      return JSON.stringify(store.getState().scene.pieces);
    });
    expect(snapshotDuring).toBe(snapshotBefore);

    // End drag
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Take snapshot after commit (should be different)
    const snapshotAfter = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return '';
      return JSON.stringify(store.getState().scene.pieces);
    });
    expect(snapshotAfter).not.toBe(snapshotBefore);
  });

  test('preview shows correct matrix transforms', async ({ page }) => {
    const pieceIds = await page.evaluate(async () => {
      const store = (window as any).__sceneStore;
      if (!store) return [];

      const id1 = await store.getState().insertRect({ w: 40, h: 60, x: 100, y: 100 });
      const id2 = await store.getState().insertRect({ w: 50, h: 50, x: 150, y: 100 });

      store.getState().setSelection([id1, id2].filter(Boolean));
      return [id1, id2].filter(Boolean);
    });

    await page.waitForTimeout(300);
    await page.waitForSelector('[data-testid="selection-handles-group"]');

    const handle = page.locator('[data-handle="group-corner"]').first();
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox!.x + 4, handleBox!.y + 4);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 20, handleBox!.y + 20, { steps: 3 });
    await page.waitForTimeout(150);

    // Verify preview pieces have transform matrices
    const previewMatrices = await page.evaluate(() => {
      const store = (window as any).__sceneStore;
      if (!store) return undefined;
      const preview = store.getState().ui.groupResizing?.preview;
      return preview?.previewPieces?.map((pp: any) => pp.matrix);
    });

    expect(previewMatrices).toBeDefined();
    expect(previewMatrices?.length).toBe(2);

    // Verify matrices are isotropic (a === d for scale transform)
    for (const matrix of previewMatrices!) {
      expect(matrix.a).toBeCloseTo(matrix.d, 5);
      expect(matrix.b).toBe(0); // no rotation
      expect(matrix.c).toBe(0);
    }

    await page.mouse.up();
  });
});
