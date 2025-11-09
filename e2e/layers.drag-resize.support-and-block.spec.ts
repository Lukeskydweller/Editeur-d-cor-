import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

/**
 * E2E test demonstrating:
 * 1. Cross-layer drag freedom (no BLOCK on different layers)
 * 2. Support-driven ghost signaling (data-ghost="1" when not fully supported)
 * 3. Exact PathOps validation after drop
 */

test('Drag C2 over C1 → no red halo, drag accepted, ghost when unsupported', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Setup: C1 with 2 rectangles, C2 with 1 rectangle
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // C1: Two rectangles
    const c1Left = store.addRectPiece(C1, mat, 100, 200, 60, 60, 0);
    const c1Right = store.addRectPiece(C1, mat, 200, 200, 60, 60, 0);

    // C2: One rectangle at different position
    store.setActiveLayer(C2);
    const c2Piece = store.addRectPiece(C2, mat, 150, 100, 50, 50, 0);

    return { success: true, c2Piece, C2, mat };
  });

  expect(setup.success).toBe(true);

  // Step 1: Drag C2 over C1 left rectangle
  const dragOverC1 = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Drag to fully overlap c1Left (100, 200)
      store.updateDrag(100, 200);

      // Check candidate validity (should be true - no cross-layer blocking)
      const dragging = store.ui.dragging;
      return {
        candidateValid: dragging?.candidate?.valid,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  // KEY ASSERTION: Drag should be allowed (no cross-layer blocking)
  expect(dragOverC1.candidateValid).toBe(true);

  // Step 2: Drop and verify no BLOCK
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      store.endDrag();
    },
    { c2Piece: setup.c2Piece },
  );

  // Wait for exact validation
  await page.waitForTimeout(300);

  // Step 3: Verify piece was moved (drag accepted)
  const afterDrop = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const piece = store.scene.pieces[c2Piece];
      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');

      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return {
        piecePosition: piece?.position,
        isSupported,
        dataGhost,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  // Piece should have moved (AABB around 100, 200)
  expect(afterDrop.piecePosition).toBeDefined();

  // C2 piece is fully on C1 left → should be supported
  expect(afterDrop.isSupported).toBe(true);
  expect(afterDrop.dataGhost).toBe('0');
});

test('Drag C2 partially off support → no BLOCK, ghost after drop', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Setup
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // C1: Single rectangle at (100, 100, 60×60)
    const c1Base = store.addRectPiece(C1, mat, 100, 100, 60, 60, 0);

    // C2: Rectangle fully supported initially
    store.setActiveLayer(C2);
    const c2Piece = store.addRectPiece(C2, mat, 110, 110, 40, 40, 0);

    return { success: true, c2Piece };
  });

  expect(setup.success).toBe(true);

  // Drag C2 to extend beyond C1 support (partially off)
  const dragPartiallyOff = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Move to position where C2 extends beyond C1 right edge
      // C1 is 100-160, move C2 to 135-175 (extends beyond 160)
      store.updateDrag(135, 110);

      return {
        candidateValid: store.ui.dragging?.candidate?.valid,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  // Should NOT be blocked (support is not a blocking reason)
  expect(dragPartiallyOff.candidateValid).toBe(true);

  // Drop
  await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    useSceneStore.getState().endDrag();
  });

  // Wait for exact validation
  await page.waitForTimeout(300);

  // Verify: piece is ghost (not fully supported)
  const ghostState = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');

      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return { isSupported, dataGhost };
    },
    { c2Piece: setup.c2Piece },
  );

  // Piece should be ghost (extends beyond support)
  expect(ghostState.isSupported).toBe(false);
  expect(ghostState.dataGhost).toBe('1');
});

test('Resize C2 partially off support → no BLOCK, ghost visible', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Setup
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // C1: Base rectangle
    const c1Base = store.addRectPiece(C1, mat, 100, 100, 80, 80, 0);

    // C2: Small rectangle fully supported
    store.setActiveLayer(C2);
    const c2Piece = store.addRectPiece(C2, mat, 120, 120, 40, 40, 0);

    return { success: true, c2Piece };
  });

  expect(setup.success).toBe(true);

  // Resize C2 to extend beyond C1 support
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c2Piece);

      // Start resize from east handle
      store.startResize(c2Piece, 'e', { x: 160, y: 140 });

      // Resize to extend beyond C1 (C1 ends at 180, extend to 200)
      store.updateResize(200, 140);
    },
    { c2Piece: setup.c2Piece },
  );

  // Get resize state during interaction
  const resizeState = await page.evaluate(() => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // During resize, ghost state should NOT block
    return {
      isResizing: !!store.ui.resizing,
    };
  });

  expect(resizeState.isResizing).toBe(true);

  // End resize
  await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    useSceneStore.getState().endResize();
  });

  // Wait for exact validation
  await page.waitForTimeout(300);

  // Verify: piece is ghost after resize
  const ghostAfterResize = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');

      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return { isSupported, dataGhost };
    },
    { c2Piece: setup.c2Piece },
  );

  // Should be ghost (extends beyond support)
  expect(ghostAfterResize.isSupported).toBe(false);
  expect(ghostAfterResize.dataGhost).toBe('1');
});

test('Move ghost C2 back to full support → becomes real (data-ghost="0")', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Setup: Create ghost piece (partially unsupported)
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // C1: Base
    const c1Base = store.addRectPiece(C1, mat, 100, 100, 60, 60, 0);

    // C2: Place partially off support (ghost)
    store.setActiveLayer(C2);
    const c2Piece = store.addRectPiece(C2, mat, 145, 110, 30, 30, 0); // Extends beyond 160

    return { success: true, c2Piece };
  });

  expect(setup.success).toBe(true);

  // Wait for initial ghost state
  await page.waitForTimeout(200);

  // Verify initial ghost state
  const initialGhost = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return { isSupported, dataGhost };
    },
    { c2Piece: setup.c2Piece },
  );

  // Should be ghost initially
  expect(initialGhost.isSupported).toBe(false);
  expect(initialGhost.dataGhost).toBe('1');

  // Move C2 to fully supported position
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Move to fully within C1 (110-140 within 100-160)
      store.updateDrag(110, 110);
      store.endDrag();
    },
    { c2Piece: setup.c2Piece },
  );

  // Wait for exact validation
  await page.waitForTimeout(300);

  // Verify: piece is now real (fully supported)
  const finalState = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return { isSupported, dataGhost };
    },
    { c2Piece: setup.c2Piece },
  );

  // Should be real now (fully supported)
  expect(finalState.isSupported).toBe(true);
  expect(finalState.dataGhost).toBe('0');
});
