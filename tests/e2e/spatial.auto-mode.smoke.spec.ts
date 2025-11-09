import { test, expect } from '@playwright/test';

/**
 * Spatial AUTO mode - Smoke test
 *
 * Creates 150 non-overlapping pieces (well-spaced) to verify:
 * - AUTO mode activates RBush at threshold (120 pieces)
 * - Drag/resize operations work correctly
 * - Spatial queries are tracked (queries.RBUSH > 0)
 *
 * Uses window.__TEST__ driver API exclusively (no DOM clicks)
 */
test.describe('Spatial AUTO mode - Smoke test', () => {
  test('AUTO mode activates RBush with 150 non-overlapping pieces', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to be ready
    await page.waitForSelector('svg', { timeout: 5000 });

    // Arrange: Create scene with 150 non-overlapping pieces (well-spaced grid)
    const pieceIds = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      if (!T) throw new Error('__TEST__ API not available');

      T.initSceneWithDefaults(3000, 3000);

      const layers = T.getFixedLayerIds();
      const { C1, C2 } = layers;

      // Create C1 support base
      T.newRect(C1, 0, 0, 3000, 3000);

      // Create 150 pieces on C2 in a well-spaced 10x15 grid
      // Spacing: 200mm between piece origins (80mm pieces + 120mm gap)
      const ids: string[] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 15; col++) {
          const x = 100 + col * 200; // Large spacing to avoid overlaps
          const y = 100 + row * 200;
          const id = T.newRect(C2, x, y, 80, 80);
          ids.push(id);
        }
      }

      return ids;
    });

    expect(pieceIds.length).toBe(150);

    // Get initial position of first piece
    const posBefore = await page.evaluate((id) => {
      const T = (window as any).__TEST__;
      return T.getPieceRect(id);
    }, pieceIds[0]);

    // Act: Perform a drag operation (move piece to empty space)
    // Enable debug logging
    await page.evaluate(() => {
      (window as any).__DBG_DRAG__ = true;
    });

    await page.evaluate((id) => {
      const T = (window as any).__TEST__;
      T.select(id);
      // Move by 100mm - closer to neighbors to trigger spatial queries
      // With 200mm spacing and 80mm pieces, moving 100mm brings us within snap range of neighbor
      T.dragBy(id, 100, 0);
    }, pieceIds[0]);

    // Assert: Verify piece moved successfully
    const posAfter = await page.evaluate((id) => {
      const T = (window as any).__TEST__;
      return T.getPieceRect(id);
    }, pieceIds[0]);

    expect(posAfter.x).toBeGreaterThan(posBefore.x);
    // Moving 100mm horizontally (y unchanged)
    expect(posAfter.x - posBefore.x).toBeCloseTo(100, 1); // ±1mm tolerance
    expect(posAfter.y).toBeCloseTo(posBefore.y, 1); // Y should be unchanged

    // Assert: Verify RBush queries occurred (AUTO mode active)
    const { stats, debug } = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      return {
        stats: T.getSpatialStats(),
        debug: T.getUIState(),
      };
    });

    console.log('[SMOKE] Debug info:', debug);
    console.log('[SMOKE] Stats:', stats);

    expect(stats).toBeDefined();
    expect(stats.queries).toBeDefined();
    expect(stats.queries.RBUSH).toBeGreaterThan(0);

    console.log(`[SMOKE] ✓ RBush queries: ${stats.queries.RBUSH}`);
    console.log(
      `[SMOKE] ✓ Piece moved: (${posBefore.x}, ${posBefore.y}) → (${posAfter.x}, ${posAfter.y})`,
    );
  });

  test('multiple drag operations accumulate RBush queries', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to be ready
    await page.waitForSelector('svg', { timeout: 5000 });

    // Arrange: Create scene with 130 pieces (above threshold)
    const pieceIds = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      if (!T) throw new Error('__TEST__ API not available');

      T.initSceneWithDefaults(2600, 2600);

      const layers = T.getFixedLayerIds();
      const { C1, C2 } = layers;

      // Create C1 support base
      T.newRect(C1, 0, 0, 2600, 2600);

      // Create 130 pieces on C2 (10x13 grid, well-spaced)
      const ids: string[] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 13; col++) {
          const x = 100 + col * 200;
          const y = 100 + row * 200;
          const id = T.newRect(C2, x, y, 80, 80);
          ids.push(id);
        }
      }

      return ids;
    });

    expect(pieceIds.length).toBe(130);

    // Act: Perform multiple drag operations
    for (let i = 0; i < 3; i++) {
      await page.evaluate(
        ({ id, dx, dy }) => {
          const T = (window as any).__TEST__;
          T.select(id);
          T.dragBy(id, dx, dy);
        },
        { id: pieceIds[i], dx: 100, dy: 0 },
      );
    }

    // Assert: Verify RBush queries accumulated
    const stats = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      return T.getSpatialStats();
    });

    expect(stats.queries.RBUSH).toBeGreaterThan(5); // At least 2 queries per drag × 3 drags

    console.log(`[SMOKE] ✓ Multiple drags successful with ${stats.queries.RBUSH} RBush queries`);
  });
});
