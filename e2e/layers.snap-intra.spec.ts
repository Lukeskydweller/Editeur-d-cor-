import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

/**
 * E2E test for intra-layer snap isolation.
 * Verifies that snap guides and "Bord à bord" tooltip only appear for pieces on the same layer.
 *
 * Tests that:
 * 1. C2 pieces do not snap to C1 pieces
 * 2. C2 pieces do not show "Bord à bord" tooltip near C1 pieces
 * 3. C2 pieces DO snap to other C2 pieces
 */
test('C2 ne snappe/tooltippe pas sur C1', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Step 1: Create two pieces on C1
  const c1Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C1 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false, error: 'No material' };

    // Create two C1 pieces spaced apart
    const p1 = store.addRectPiece(C1, mat, 100, 100, 50, 50, 0);
    const p2 = store.addRectPiece(C1, mat, 200, 100, 50, 50, 0);

    return { success: true, p1, p2 };
  });

  expect(c1Setup.success).toBe(true);

  // Step 2: Switch to C2 and create a piece
  const c2Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false, error: 'No material' };

    // Set active layer to C2
    store.setActiveLayer(C2);

    // Create a piece on C2
    const p3 = store.addRectPiece(C2, mat, 300, 100, 50, 50, 0);

    return { success: true, p3, C2 };
  });

  expect(c2Setup.success).toBe(true);

  // Step 3: Drag C2 piece near a C1 piece edge
  const dragResult = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Find the C2 piece
    const c2Id = Object.keys(store.scene.pieces).find(
      (id) => store.scene.pieces[id].layerId === store.scene.fixedLayerIds!.C2,
    );
    if (!c2Id) return { success: false, error: 'C2 piece not found' };

    // Select the C2 piece
    store.selectPiece(c2Id);

    // Start drag
    store.beginDrag(c2Id);

    // Move close to the right edge of the first C1 piece (at x=150)
    // C1 piece 1 is at (50,50) with size 50×50, so right edge is at x=100
    // Move C2 piece to x=105 (5mm away from C1 right edge)
    store.updateDrag(105, 100);

    return { success: true, c2Id };
  });

  expect(dragResult.success).toBe(true);

  // Wait a bit for snap/tooltip logic to process
  await page.waitForTimeout(100);

  // Step 4: Verify NO "Bord à bord" tooltip appears
  const tooltipText = await page.textContent('body');
  expect(tooltipText).not.toContain('Bord à bord');
  expect(tooltipText).not.toContain('bord à bord');

  // Step 5: Verify snap guides are not drawn for C1 pieces
  // (We primarily rely on the tooltip absence check above, as it's the most user-visible behavior)

  // Step 6: End drag and commit
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { useSceneStore } = window as any;
    useSceneStore.getState().endDrag(true);
  });

  // Step 7: Verify C2 piece did NOT snap to C1 edge position
  const finalPosition = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const c2Id = Object.keys(store.scene.pieces).find(
      (id) => store.scene.pieces[id].layerId === store.scene.fixedLayerIds!.C2,
    );
    if (!c2Id) return null;

    const piece = store.scene.pieces[c2Id];
    return { x: piece.position.x, y: piece.position.y };
  });

  // Position should be approximately at 105 (where we dragged it)
  // NOT at 100 (which would be snapped to C1 right edge)
  expect(finalPosition).not.toBeNull();
  expect(Math.abs(finalPosition!.x - 105)).toBeLessThan(2); // Allow small tolerance
});

/**
 * Test that C2 pieces DO snap to other C2 pieces (positive case).
 */
test('C2 pieces snap to other C2 pieces on same layer', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Setup: Create two C2 pieces
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // Add a C1 piece to unlock C2
    store.addRectPiece(C1, mat, 50, 50, 50, 50, 0);

    // Set active layer to C2
    store.setActiveLayer(C2);

    // Create two C2 pieces
    const p1 = store.addRectPiece(C2, mat, 100, 100, 50, 50, 0);
    const p2 = store.addRectPiece(C2, mat, 200, 100, 50, 50, 0);

    return { success: true, p1, p2 };
  });

  expect(setup.success).toBe(true);

  // Drag p2 close to p1's right edge
  const dragResult = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    // Find p2 (the piece at x=200)
    const p2Id = Object.keys(store.scene.pieces).find((id) => {
      const p = store.scene.pieces[id];
      return p.layerId === C2 && p.position.x === 200;
    });
    if (!p2Id) return { success: false };

    store.selectPiece(p2Id);
    store.beginDrag(p2Id);

    // Move close to p1's right edge (p1 is at 100, width 50, so right edge at 150)
    // Move to x=155 (5mm away, within snap threshold)
    store.updateDrag(155, 100);

    return { success: true };
  });

  expect(dragResult.success).toBe(true);

  await page.waitForTimeout(100);

  // End drag with commit
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { useSceneStore } = window as any;
    useSceneStore.getState().endDrag(true);
  });

  // Verify snap occurred (piece should be at x=150, snapped to p1's right edge)
  const finalPosition = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    const movedPiece = Object.keys(store.scene.pieces).find((id) => {
      const p = store.scene.pieces[id];
      // Find the piece we moved (it was originally at x=200, now should be ~150)
      return p.layerId === C2 && Math.abs(p.position.x - 150) < 10;
    });

    if (!movedPiece) return null;
    return store.scene.pieces[movedPiece].position;
  });

  expect(finalPosition).not.toBeNull();
  // Piece should have snapped to x=150 (right edge of p1)
  expect(Math.abs(finalPosition!.x - 150)).toBeLessThan(2);
});
