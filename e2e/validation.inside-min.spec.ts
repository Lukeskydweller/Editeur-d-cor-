import { test as base, expect } from "@playwright/test";

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = (process.env.PWREADY === "1") ? base : base.skip;

test("problems panel shows outside_scene and min_size", async ({ page }) => {
  await page.goto("/");

  // Wait for page to be ready
  await page.waitForLoadState("networkidle");

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create validation problems using test hook
  const created = await page.evaluate(async () => {
    const fn = (window as any).__testCreateValidationProblems;
    if (!fn) return false;
    return await fn();
  });

  expect(created).toBe(true);

  // __testCreateValidationProblems already waits for bridge + validation, check results
  const problems = await page.evaluate(async () => {
    const fn = (window as any).__testGetProblems;
    if (!fn) return null;
    return await fn();
  });

  expect(problems).toBeTruthy();
  expect(problems!.hasBlock).toBe(true);
  expect(problems!.problems.length).toBeGreaterThan(0);

  // Verify we have both outside_scene and min_size_violation
  const outsideCount = problems!.problems.filter((p: any) => p.code === "outside_scene").length;
  const minSizeCount = problems!.problems.filter((p: any) => p.code === "min_size_violation").length;

  expect(outsideCount).toBeGreaterThan(0);
  expect(minSizeCount).toBeGreaterThan(0);

  // Verify StatusBadge shows BLOCK
  const badge = page.getByRole('status', { name: /validation/i });
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('BLOCK');

  // Verify ProblemsPanel displays the problems
  const problemsPanel = page.getByTestId('problems-panel');
  await expect(problemsPanel).toBeVisible();

  // Check for French labels in the panel
  await expect(problemsPanel).toContainText('Hors cadre scène');
  await expect(problemsPanel).toContainText('Taille minimale');
});
