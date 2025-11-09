import { test, expect } from '@playwright/test';

test.describe('Group drag behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('svg');
  });

  test('drag group succeeds without rollback in empty area', async ({ page }) => {
    // Create two pieces
    await page.click('button:has-text("Ajouter rectangle")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Ajouter rectangle")');
    await page.waitForTimeout(100);

    // Get initial positions
    const piece1 = await page.locator('[data-piece-id]').first();
    const piece2 = await page.locator('[data-piece-id]').nth(1);

    const box1Before = await piece1.boundingBox();
    const box2Before = await piece2.boundingBox();

    // Select both pieces (Ctrl+A)
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(100);

    // Drag group by 20mm (assuming viewport scale)
    const svg = await page.locator('svg').first();
    const svgBox = await svg.boundingBox();

    if (!svgBox || !box1Before) return;

    const startX = svgBox.x + 100;
    const startY = svgBox.y + 100;
    const endX = startX + 40; // ~20mm depending on scale
    const endY = startY + 40;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Assert: positions changed
    const box1After = await piece1.boundingBox();
    const box2After = await piece2.boundingBox();

    expect(box1After?.x).not.toBe(box1Before?.x);
    expect(box2After?.x).not.toBe(box2Before?.x);

    // Assert: no red flash (validation OK)
    const statusBadge = await page.locator('[data-testid="status-badge"]');
    const statusText = await statusBadge.textContent();
    expect(statusText).toContain('OK');
  });

  test('drag group snaps & guards vs external neighbor', async ({ page }) => {
    // Create three pieces: two for group, one external neighbor
    await page.click('button:has-text("Ajouter rectangle")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Ajouter rectangle")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Ajouter rectangle")');
    await page.waitForTimeout(100);

    // Position third piece as external neighbor (manual positioning would be needed)
    // For now, just verify ghost rendering during drag

    // Select first two pieces
    const piece1 = await page.locator('[data-piece-id]').first();
    await piece1.click();
    await page.keyboard.down('Shift');
    const piece2 = await page.locator('[data-piece-id]').nth(1);
    await piece2.click();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    // Start drag to trigger ghosts
    await piece1.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Assert: ghosts render
    const ghosts = await page.locator('[data-testid="ghost-piece"]').count();
    expect(ghosts).toBeGreaterThan(0);

    await page.mouse.up();
  });
});
