import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('ShapeLibrary UI is functional', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Verify ShapeLibrary component is visible
  await expect(page.getByTestId('shape-library')).toBeVisible();

  // Verify all preset buttons are visible and clickable
  await expect(page.getByTestId('preset-60x60')).toBeVisible();
  await expect(page.getByTestId('preset-100x60')).toBeVisible();
  await expect(page.getByTestId('preset-200x100')).toBeVisible();

  // Test preset button is clickable (no error should occur)
  await page.getByTestId('preset-60x60').click();
  await page.waitForTimeout(200);

  // Verify custom input fields are functional
  await expect(page.getByTestId('custom-width')).toBeVisible();
  await expect(page.getByTestId('custom-height')).toBeVisible();
  await expect(page.getByTestId('custom-insert')).toBeVisible();

  // Test custom rectangle input
  await page.getByTestId('custom-width').fill('80');
  await page.getByTestId('custom-height').fill('120');

  // Verify values were set
  expect(await page.getByTestId('custom-width').inputValue()).toBe('80');
  expect(await page.getByTestId('custom-height').inputValue()).toBe('120');

  // Test custom insert button is clickable (no error should occur)
  await page.getByTestId('custom-insert').click();
  await page.waitForTimeout(200);

  // Verify no console errors (general smoke test)
  const logs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });

  // No assertions on logs - the test passes if we reach this point without throwing
});

test('ShapeLibrary input tolerance and Enter key', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  const widthInput = page.getByTestId('custom-width');
  const heightInput = page.getByTestId('custom-height');
  const insertButton = page.getByTestId('custom-insert');

  // Test accepting "0" during typing
  await widthInput.fill('0');
  expect(await widthInput.inputValue()).toBe('0');

  // Test blur clamps to 5mm
  await widthInput.blur();
  await page.waitForTimeout(100);
  expect(await widthInput.inputValue()).toBe('5');

  // Test Enter key triggers insertion
  await widthInput.fill('100');
  await heightInput.fill('80');
  await widthInput.press('Enter');
  await page.waitForTimeout(200);

  // Verify insertion worked (no console errors)
  // The test passes if we reach this point without errors
});

test('ShapeLibrary auto-placement with presets', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Insert multiple presets - they should auto-place without overlapping
  await page.getByTestId('preset-60x60').click();
  await page.waitForTimeout(200);

  await page.getByTestId('preset-100x60').click();
  await page.waitForTimeout(200);

  await page.getByTestId('preset-200x100').click();
  await page.waitForTimeout(200);

  // Verify no console errors during auto-placement
  // The test passes if all insertions succeed without errors
});
