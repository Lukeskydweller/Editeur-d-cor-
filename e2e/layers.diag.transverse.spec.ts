import { test, expect } from '@playwright/test';

/**
 * E2E Diagnostic: Transverse Blocking Prevention
 *
 * Scenario: C2-A partially supported (ghost), C2-B fully supported
 * Expected: C2-B can move freely, no transverse blocking from C2-A
 *
 * Validates:
 * - Support issues don't cause hasBlock
 * - Ghost pieces don't block other pieces on same layer
 * - data-ghost='1' visible with dashed outline (no red halo)
 */
test('C2-B libre malgré C2-A ghost (no transverse blocking)', async ({ page }) => {
  await page.goto('/');

  // Enable DEV logging
  await page.evaluate(() => {
    (window as any).__DBG_DRAG__ = true;
    (window as any).__dragLogs = [];
  });

  // Step 1: Setup scene with C1 base, C2-A partial, C2-B full
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

    // C1: Base piece at (50, 50) size 80×80 (extends to 130, 130)
    store.setActiveLayer(C1);
    const c1Base = store.addRectPiece(C1, mat, 80, 80, 50, 50, 0);

    // C2-A: Partially on C1 at (100, 50) size 60×60 (extends to 160, 110)
    // Only 30mm of C2-A is on C1 (50-130), 30mm extends beyond → should be ghost
    store.setActiveLayer(C2);
    const c2A = store.addRectPiece(C2, mat, 60, 60, 100, 50, 0);

    // C2-B: Fully on C1 at (60, 60) size 40×40 (extends to 100, 100)
    // Completely within C1 bounds → should NOT be ghost
    const c2B = store.addRectPiece(C2, mat, 40, 40, 60, 60, 0);

    return { success: true, c1Base, c2A, c2B, C2, mat };
  });

  expect(setup.success).toBe(true);

  // Wait for initial exact validation
  await page.waitForTimeout(400);

  // Step 2: Verify C2-A is ghost (partial support)
  const c2AState = await page.evaluate(
    async ({ c2A }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2A}"]`);
      const dataGhost = pieceEl?.getAttribute('data-ghost');
      const outlineStyle = window.getComputedStyle(pieceEl as Element).outlineStyle;
      const outlineColor = window.getComputedStyle(pieceEl as Element).outlineColor;

      return {
        dataGhost,
        outlineStyle,
        outlineColor,
        exists: !!pieceEl,
      };
    },
    { c2A: setup.c2A },
  );

  expect(c2AState.exists).toBe(true);
  expect(c2AState.dataGhost).toBe('1'); // Ghost due to partial support
  expect(c2AState.outlineStyle).toBe('dashed'); // Dashed outline, not solid

  // Step 3: Verify C2-B is NOT ghost (full support)
  const c2BInitialState = await page.evaluate(
    async ({ c2B }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2B}"]`);
      return {
        dataGhost: pieceEl?.getAttribute('data-ghost'),
        exists: !!pieceEl,
      };
    },
    { c2B: setup.c2B },
  );

  expect(c2BInitialState.exists).toBe(true);
  expect(c2BInitialState.dataGhost).toBe('0'); // NOT ghost (fully supported)

  // Step 4: Drag C2-B → should move freely (no transverse blocking from C2-A)
  await page.evaluate(
    async ({ c2B }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      // Select C2-B and start drag
      store.selectPiece(c2B);
      store.beginDrag(c2B);

      // Move right by 50mm (well away from C2-A)
      store.updateDrag(50, 0);
    },
    { c2B: setup.c2B },
  );

  // Step 5: Check drag logs - verify setHasBlockFrom === 'none'
  const dragLogs = await page.evaluate(() => (window as any).__dragLogs || []);
  console.log('[E2E] Drag logs:', dragLogs);

  // Get logs for C2-B drag
  const c2BDragLog = dragLogs.find((log: any) => log.pieceId === setup.c2B);
  if (c2BDragLog) {
    expect(c2BDragLog.setHasBlockFrom).toBe('none');
  }

  // Step 6: Verify drag candidate is valid
  const dragState = await page.evaluate(
    async ({ c2B }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      return {
        candidateValid: store.ui.dragging?.candidate?.valid,
        ghostPieceId: store.ui.ghost?.pieceId,
      };
    },
    { c2B: setup.c2B },
  );

  expect(dragState.candidateValid).toBe(true); // Drag allowed
  expect(dragState.ghostPieceId).toBeUndefined(); // No ghost during drag

  // Step 7: Commit drag
  await page.evaluate(
    async ({ c2B }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      store.endDrag();
    },
    { c2B: setup.c2B },
  );

  // Wait for commit to complete
  await page.waitForTimeout(200);

  // Step 8: Verify C2-B moved successfully
  const c2BFinalState = await page.evaluate(
    async ({ c2B }) => {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();
      const piece = store.scene.pieces[c2B];

      return {
        positionX: piece?.position.x,
        originalX: 60,
      };
    },
    { c2B: setup.c2B },
  );

  // C2-B should have moved from x=60 to approximately x=110 (60 + 50)
  expect(c2BFinalState.positionX).toBeGreaterThan(c2BFinalState.originalX);

  // Step 9: Verify C2-A still ghost (unchanged by C2-B operation)
  const c2AFinalState = await page.evaluate(
    async ({ c2A }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2A}"]`);
      return {
        dataGhost: pieceEl?.getAttribute('data-ghost'),
        outlineStyle: window.getComputedStyle(pieceEl as Element).outlineStyle,
      };
    },
    { c2A: setup.c2A },
  );

  expect(c2AFinalState.dataGhost).toBe('1'); // Still ghost
  expect(c2AFinalState.outlineStyle).toBe('dashed'); // Still dashed, not solid
});

test('Ghost outline precedence: dashed not masked by solid', async ({ page }) => {
  await page.goto('/');

  // Setup: Create C1, then C2 partially off C1 (ghost)
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

    // C1 base
    store.setActiveLayer(C1);
    const c1Base = store.addRectPiece(C1, mat, 60, 60, 50, 50, 0);

    // C2 partial (ghost)
    store.setActiveLayer(C2);
    const c2Ghost = store.addRectPiece(C2, mat, 60, 60, 90, 50, 0);

    return { success: true, c2Ghost };
  });

  expect(setup.success).toBe(true);

  // Wait for validation
  await page.waitForTimeout(400);

  // Verify ghost styling
  const ghostStyle = await page.evaluate(
    async ({ c2Ghost }) => {
      const pieceEl = document.querySelector(`[data-piece-id="${c2Ghost}"]`);
      const styles = window.getComputedStyle(pieceEl as Element);

      return {
        dataGhost: pieceEl?.getAttribute('data-ghost'),
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        opacity: styles.opacity,
      };
    },
    { c2Ghost: setup.c2Ghost },
  );

  // Assertions
  expect(ghostStyle.dataGhost).toBe('1');
  expect(ghostStyle.outlineStyle).toBe('dashed');
  expect(parseFloat(ghostStyle.opacity)).toBeLessThan(1.0); // Reduced opacity
});
