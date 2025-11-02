import { test as base, expect } from "@playwright/test";

// Skip if PWREADY not set (same pattern as PathOps E2E)
const test = (process.env.PWREADY === "1") ? base : base.skip;

// Test déjà réactivé : pas de changement logique, juste commentaire indiquant que l'unique source d'affichage est StatusBadge/ProblemsPanel.

test("detects overlap_same_layer and shows BLOCK status", async ({ page }) => {
    // Listen to console logs

    await page.goto("/");

    // Wait for page to be ready
    await page.waitForLoadState("networkidle");

    // Wait for geo worker to be fully initialized
    await page.evaluate(async () => {
      const fn = (window as any).__waitGeoReady;
      if (fn) await fn();
    });

    // Create overlap using test hook
    const created = await page.evaluate(async () => {
      const fn = (window as any).__testCreateOverlap;
      if (!fn) return false;
      return await fn();
    });

    expect(created).toBe(true);

    // __testCreateOverlap already waits for bridge + validation, check results
    const problems = await page.evaluate(async () => {
      const fn = (window as any).__testGetProblems;
      if (!fn) return null;
      const result = await fn();
      // Convert Set to Array for serialization
      return {
        hasBlock: result.hasBlock,
        conflictCount: result.conflicts.size
      };
    });

    expect(problems).toBeTruthy();
    expect(problems!.hasBlock).toBe(true);
    expect(problems!.conflictCount).toBeGreaterThan(0);

    // Verify StatusBadge shows BLOCK
    const badge = page.getByRole('status', { name: /validation/i });
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('BLOCK');

    // Verify ProblemsPanel is visible with conflict information
    const problemsPanel = page.getByText(/Problèmes/i);
    await expect(problemsPanel).toBeVisible();
    await expect(page.getByText(/overlap_same_layer/i).first()).toBeVisible();
});
