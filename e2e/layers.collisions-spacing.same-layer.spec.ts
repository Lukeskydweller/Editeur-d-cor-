import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

/**
 * E2E test for inter-layer overlap tolerance and intra-layer collision blocking.
 * Verifies that:
 * 1. C2 pieces CAN overlap C1 pieces (no red overlay, no blocking)
 * 2. C2 pieces CANNOT overlap other C2 pieces (blocked)
 */
test('C2 peut chevaucher C1, mais pas C2↔C2', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Step 1: Create piece on C1
  const c1Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C1 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false, error: 'No material' };

    // Create C1 piece at (100, 100, 50×50)
    const p1 = store.addRectPiece(C1, mat, 100, 100, 50, 50, 0);

    return { success: true, p1 };
  });

  expect(c1Setup.success).toBe(true);

  // Step 2: Create overlapping piece on C2 → should be allowed
  const c2Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false, error: 'No material' };

    // Set active layer to C2
    store.setActiveLayer(C2);

    // Create C2 piece overlapping with C1 piece (110, 110, 50×50)
    const p2 = store.addRectPiece(C2, mat, 110, 110, 50, 50, 0);

    return { success: true, p2, C2 };
  });

  expect(c2Setup.success).toBe(true);

  // Wait for UI to update
  await page.waitForTimeout(100);

  // Step 3: Verify NO overlap problems shown (inter-layer allowed)
  const hasOverlapWarning = await page.evaluate(() => {
    const { useSceneStore } = window as any;
    const state = useSceneStore.getState();
    // Check if problems panel shows overlap
    return state.ui.problems?.some((p: any) => p.code === 'overlap_same_layer') ?? false;
  });

  expect(hasOverlapWarning).toBe(false);

  // Step 4: Try to drag C2 piece over another C2 piece → should be blocked
  const dragTest = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // Create another C2 piece at (300, 300)
    const p3 = store.addRectPiece(C2, mat, 300, 300, 50, 50, 0);

    // Select p3 and try to drag it over p2 (at 110, 110)
    store.selectPiece(p3);
    store.beginDrag(p3);

    // Try to move to overlap with p2
    store.updateDrag(115, 115);

    // Check if collision detected
    const state = useSceneStore.getState();
    const hasCollision = state.ui.ghostCollides ?? false;

    return { success: true, hasCollision, p3 };
  });

  expect(dragTest.success).toBe(true);
  // Should detect collision when dragging C2 over C2
  expect(dragTest.hasCollision).toBe(true);

  // Cancel drag
  await page.evaluate(() => {
    const { useSceneStore } = window as any;
    useSceneStore.getState().endDrag(false);
  });
});

/**
 * E2E test for spacing validation: intra-layer only.
 * Verifies that spacing warnings only appear for pieces on the same layer.
 */
test('spacing warnings intra-layer only', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Step 1: Create two pieces on C1 with small gap (should WARN)
  const c1Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C1 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // Create two C1 pieces with 1.2mm gap (WARN threshold)
    const p1 = store.addRectPiece(C1, mat, 100, 100, 50, 50, 0);
    const p2 = store.addRectPiece(C1, mat, 151.2, 100, 50, 50, 0);

    return { success: true, p1, p2 };
  });

  expect(c1Setup.success).toBe(true);

  // Step 2: Validate and check for spacing warning
  const c1Problems = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const { toSceneV1 } = await import('./core/geo/facade');
    const { validateAll } = await import('./core/geo/validateAll');

    const store = useSceneStore.getState();
    const sceneV1 = toSceneV1(store.scene);
    const problems = await validateAll(sceneV1);

    const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');
    return spacingProblems;
  });

  expect(c1Problems.length).toBeGreaterThan(0);
  expect(c1Problems[0].severity).toBe('WARN');

  // Step 3: Create piece on C2 very close to C1 pieces (should NOT warn - different layer)
  const c2Setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const { C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // Set active layer to C2
    store.setActiveLayer(C2);

    // Create C2 piece 0.5mm from C1 piece (would BLOCK if same layer)
    const p3 = store.addRectPiece(C2, mat, 100.5, 100, 50, 50, 0);

    return { success: true, p3 };
  });

  expect(c2Setup.success).toBe(true);

  // Step 4: Validate - should NOT have additional spacing problems for C2↔C1
  const allProblems = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const { toSceneV1 } = await import('./core/geo/facade');
    const { validateAll } = await import('./core/geo/validateAll');

    const store = useSceneStore.getState();
    const sceneV1 = toSceneV1(store.scene);
    const problems = await validateAll(sceneV1);

    const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');
    return spacingProblems;
  });

  // Should still have only 1 spacing problem (C1↔C1), not C2↔C1
  expect(allProblems.length).toBe(1);
});
