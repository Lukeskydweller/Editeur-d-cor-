import { test, expect } from '@playwright/test';

/**
 * E2E A1: Non-regression test for cross-layer blocking
 *
 * Scenario: A C2 piece in ghost (WARN) state on C1 should NOT block
 * moving another C2 piece on the same layer.
 *
 * This validates that ghost state only affects the piece itself, not
 * other pieces on the same layer.
 */
test('C2 ghost on C1 does not block moving another C2', async ({ page }) => {
  // Navigate to app
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Enable debug logging
  await page.evaluate(() => {
    (window as any).__DBG_DRAG__ = true;
  });

  // Wait for app to be ready
  await page.waitForSelector('svg', { timeout: 5000 });

  // Arrange: Create scene with C1 support and 2 C2 pieces (A and B)
  const ids = await page.evaluate(() => {
    const T = (window as any).__TEST__;
    if (!T) throw new Error('__TEST__ API not available');

    T.initSceneWithDefaults(600, 600);

    const layers = T.getFixedLayerIds();
    const { C1, C2 } = layers;

    // Create C1 support: large rect at (200, 300) with size 500×180
    const c1 = T.newRect(C1, 200, 300, 500, 180);

    // Create C2 piece A: fully supported at (260, 340) with size 160×120
    const a = T.newRect(C2, 260, 340, 160, 120);

    // Create C2 piece B: fully supported at (460, 360) with size 120×100
    const b = T.newRect(C2, 460, 360, 120, 100);

    // Return IDs
    return { a, b };
  });

  // Store IDs globally for later evaluation calls
  await page.evaluate((ids) => {
    (window as any).__IDS__ = ids;
  }, ids);

  // Act 1: Move piece A so it becomes partially unsupported
  // Drag A by (-120, -120) to make it overhang C1 support
  const aPosBefore = await page.evaluate(() => {
    const { a } = (window as any).__IDS__;
    return (window as any).__TEST__.getPieceRect(a);
  });

  await page.evaluate(() => {
    const { a } = (window as any).__IDS__;
    const T = (window as any).__TEST__;
    T.dragBy(a, -120, -120);
  });

  const aPosAfter = await page.evaluate(() => {
    const { a } = (window as any).__IDS__;
    return (window as any).__TEST__.getPieceRect(a);
  });

  // Verify piece A moved
  expect(aPosAfter.x).toBeLessThan(aPosBefore.x);

  // Act 2: Try to move piece B (should NOT be blocked by A)
  const bBefore = await page.evaluate(() => {
    const { b } = (window as any).__IDS__;
    return (window as any).__TEST__.getPieceRect(b);
  });

  await page.evaluate(() => {
    const { b } = (window as any).__IDS__;
    (window as any).__TEST__.dragBy(b, 80, 0);
  });

  const bAfter = await page.evaluate(() => {
    const { b } = (window as any).__IDS__;
    return (window as any).__TEST__.getPieceRect(b);
  });

  // Assert: B should have moved successfully (not blocked by A)
  // The key point is that B DID move (wasn't blocked by A's potential ghost state)
  expect(bAfter.x).toBeGreaterThan(bBefore.x);
  // Movement might be affected by snap/collision detection, but the essential
  // test is that piece B is NOT blocked by piece A
  expect(bAfter.x - bBefore.x).toBeGreaterThan(10); // At least some movement occurred
});
