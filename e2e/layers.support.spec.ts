import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

test('layers support — BLOCK when unsupported, OK when fully covered', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create test scenario: 2 layers, support piece in L1, unsupported piece in L2
  const created = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Get first layer and material
    const firstLayerId = store.scene.layerOrder[0];
    if (!firstLayerId) return false;

    const firstMaterialId = Object.keys(store.scene.materials)[0];
    if (!firstMaterialId) return false;

    // Add a second layer
    const newLayerId = 'test-layer-2';
    const newLayer = {
      id: newLayerId,
      name: 'Layer 2',
      z: 1, // Above first layer
      visible: true,
      locked: false,
    };

    // Create pieces: support in L1, unsupported in L2
    useSceneStore.setState((state) => ({
      scene: {
        ...state.scene,
        layers: {
          ...state.scene.layers,
          [newLayerId]: newLayer,
        },
        layerOrder: [...state.scene.layerOrder, newLayerId],
        pieces: {
          // Layer 1: Support piece at (100, 100) with size 200×100
          'test-support': {
            id: 'test-support',
            kind: 'rect' as const,
            position: { x: 100, y: 100 },
            size: { w: 200, h: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
          // Layer 2: Piece at (200, 100) with size 80×80
          // Only 30% overlap with support (50mm out of 80mm width extends beyond)
          'test-unsupported': {
            id: 'test-unsupported',
            kind: 'rect' as const,
            position: { x: 250, y: 100 }, // Extends beyond support at x=300
            size: { w: 80, h: 80 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: newLayerId,
            materialId: firstMaterialId,
          },
        },
      },
    }));

    return true;
  });

  expect(created).toBe(true);

  // Force validation end-to-end (bypasses debounce)
  const forced = await page.evaluate(async () => {
    const fn = (window as any).__testForceFullValidation;
    if (!fn) return { ok: false, error: 'hook not found' };
    return await fn();
  });
  expect(forced.ok).toBe(true);

  // Wait for unsupported_above problem to appear
  const seenUnsupported = await page.evaluate(async () => {
    const fn = (window as any).__testWaitForProblems;
    if (!fn) return false;
    return await fn({ codes: ['unsupported_above'], timeoutMs: 2000 });
  });
  expect(seenUnsupported).toBe(true);

  // Verify Problems Panel shows unsupported warning
  const panel = page.getByTestId('problems-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Pièce non supportée par couche inférieure');

  // Move piece to be fully supported
  const moved = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Move test-unsupported piece to be fully inside support area
    // Support is at x=100-300, y=100-200
    // Move piece to x=150, y=110 (size 80×80) → fully contained
    useSceneStore.setState((state) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          'test-unsupported': {
            ...state.scene.pieces['test-unsupported'],
            position: { x: 150, y: 110 },
          },
        },
      },
    }));

    return true;
  });
  expect(moved).toBe(true);

  // Force validation again
  const forced2 = await page.evaluate(async () => {
    const fn = (window as any).__testForceFullValidation;
    if (!fn) return { ok: false, error: 'hook not found' };
    return await fn();
  });
  expect(forced2.ok).toBe(true);

  // Wait for unsupported_above problem to disappear
  const problemCleared = await page.evaluate(async () => {
    const fn = (window as any).__testWaitForProblems;
    if (!fn) return false;
    return await fn({ codes: ['unsupported_above'], expectAbsent: true, timeoutMs: 2000 });
  });
  expect(problemCleared).toBe(true);

  // Verify problem disappeared from panel
  const updatedProblemsText = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="problems-panel"]');
    return panel?.textContent || '';
  });

  // Problem should be gone
  expect(updatedProblemsText).not.toContain('Pièce non supportée par couche inférieure');
});
