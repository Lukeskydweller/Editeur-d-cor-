import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

/**
 * E2E test for PathOps exact validation of layer support.
 * Forces PATHOPS strategy via window.__flags before app boot.
 *
 * Tests exact geometric containment using boolean operations (union + contains).
 * Verifies that pieces on upper layers must be fully contained within
 * the union of pieces on all lower layers.
 */
test('layers support — PathOps exact validation (FORCE_SUPPORT_STRATEGY=PATHOPS)', async ({ page }) => {
  // Force PATHOPS strategy before app boots
  await page.addInitScript(() => {
    (window as any).__flags = {
      ...(window as any).__flags,
      FORCE_SUPPORT_STRATEGY: 'PATHOPS',
    };
  });

  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Verify PATHOPS strategy is active
  const strategy = await page.evaluate(() => {
    const flags = (window as any).__flags;
    return flags?.FORCE_SUPPORT_STRATEGY;
  });
  expect(strategy).toBe('PATHOPS');

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

    // Create pieces: support in L1 (100×100), unsupported piece in L2 extends 25mm beyond
    useSceneStore.setState((state) => ({
      scene: {
        ...state.scene,
        layers: {
          ...state.scene.layers,
          [newLayerId]: newLayer,
        },
        layerOrder: [...state.scene.layerOrder, newLayerId],
        pieces: {
          // Layer 1: Support piece at (0, 0) with size 100×100
          'test-support': {
            id: 'test-support',
            kind: 'rect' as const,
            position: { x: 0, y: 0 },
            size: { w: 100, h: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
          // Layer 2: Piece at (75, 0) with size 50×50
          // Right edge at 125mm extends 25mm beyond support (exact=100)
          'test-unsupported': {
            id: 'test-unsupported',
            kind: 'rect' as const,
            position: { x: 75, y: 0 },
            size: { w: 50, h: 50 },
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
    return await fn({ codes: ['unsupported_above'], timeoutMs: 3000 });
  });
  expect(seenUnsupported).toBe(true);

  // Verify Problems Panel shows unsupported warning
  const panel = page.getByTestId('problems-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Pièce non supportée par couche inférieure');

  // Move piece to be fully supported (within tolerance epsilon 0.10mm)
  const moved = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');

    // Move test-unsupported piece to be fully inside support area
    // Support is at x=0-100, y=0-100
    // Move piece to x=50, y=0 (size 50×50) → right edge at 100mm (flush with support)
    useSceneStore.setState((state) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          'test-unsupported': {
            ...state.scene.pieces['test-unsupported'],
            position: { x: 50, y: 0 }, // Flush with support right edge (100mm)
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
    return await fn({ codes: ['unsupported_above'], expectAbsent: true, timeoutMs: 3000 });
  });
  expect(problemCleared).toBe(true);

  // Verify problem disappeared from panel
  const updatedProblemsText = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="problems-panel"]');
    return panel?.textContent || '';
  });

  // Problem should be gone (piece is now fully supported)
  expect(updatedProblemsText).not.toContain('Pièce non supportée par couche inférieure');
});

/**
 * Test union of multiple support pieces with PathOps.
 * Verifies that a piece on L3 can be supported by the union of L1+L2.
 */
test('layers support — PathOps union of L1+L2 supports L3', async ({ page }) => {
  // Force PATHOPS strategy before app boots
  await page.addInitScript(() => {
    (window as any).__flags = {
      ...(window as any).__flags,
      FORCE_SUPPORT_STRATEGY: 'PATHOPS',
    };
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create test scenario: 3 layers, L1+L2 form union support for L3
  const created = await page.evaluate(async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const firstLayerId = store.scene.layerOrder[0];
    if (!firstLayerId) return false;

    const firstMaterialId = Object.keys(store.scene.materials)[0];
    if (!firstMaterialId) return false;

    // Add layers 2 and 3
    const layer2Id = 'test-layer-2';
    const layer3Id = 'test-layer-3';

    useSceneStore.setState((state) => ({
      scene: {
        ...state.scene,
        layers: {
          ...state.scene.layers,
          [layer2Id]: { id: layer2Id, name: 'Layer 2', z: 1, visible: true, locked: false },
          [layer3Id]: { id: layer3Id, name: 'Layer 3', z: 2, visible: true, locked: false },
        },
        layerOrder: [...state.scene.layerOrder, layer2Id, layer3Id],
        pieces: {
          // L1: Left piece (0-50, 0-100)
          'support-l1': {
            id: 'support-l1',
            kind: 'rect' as const,
            position: { x: 0, y: 0 },
            size: { w: 50, h: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
          // L2: Right piece (50-100, 0-100)
          'support-l2': {
            id: 'support-l2',
            kind: 'rect' as const,
            position: { x: 50, y: 0 },
            size: { w: 50, h: 100 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: layer2Id,
            materialId: firstMaterialId,
          },
          // L3: Bridge piece (0-100, 25-75) → supported by union of L1+L2
          'bridge-l3': {
            id: 'bridge-l3',
            kind: 'rect' as const,
            position: { x: 0, y: 25 },
            size: { w: 100, h: 50 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: layer3Id,
            materialId: firstMaterialId,
          },
        },
      },
    }));

    return true;
  });

  expect(created).toBe(true);

  // Force validation
  const forced = await page.evaluate(async () => {
    const fn = (window as any).__testForceFullValidation;
    if (!fn) return { ok: false, error: 'hook not found' };
    return await fn();
  });
  expect(forced.ok).toBe(true);

  // Should have no unsupported_above problems (bridge fully supported by union)
  const hasNoUnsupported = await page.evaluate(async () => {
    const fn = (window as any).__testWaitForProblems;
    if (!fn) return false;
    // Wait for validation to complete, expecting no unsupported_above
    await new Promise(r => setTimeout(r, 500));

    const getProblems = (window as any).__testGetProblems;
    if (!getProblems) return false;

    const result = await getProblems();
    const problems = result.problems || [];
    return !problems.some((p: any) => p.code === 'unsupported_above');
  });

  expect(hasNoUnsupported).toBe(true);

  // Panel should not show unsupported warning
  const panelText = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="problems-panel"]');
    return panel?.textContent || '';
  });
  expect(panelText).not.toContain('Pièce non supportée par couche inférieure');
});
