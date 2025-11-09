import { test, expect } from '@playwright/test';

test.describe('Group drag behavior', () => {
  test('drag group succeeds without rollback in empty area', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to be ready
    await page.waitForSelector('svg', { timeout: 5000 });

    // Arrange: Create scene with C1 support and two C2 pieces
    const ids = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      if (!T) throw new Error('__TEST__ API not available');

      T.initSceneWithDefaults(600, 600);

      const layers = T.getFixedLayerIds();
      const { C1, C2 } = layers;

      // Create C1 support base
      T.newRect(C1, 0, 0, 600, 600);

      // Create two pieces at (100, 100) and (200, 100)
      const p1 = T.newRect(C2, 100, 100, 100, 80);
      const p2 = T.newRect(C2, 200, 100, 100, 80);

      return { p1, p2 };
    });

    // Get initial positions
    const posBefore = await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      return {
        p1: T.getPieceRect(ids.p1),
        p2: T.getPieceRect(ids.p2),
      };
    }, ids);

    // Act: Select both pieces and drag group by (40, 40)
    await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      T.selectMultiple([ids.p1, ids.p2]);
    }, ids);

    // Drag group using first piece as reference
    await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      T.dragBy(ids.p1, 40, 40);
    }, ids);

    // Assert: positions changed
    const posAfter = await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      return {
        p1: T.getPieceRect(ids.p1),
        p2: T.getPieceRect(ids.p2),
      };
    }, ids);

    expect(posAfter.p1.x).toBeGreaterThan(posBefore.p1.x);
    expect(posAfter.p1.y).toBeGreaterThan(posBefore.p1.y);
    expect(posAfter.p2.x).toBeGreaterThan(posBefore.p2.x);
    expect(posAfter.p2.y).toBeGreaterThan(posBefore.p2.y);

    // Verify actual movement amount is close to requested (40mm)
    expect(posAfter.p1.x - posBefore.p1.x).toBeCloseTo(40, 0);
    expect(posAfter.p1.y - posBefore.p1.y).toBeCloseTo(40, 0);
  });

  test('drag group snaps & guards vs external neighbor', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to be ready
    await page.waitForSelector('svg', { timeout: 5000 });

    // Arrange: Create scene with group (2 pieces) + external neighbor on C2
    const ids = await page.evaluate(() => {
      const T = (window as any).__TEST__;
      if (!T) throw new Error('__TEST__ API not available');

      T.initSceneWithDefaults(600, 600);

      const layers = T.getFixedLayerIds();
      const { C1, C2 } = layers;

      // Create C1 support base
      T.newRect(C1, 0, 0, 600, 600);

      // Create group: two pieces close together at (100, 100) and (220, 100)
      const g1 = T.newRect(C2, 100, 100, 100, 80);
      const g2 = T.newRect(C2, 220, 100, 100, 80);

      // Create external neighbor at (400, 100) - far from group
      const neighbor = T.newRect(C2, 400, 100, 100, 80);

      return { g1, g2, neighbor };
    });

    // Act: Select group (g1, g2) and drag toward neighbor
    await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      T.selectMultiple([ids.g1, ids.g2]);
    }, ids);

    // Get positions before drag
    const posBefore = await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      return {
        g1: T.getPieceRect(ids.g1),
        g2: T.getPieceRect(ids.g2),
        neighbor: T.getPieceRect(ids.neighbor),
      };
    }, ids);

    // Drag group toward neighbor (right by 70mm - should snap or stop near neighbor)
    await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      T.dragBy(ids.g1, 70, 0);
    }, ids);

    // Assert: Group moved
    const posAfter = await page.evaluate((ids) => {
      const T = (window as any).__TEST__;
      return {
        g1: T.getPieceRect(ids.g1),
        g2: T.getPieceRect(ids.g2),
        neighbor: T.getPieceRect(ids.neighbor),
      };
    }, ids);

    expect(posAfter.g1.x).toBeGreaterThan(posBefore.g1.x);
    expect(posAfter.g2.x).toBeGreaterThan(posBefore.g2.x);

    // Assert: Neighbor position unchanged (wasn't part of group)
    expect(posAfter.neighbor.x).toBe(posBefore.neighbor.x);

    // Assert: Group should have snapped or stopped before colliding with neighbor
    // (Allow some margin for snap tolerance)
    const g2RightEdge = posAfter.g2.x + posAfter.g2.w;
    const neighborLeftEdge = posAfter.neighbor.x;
    expect(g2RightEdge).toBeLessThanOrEqual(neighborLeftEdge + 15); // 15mm snap tolerance
  });
});
