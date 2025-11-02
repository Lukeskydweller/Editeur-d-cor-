import { test as base, expect } from "@playwright/test";

// Skip if PWREADY not set (same pattern as other E2E tests)
const test = (process.env.PWREADY === "1") ? base : base.skip;

test("rotated piece can be resized via handles and snaps correctly", async ({ page }) => {
  await page.goto("/");

  // Wait for page to be ready
  await page.waitForLoadState("networkidle");

  // Wait for geo worker to be fully initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create, rotate, and resize piece using test hook
  const result = await page.evaluate(async () => {
    const fn = (window as any).__testRotateAndResize;
    if (!fn) return { success: false, reason: "hook not found" };
    try {
      return await fn({ rotateDeg: 90, drag: { dx: 40, dy: 0 } });
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  });

  expect(result.success).toBe(true);

  // Verify resize succeeded and no min_size_violation
  const problems = await page.evaluate(async () => {
    const fn = (window as any).__testGetProblems;
    if (!fn) return null;
    return await fn();
  });

  expect(problems).toBeTruthy();

  // No min_size_violation should be present
  const minSizeProblems = problems!.problems.filter((p: any) => p.code === "min_size_violation");
  expect(minSizeProblems.length).toBe(0);

  // StatusBadge should show OK (no BLOCK)
  const badge = page.getByRole('status', { name: /validation/i });
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('OK');
});
