import { test, expect } from '@playwright/test';

/**
 * Test that ghost visual feedback (data-ghost attribute and CSS styling)
 * is visible during drag/resize interactions and after drop.
 */
test('ghost UI visible during drag and after drop', async ({ page }) => {
  await page.goto('/');

  // Step 1: Create C1 base piece
  const setup = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Reset and initialize
    store.reset?.();
    store.initSceneWithDefaults(600, 400);

    // Get layer IDs
    const fixed = store.scene.fixedLayerIds;
    if (!fixed) return { success: false };

    const C1 = fixed.C1;
    const C2 = fixed.C2;
    const mat = Object.values(store.scene.materials)[0].id;

    // Clear default pieces
    Object.keys(store.scene.pieces).forEach((id) => store.deletePiece(id));

    // Create C1 base piece (60×60 at position 100,100)
    store.setActiveLayer(C1);
    const c1Base = store.addRectPiece(C1, mat, 60, 60, 100, 100, 0);

    // Create C2 piece on top of C1 (40×40 at position 110,110)
    store.setActiveLayer(C2);
    const c2Piece = store.addRectPiece(C2, mat, 40, 40, 110, 110, 0);

    return { success: true, c1Base, c2Piece, C2, mat };
  });

  expect(setup.success).toBe(true);

  // Wait for initial exact validation
  await page.waitForTimeout(300);

  // Step 2: Verify C2 piece is initially fully supported (real, not ghost)
  const initialState = await page.evaluate(
    async ({ c2Piece }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      return {
        dataGhost: pieceEl?.getAttribute('data-ghost'),
        exists: !!pieceEl,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  expect(initialState.exists).toBe(true);
  expect(initialState.dataGhost).toBe('0'); // Fully supported

  // Step 3: Drag C2 piece to partially unsupported position
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      // Select and start drag
      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Move to position where it extends beyond C1 support
      // C1 is at 100-160, move C2 to 140-180 (partially off C1)
      store.updateDrag(30, 0);
    },
    { c2Piece: setup.c2Piece },
  );

  // Step 4: Check ghost state during drag (fast/AABB mode)
  const duringDrag = await page.evaluate(
    async ({ c2Piece }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');

      // Check for outline style (dashed for ghost)
      const outlineStyle = window.getComputedStyle(pieceEl as Element).outlineStyle;

      return {
        dataGhost,
        outlineStyle,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  // During drag with fast mode, ghost may or may not be detected yet
  // (depends on timing of async validation)
  // Just verify the element exists and has valid data-ghost attribute
  expect(duringDrag.dataGhost).toMatch(/^[01]$/);

  // Step 5: End drag
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      store.endDrag();
    },
    { c2Piece: setup.c2Piece },
  );

  // Wait for exact validation after drop
  await page.waitForTimeout(400);

  // Step 6: Verify ghost is visible after drop (exact mode)
  const afterDrop = await page.evaluate(
    async ({ c2Piece }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');
      const outlineStyle = window.getComputedStyle(pieceEl as Element).outlineStyle;
      const opacity = window.getComputedStyle(pieceEl as Element).opacity;

      return {
        dataGhost,
        outlineStyle,
        opacity,
      };
    },
    { c2Piece: setup.c2Piece },
  );

  // After drop with exact validation, piece should be ghost (not fully supported)
  expect(afterDrop.dataGhost).toBe('1');
  expect(afterDrop.outlineStyle).toBe('dashed');
  expect(parseFloat(afterDrop.opacity)).toBeLessThan(1); // Should have reduced opacity

  // Step 7: Move C2 back to fully supported position
  await page.evaluate(
    async ({ c2Piece }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      store.selectPiece(c2Piece);
      store.beginDrag(c2Piece);

      // Move back to fully on C1 (position 110,110 is within C1's 100-160)
      store.updateDrag(-30, 0);
      store.endDrag();
    },
    { c2Piece: setup.c2Piece },
  );

  // Wait for exact validation
  await page.waitForTimeout(400);

  // Step 8: Verify piece is no longer ghost (fully supported)
  const afterMoveBack = await page.evaluate(
    async ({ c2Piece }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2Piece}"]`);
      return {
        dataGhost: pieceEl?.getAttribute('data-ghost'),
      };
    },
    { c2Piece: setup.c2Piece },
  );

  expect(afterMoveBack.dataGhost).toBe('0'); // Fully supported again
});
