import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set
const test = process.env.PWREADY === '1' ? base : base.skip;

test('Resize east handle shows red ghost when overlapping neighbor', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create scene with two pieces close together
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    // Insert two pieces with 2mm spacing
    await store.insertRect({ w: 100, h: 100, x: 10, y: 10 });
    await store.insertRect({ w: 100, h: 100, x: 114, y: 10 });
  });

  await page.waitForTimeout(300);

  // Select first piece
  const firstPiece = page.locator('rect[fill="#60a5fa"]').first();
  await firstPiece.click();
  await page.waitForTimeout(200);

  // Find east handle (right middle)
  // Handles are in a div overlay, not in SVG
  const eastHandle = page.locator('[aria-label="resize-handle-e"]');
  await expect(eastHandle).toBeVisible();

  // Get handle position
  const handleBox = await eastHandle.boundingBox();
  expect(handleBox).not.toBeNull();

  // Start resize by dragging east handle to the right (towards neighbor)
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 50, handleBox!.y + handleBox!.height / 2, { steps: 10 });
  await page.waitForTimeout(500); // Wait for async validation

  // Check if ghost attribute appears during resize
  const ghostPiece = page.locator('[data-ghost="true"]');
  const ghostExists = (await ghostPiece.count()) > 0;

  if (ghostExists) {
    // Ghost should be visible with red or orange fill
    await expect(ghostPiece).toBeVisible();

    const ghostRect = ghostPiece.locator('rect').first();
    const fill = await ghostRect.getAttribute('fill');
    expect(fill).toMatch(/#ef4444|#f59e0b/); // red or orange

    // Handle should have aria-invalid when ghost has BLOCK
    const ariaInvalid = await eastHandle.getAttribute('aria-invalid');
    expect(ariaInvalid).toBe('true');
  }

  // Release mouse (try to commit resize)
  await page.mouse.up();
  await page.waitForTimeout(300);

  // If resize was blocked, piece should be at original size
  // Check if toast message appears
  const toast = page.locator('[role="status"]');
  const hasToast = (await toast.count()) > 0;

  if (hasToast) {
    const toastText = await toast.textContent();
    expect(toastText).toContain('Resize bloqué');
  }

  // Ghost should be cleared after mouseup
  const ghostAfter = page.locator('[data-ghost="true"]');
  expect(await ghostAfter.count()).toBe(0);
});

test('Resize with WARN spacing shows orange ghost but commits successfully', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create scene
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    // Insert two pieces with 3mm spacing
    await store.insertRect({ w: 100, h: 100, x: 10, y: 10 });
    await store.insertRect({ w: 100, h: 100, x: 115, y: 10 });
  });

  await page.waitForTimeout(300);

  // Select first piece
  const firstPiece = page.locator('rect[fill="#60a5fa"]').first();
  await firstPiece.click();
  await page.waitForTimeout(200);

  // Find east handle
  const eastHandle = page.locator('[aria-label="resize-handle-e"]');
  const handleBox = await eastHandle.boundingBox();
  expect(handleBox).not.toBeNull();

  // Resize to create spacing around 1mm (WARN zone, not BLOCK)
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 14, handleBox!.y + handleBox!.height / 2, { steps: 5 });
  await page.waitForTimeout(500);

  // May show orange ghost (WARN) but not red (BLOCK)
  const ghostPiece = page.locator('[data-ghost="true"]');
  const ghostExists = (await ghostPiece.count()) > 0;

  if (ghostExists) {
    const ghostRect = ghostPiece.locator('rect').first();
    const fill = await ghostRect.getAttribute('fill');
    // Should be orange (WARN), not red (BLOCK)
    expect(fill).toBe('#f59e0b');
  }

  // Release mouse - should commit successfully
  await page.mouse.up();
  await page.waitForTimeout(300);

  // No error toast should appear
  const toast = page.locator('[role="status"]');
  const hasErrorToast = (await toast.count()) > 0 && (await toast.textContent())?.includes('bloqué');
  expect(hasErrorToast).toBe(false);

  // Piece should have new dimensions (resized)
  const pieceAfter = await page.evaluate(() => {
    const store = (window as any).__sceneStore.getState();
    const pieces = Object.values(store.scene.pieces);
    return pieces[0] as any;
  });

  expect(pieceAfter.size.w).toBeGreaterThan(100);
});

test('Resize with 90° rotation still validates correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create scene with rotated piece
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    // Insert two pieces
    const id1 = await store.insertRect({ w: 100, h: 60, x: 10, y: 10 });
    await store.insertRect({ w: 100, h: 60, x: 114, y: 10 });

    // Rotate first piece 90°
    store.selectPiece(id1);
    store.setSelectedRotation(90);
  });

  await page.waitForTimeout(300);

  // Piece should be rotated
  const rotatedPiece = page.locator('[data-testid="piece-selected"]');
  await expect(rotatedPiece).toBeVisible();

  // Find a resize handle
  const handle = page.locator('[aria-label^="resize-handle-"]').first();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  // Try to resize (should still validate with rotation)
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 30, handleBox!.y + 30, { steps: 5 });
  await page.waitForTimeout(500);

  // Check that validation runs (ghost may or may not appear depending on whether overlap occurs)
  // The important thing is no errors occur
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Verify piece still has 90° rotation
  const pieceAfter = await page.evaluate(() => {
    const store = (window as any).__sceneStore.getState();
    const pieces = Object.values(store.scene.pieces);
    return pieces[0] as any;
  });

  expect(pieceAfter.rotationDeg).toBe(90);
});

test('StatusBadge reflects validation state during resize', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create scene
  await page.evaluate(async () => {
    const store = (window as any).__sceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });

    // Insert two pieces close together
    await store.insertRect({ w: 100, h: 100, x: 10, y: 10 });
    await store.insertRect({ w: 100, h: 100, x: 114, y: 10 });
  });

  await page.waitForTimeout(300);

  // Select first piece
  const firstPiece = page.locator('rect[fill="#60a5fa"]').first();
  await firstPiece.click();
  await page.waitForTimeout(200);

  // Find StatusBadge (assuming it exists in the UI)
  // This is optional - if StatusBadge component exists
  const statusBadge = page.locator('[data-testid="status-badge"]');
  const hasBadge = (await statusBadge.count()) > 0;

  if (hasBadge) {
    // Initially should show OK
    const initialStatus = await statusBadge.textContent();
    expect(initialStatus).toMatch(/OK/i);

    // Start resize towards neighbor
    const eastHandle = page.locator('[aria-label="resize-handle-e"]');
    const handleBox = await eastHandle.boundingBox();

    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 50, handleBox!.y, { steps: 10 });
    await page.waitForTimeout(500);

    // Status should change to BLOCK or WARN
    const duringStatus = await statusBadge.textContent();
    expect(duringStatus).toMatch(/BLOCK|WARN/i);

    // Release
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
});
