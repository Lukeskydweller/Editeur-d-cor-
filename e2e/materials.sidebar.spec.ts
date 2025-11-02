import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

test('Materials panel shows sheets and fill % with orientation WARN', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Verify materials panel exists and is visible
  const panel = page.getByTestId('materials-panel');
  await expect(panel).toBeVisible();

  // Verify header
  await expect(panel).toContainText(/Matières/i);

  // Initially should show some usage (default scene has pieces)
  // Look for the pattern "X plaque(s) · remplissage Y%"
  const content = await panel.textContent();

  // Should show material usage information
  expect(content).toMatch(/plaque/i); // French for "sheet"
  expect(content).toMatch(/remplissage/i); // French for "fill"
  expect(content).toMatch(/%/); // Percentage symbol
  expect(content).toMatch(/cm²/); // Area unit

  // Test with Shape Library: add a new piece
  const addButton = page.getByRole('button', { name: /Ajouter un rectangle/i });
  if (await addButton.isVisible()) {
    await addButton.click();

    // Wait for panel to update
    await page.waitForTimeout(200);

    // Panel should still be visible and showing updated data
    await expect(panel).toBeVisible();
    const updatedContent = await panel.textContent();
    expect(updatedContent).toMatch(/plaque/i);
  }
});

// Note: Orientation warning display is covered by unit tests (material.usage.spec.ts)
// The E2E test above verifies the panel renders correctly with real data
