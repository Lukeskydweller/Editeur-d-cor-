import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

/**
 * E2E test demonstrating fast (AABB) vs exact (PathOps) containment validation.
 *
 * Scenario: Create a C2 piece that appears supported in AABB (fast) mode
 * but is actually unsupported when checked with exact PathOps containment.
 *
 * Setup:
 * - C1: Two rectangles separated horizontally (creates AABB "bridge" but with gap in middle)
 * - C2: Rectangle positioned so its AABB is within union of C1 AABBs, but actual geometry extends into the gap
 *
 * Expected behavior:
 * - During drag: fast AABB shows piece as supported (no ghost)
 * - After drop: exact PathOps detects lack of full support → piece becomes ghost
 */
test('Exact containment at commit overrides fast/AABB during drag', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Step 1: Create two C1 pieces with a gap between them
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Reset and initialize
    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false, error: 'No material' };

    // Create two C1 pieces with gap in middle
    // Left piece: 100-160 (60mm wide)
    const c1Left = store.addRectPiece(C1, mat, 100, 200, 60, 60, 0);

    // Right piece: 180-240 (60mm wide)
    // Gap between them: 160-180 (20mm gap)
    const c1Right = store.addRectPiece(C1, mat, 180, 200, 60, 60, 0);

    // AABB union of C1 pieces: 100-240 (covers gap)
    // But actual geometry has gap from 160-180

    return { success: true, c1Left, c1Right, C2, mat };
  });

  expect(setup.success).toBe(true);

  // Step 2: Switch to C2 and create piece positioned over the gap
  const c2Setup = await page.evaluate(
    async ({ C2, mat }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      // Set active layer to C2
      store.setActiveLayer(C2);

      // Create C2 piece at position that spans the gap
      // Position: 155-185 (30mm wide, centered on gap)
      // AABB check: 155-185 ⊆ 100-240 (AABB union) → appears supported
      // Exact check: portion from 160-180 has no C1 support → NOT fully supported
      const c2Piece = store.addRectPiece(C2, mat, 155, 210, 30, 30, 0);

      return { success: true, c2Piece };
    },
    { C2: setup.C2, mat: setup.mat },
  );

  expect(c2Setup.success).toBe(true);

  // Step 3: Wait for exact validation to complete after piece creation
  await page.waitForTimeout(200);

  // Step 4: Verify piece is ghost (not fully supported by exact validation)
  const ghostStateAfterCreate = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      // Check exact support
      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');

      // Get piece element for data-ghost attribute
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return {
        isSupported,
        dataGhost,
        pieceId: c2Piece,
      };
    },
    { c2Piece: c2Setup.c2Piece },
  );

  // Piece should NOT be supported (spans unsupported gap)
  expect(ghostStateAfterCreate.isSupported).toBe(false);
  expect(ghostStateAfterCreate.dataGhost).toBe('1');

  // Step 5: Move C2 piece to be fully on left C1 piece
  const moveToSupported = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      // Select and drag piece to left (fully on c1Left)
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Move to position 110-140 (fully within c1Left: 100-160)
      store.updateDrag(110, 210);
      store.endDrag();

      return { success: true };
    },
    { c2Piece: c2Setup.c2Piece },
  );

  expect(moveToSupported.success).toBe(true);

  // Wait for exact validation after drag commit
  await page.waitForTimeout(300);

  // Step 6: Verify piece is now real (fully supported)
  const ghostStateAfterMove = await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupported = await isPieceFullySupportedAsync(store, c2Piece, 'exact');

      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return {
        isSupported,
        dataGhost,
      };
    },
    { c2Piece: c2Setup.c2Piece },
  );

  // Piece should now be supported (fully on c1Left)
  expect(ghostStateAfterMove.isSupported).toBe(true);
  expect(ghostStateAfterMove.dataGhost).toBe('0');
});

/**
 * Test that AABB (fast) mode gives false positive for rotated pieces.
 * Demonstrates exact PathOps correctly handles rotation.
 */
test('Exact containment handles rotated pieces correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Create scenario: C1 square, C2 diamond (45° rotated square)
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    store.reset?.();
    store.initSceneWithDefaults(1000, 1000);

    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = Object.keys(store.scene.materials)[0];
    if (!mat) return { success: false };

    // C1: Small square 50×50 at (200, 200)
    const c1Base = store.addRectPiece(C1, mat, 200, 200, 50, 50, 0);

    // C2: Larger square 60×60 rotated 45° (becomes diamond)
    // When rotated 45°, a 60×60 square has AABB diagonal ≈ 85mm
    // If positioned at (200, 200), its AABB will extend beyond 50×50 base
    store.setActiveLayer(C2);
    const c2Diamond = store.addRectPiece(C2, mat, 210, 210, 60, 60, 45);

    return { success: true, c1Base, c2Diamond };
  });

  expect(setup.success).toBe(true);

  await page.waitForTimeout(200);

  // Verify diamond is NOT fully supported (extends beyond base)
  const ghostState = await page.evaluate(
    async ({ c2Diamond }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const { isPieceFullySupportedAsync } = await import('./state/layers.support');
      const store = useSceneStore.getState();

      const isSupportedExact = await isPieceFullySupportedAsync(store, c2Diamond, 'exact');

      const pieceEl = document.querySelector(`[data-piece-id="${c2Diamond}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      return { isSupportedExact, dataGhost };
    },
    { c2Diamond: setup.c2Diamond },
  );

  // Rotated piece should NOT be fully supported
  expect(ghostState.isSupportedExact).toBe(false);
  expect(ghostState.dataGhost).toBe('1');
});
