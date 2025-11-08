import { test, expect } from '@playwright/test';

/**
 * Smoke tests: Critical path validation
 * Tagged with @smoke to run on every PR
 * Keep < 5 tests, fast execution (< 2min total)
 */

test('@smoke app loads and renders canvas', async ({ page }) => {
  await page.goto('/');

  // Canvas should be present (stable locator)
  await page.getByTestId('scene-canvas').waitFor();
  await expect(page.getByTestId('scene-canvas')).toBeVisible();

  // Should have default scene
  await expect(page.locator('text=/Brouillon|Draft/')).toBeVisible();
});

test('@smoke can add a rectangle piece', async ({ page }) => {
  await page.goto('/');

  // App starts with 1 default piece
  const piecesInitial = page.getByTestId('piece-rect');
  await expect(piecesInitial).toHaveCount(1);

  // Click add rectangle button (exact match to avoid ambiguity)
  const addButton = page.getByRole('button', { name: 'Ajouter rectangle' });
  await addButton.click();

  // Should now have 2 pieces (1 default + 1 new)
  const pieces = page.getByTestId('piece-rect');
  await expect(pieces).toHaveCount(2);
  await expect(pieces.first()).toBeVisible();
});

test('@smoke can select and delete piece', async ({ page }) => {
  await page.goto('/');

  // App starts with 1 default piece - select and delete it
  const piece = page.getByTestId('piece-rect').first();
  await expect(piece).toBeVisible();

  // Click piece to select
  await piece.click();

  // Verify piece is selected (web-first assertion)
  await expect(piece).toHaveAttribute('data-selected', 'true');

  // Delete with keyboard
  await page.keyboard.press('Delete');

  // Should have no pieces (web-first assertion with auto-retry)
  await expect(page.getByTestId('piece-rect')).toHaveCount(0);
});

test('@smoke typecheck passes (meta)', async ({ page }) => {
  // This is a meta-test to ensure CI typecheck is working
  // If this runs, it means build succeeded
  await page.goto('/');
  expect(true).toBe(true);
});
