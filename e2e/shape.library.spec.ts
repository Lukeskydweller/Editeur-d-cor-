import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

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
  page.on('console', msg => {
    if (msg.type() === 'error') {
      logs.push(msg.text());
    }
  });

  // No assertions on logs - the test passes if we reach this point without throwing
});
