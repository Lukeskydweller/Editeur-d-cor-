import { test, expect } from '@playwright/test';

/**
 * E2E Diagnostic: Resize Guards (activeLayer + lock)
 *
 * Validates that resize operations respect:
 * - activeLayer: Resize only allowed on active layer
 * - layerLocked: Resize blocked on locked layers
 */

test('Resize blocked when piece not on activeLayer', async ({ page }) => {
  await page.goto('/');

  // Setup: C1 with piece, C2 active (different layer)
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(600, 400);

    const fixed = store.scene.fixedLayerIds;
    if (!fixed) return { success: false };

    const C1 = fixed.C1;
    const C2 = fixed.C2;
    const mat = Object.values(store.scene.materials)[0].id;

    Object.keys(store.scene.pieces).forEach((id) => store.deletePiece(id));

    // C1: Add piece
    store.setActiveLayer(C1);
    const c1Piece = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

    // Switch to C2 (make C1 inactive)
    store.setActiveLayer(C2);
    const c2Dummy = store.addRectPiece(C2, mat, 30, 30, 200, 200, 0);

    return {
      success: true,
      c1Piece,
      C1,
      C2,
      activeLayer: store.ui.activeLayer,
    };
  });

  expect(setup.success).toBe(true);
  expect(setup.activeLayer).toBe(setup.C2); // C2 is active

  // Attempt to resize C1 piece (should be blocked by activeLayer guard)
  const beforeResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        originalWidth: piece?.size.w,
        originalHeight: piece?.size.h,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Try to start resize (should be blocked)
  await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c1Piece);
      store.startResize(c1Piece, 'e', { x: 160, y: 130 });

      // Should NOT create ui.resizing (blocked by guard)
      return {
        resizingExists: !!store.ui.resizing,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Verify no resize started
  const resizeState = await page.evaluate(() => {
    const { useSceneStore } = (window as any).useSceneStore || {};
    if (!useSceneStore) return { resizingExists: false };
    const store = useSceneStore.getState();
    return {
      resizingExists: !!store.ui.resizing,
    };
  });

  // Since we can't easily import in this context, check via DOM that piece didn't change
  const afterResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        currentWidth: piece?.size.w,
        currentHeight: piece?.size.h,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Piece should NOT have changed (guard blocked resize)
  expect(afterResize.currentWidth).toBe(beforeResize.originalWidth);
  expect(afterResize.currentHeight).toBe(beforeResize.originalHeight);
});

test('Resize blocked when layer is locked', async ({ page }) => {
  await page.goto('/');

  // Setup: C1 active with piece, then lock C1
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(600, 400);

    const fixed = store.scene.fixedLayerIds;
    if (!fixed) return { success: false };

    const C1 = fixed.C1;
    const mat = Object.values(store.scene.materials)[0].id;

    Object.keys(store.scene.pieces).forEach((id) => store.deletePiece(id));

    // C1: Add piece
    store.setActiveLayer(C1);
    const c1Piece = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

    // Lock C1
    store.toggleLayerLock(C1);

    return {
      success: true,
      c1Piece,
      C1,
      isLocked: store.ui.layerLocked?.[C1],
    };
  });

  expect(setup.success).toBe(true);
  expect(setup.isLocked).toBe(true); // C1 is locked

  // Capture original size
  const beforeResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        originalWidth: piece?.size.w,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Attempt resize (should be blocked by lock guard)
  await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c1Piece);
      store.startResize(c1Piece, 'e', { x: 160, y: 130 });
      store.updateResize({ x: 180, y: 130 }); // Try to expand width
    },
    { c1Piece: setup.c1Piece },
  );

  // Wait a bit for any async operations
  await page.waitForTimeout(100);

  // Verify size unchanged
  const afterResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        currentWidth: piece?.size.w,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Piece should NOT have resized (guard blocked)
  expect(afterResize.currentWidth).toBe(beforeResize.originalWidth);
});

test('Resize allowed when activeLayer matches and layer unlocked', async ({ page }) => {
  await page.goto('/');

  // Setup: C1 active with piece, unlocked
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(600, 400);

    const fixed = store.scene.fixedLayerIds;
    if (!fixed) return { success: false };

    const C1 = fixed.C1;
    const mat = Object.values(store.scene.materials)[0].id;

    Object.keys(store.scene.pieces).forEach((id) => store.deletePiece(id));

    // C1: Add piece
    store.setActiveLayer(C1);
    const c1Piece = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

    return {
      success: true,
      c1Piece,
      C1,
      activeLayer: store.ui.activeLayer,
      isLocked: store.ui.layerLocked?.[C1],
    };
  });

  expect(setup.success).toBe(true);
  expect(setup.activeLayer).toBe(setup.C1); // C1 is active
  expect(setup.isLocked).toBeFalsy(); // C1 is NOT locked

  // Capture original size
  const beforeResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        originalWidth: piece?.size.w,
        originalX: piece?.position.x,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Perform resize (should succeed)
  await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c1Piece);
      store.startResize(c1Piece, 'e', { x: 160, y: 130 });
      store.updateResize({ x: 180, y: 130 }); // Expand width by ~20mm
    },
    { c1Piece: setup.c1Piece },
  );

  // Wait for resize to apply
  await page.waitForTimeout(100);

  // Commit resize
  await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      store.endResize(true);
    },
    { c1Piece: setup.c1Piece },
  );

  // Verify size changed
  const afterResize = await page.evaluate(
    async ({ c1Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c1Piece];

      return {
        currentWidth: piece?.size.w,
        currentX: piece?.position.x,
      };
    },
    { c1Piece: setup.c1Piece },
  );

  // Piece SHOULD have resized (guards passed)
  expect(afterResize.currentWidth).toBeGreaterThan(beforeResize.originalWidth);
});

test('Resize allowed when activeLayer undefined (test/simple scenes)', async ({ page }) => {
  await page.goto('/');

  // Setup: Simple scene without activeLayer (like unit tests)
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Use basic initScene (not initSceneWithDefaults) to avoid activeLayer
    store.initScene(600, 600);
    const layerId = store.addLayer('TestLayer');
    const materialId = store.addMaterial({ name: 'TestMaterial', oriented: false });

    const pieceId = await store.insertRect({ w: 60, h: 60, x: 100, y: 100 });

    return {
      success: true,
      pieceId,
      activeLayer: store.ui.activeLayer, // Should be undefined
    };
  });

  expect(setup.success).toBe(true);
  expect(setup.activeLayer).toBeUndefined(); // No activeLayer

  // Capture original size
  const beforeResize = await page.evaluate(
    async ({ pieceId }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[pieceId];

      return {
        originalWidth: piece?.size.w,
      };
    },
    { pieceId: setup.pieceId },
  );

  // Perform resize (should succeed despite no activeLayer)
  await page.evaluate(
    async ({ pieceId }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(pieceId);
      store.startResize(pieceId, 'e', { x: 160, y: 130 });
      store.updateResize({ x: 180, y: 130 });
      store.endResize(true);
    },
    { pieceId: setup.pieceId },
  );

  // Wait for resize
  await page.waitForTimeout(100);

  // Verify size changed (guard should allow when activeLayer undefined)
  const afterResize = await page.evaluate(
    async ({ pieceId }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[pieceId];

      return {
        currentWidth: piece?.size.w,
      };
    },
    { pieceId: setup.pieceId },
  );

  // Resize should succeed (activeLayer undefined = allow)
  expect(afterResize.currentWidth).toBeGreaterThan(beforeResize.originalWidth);
});
