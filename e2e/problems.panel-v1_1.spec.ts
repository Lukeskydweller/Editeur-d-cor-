import { test as base, expect } from '@playwright/test';

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = process.env.PWREADY === '1' ? base : base.skip;

test('ProblemsPanel v1.1 grouping and filters', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create validation problems (outside_scene + min_size_violation) using existing hook
  const created = await page.evaluate(async () => {
    const fn = (window as any).__testCreateValidationProblems;
    if (!fn) return false;
    return await fn();
  });

  expect(created).toBe(true);

  // Verify groups are visible
  await expect(page.getByTestId('group-outside_scene')).toBeVisible();
  await expect(page.getByTestId('group-min_size_violation')).toBeVisible();

  // Test BLOCK filter
  await page.getByTestId('filter-block').click();

  // Both groups should still be visible (both are BLOCK severity)
  await expect(page.getByTestId('group-outside_scene')).toBeVisible();
  await expect(page.getByTestId('group-min_size_violation')).toBeVisible();

  // Test zoom button is present and clickable
  const zoomButtons = await page.getByTestId(/zoom-/).all();
  expect(zoomButtons.length).toBeGreaterThan(0);

  // Click first zoom button
  await zoomButtons[0].click();
  // No error should occur (flash/focus actions execute successfully)

  // Test filter tabs are accessible
  const allFilter = page.getByTestId('filter-all');
  await expect(allFilter).toHaveAttribute('role', 'tab');
  await expect(page.getByTestId('filter-block')).toHaveAttribute('role', 'tab');
  await expect(page.getByTestId('filter-warn')).toHaveAttribute('role', 'tab');
});
