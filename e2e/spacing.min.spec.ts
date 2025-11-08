import { test, expect } from '@playwright/test';

// Skip if PWREADY not set (only run in dedicated E2E environment)
test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

test('spacing min — WARN then clear with joined toggle', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be ready
  await page.waitForLoadState('networkidle');

  // Wait for geo worker to be initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });

  // Create spacing problem using test hook
  const created = await page.evaluate(async () => {
    const fn = (window as any).__testCreateSpacingProblem;
    if (!fn) return false;
    return await fn();
  });

  expect(created).toBe(true);

  // Forcer la validation end-to-end (bypasse le debounce)
  const forced = await page.evaluate(async () => {
    const fn = (window as any).__testForceFullValidation;
    if (!fn) return { ok: false, error: 'hook not found' };
    return await fn();
  });
  expect(forced.ok).toBe(true);

  // Attente déterministe : on veut voir 'spacing_too_small'
  const seen = await page.evaluate(async () => {
    const fn = (window as any).__testWaitForProblems;
    if (!fn) return false;
    return await fn({ codes: ['spacing_too_small'], timeoutMs: 2000 });
  });
  expect(seen).toBe(true);

  // Verify Problems Panel shows spacing warning
  const panel = page.getByTestId('problems-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Écart inter-pièces insuffisant');

  // Toggle "Autoriser bord-à-bord" using hook (bypasses UI for robustness)
  const cleared = await page.evaluate(async () => {
    const toggleFn = (window as any).__testToggleJoined;
    const forceFn = (window as any).__testForceFullValidation;
    const waitFn = (window as any).__testWaitForProblems;
    if (!toggleFn || !forceFn || !waitFn) return false;

    await toggleFn('test-spacing-1'); // ID from __testCreateSpacingProblem
    await forceFn(); // Force validation after toggle to update problems
    return await waitFn({ codes: ['spacing_too_small'], expectAbsent: true, timeoutMs: 2000 });
  });
  expect(cleared).toBe(true);

  // Verify problem disappeared
  const updatedProblemsText = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="problems-panel"]');
    return panel?.textContent || '';
  });

  // Problem should be gone
  expect(updatedProblemsText).not.toContain('Écart inter-pièces insuffisant');
});
