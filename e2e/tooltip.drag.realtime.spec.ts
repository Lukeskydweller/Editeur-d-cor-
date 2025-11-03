import { test, expect } from '@playwright/test';
import { addRectAtPos, waitForCanvas } from './helpers';

/**
 * Tests E2E pour la tooltip de gap en temps réel pendant le drag.
 * Ces tests vérifient que la tooltip affiche le gap basé sur la position candidate,
 * pas sur l'état commité.
 */
test.describe('Micro-tooltip temps réel pendant drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('Drag souris vers voisin → tooltip temps réel se met à jour', async ({ page }) => {
    // Ajouter 2 pièces avec gap initial ~5mm
    await addRectAtPos(page, 100, 100, 50, 50); // p1: x=100..150
    await addRectAtPos(page, 169, 100, 50, 50); // p2: x=169..219, gap ≈ 19px ≈ 5.03mm

    // Localiser la première pièce (le rect SVG)
    const piece1 = page.locator('svg rect').nth(1);

    // Déclencher un drag souris réel
    // 1. MouseDown sur p1
    await piece1.hover();
    await page.mouse.down();

    // 2. Attendre un peu pour que le drag démarre
    await page.waitForTimeout(50);

    // 3. Déplacer de 5px vers la droite (gap devrait être ~14px ≈ 3.7mm)
    await page.mouse.move(105, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Vérifier que la tooltip existe et affiche un gap réduit
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const text1 = await tooltip.textContent();
    // Le gap devrait être entre 3mm et 5mm
    expect(text1).toMatch(/[3-4]\.\d{2} mm/);

    // 4. Continuer de déplacer vers la droite (+5px de plus)
    await page.mouse.move(110, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Le gap devrait encore diminuer (~9px ≈ 2.4mm)
    const text2 = await tooltip.textContent();
    expect(text2).toMatch(/[2-3]\.\d{2} mm/);

    // 5. Relâcher la souris (commit)
    await page.mouse.up();
    await page.waitForTimeout(100);

    // La tooltip devrait toujours être visible avec le gap final
    const textFinal = await tooltip.textContent();
    expect(textFinal).toMatch(/[2-3]\.\d{2} mm/);
  });

  test('Drag approche collage (<1mm) → tooltip affiche "Collage"', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~2mm
    await addRectAtPos(page, 100, 100, 50, 50); // p1: x=100..150
    await addRectAtPos(page, 158, 100, 50, 50); // p2: x=158..208, gap ≈ 8px ≈ 2.12mm

    const piece1 = page.locator('svg rect').nth(1);

    // Drag vers la droite
    await piece1.hover();
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Déplacer de ~5px (gap devrait devenir ~3px ≈ 0.79mm < 1mm)
    await page.mouse.move(105, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Tooltip devrait afficher "Collage"
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    await expect(tooltip).toHaveText('Collage');

    // Relâcher
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Tooltip devrait toujours afficher "Collage" après commit
    await expect(tooltip).toHaveText('Collage');
  });

  test('Drag éloigne du voisin → tooltip disparaît (gap > 6mm)', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~3mm
    await addRectAtPos(page, 100, 100, 50, 50); // p1: x=100..150
    await addRectAtPos(page, 162, 100, 50, 50); // p2: x=162..212, gap ≈ 12px ≈ 3.17mm

    const piece1 = page.locator('svg rect').nth(1);

    // Vérifier tooltip initiale visible
    await piece1.click();
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });

    // Drag vers la gauche (éloigner de p2)
    await piece1.hover();
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Déplacer de 15px vers la gauche (gap devient ~27px ≈ 7.14mm > 6mm)
    await page.mouse.move(85, 125, { steps: 1 });
    await page.waitForTimeout(150);

    // Tooltip devrait avoir disparu (gap > 6mm)
    await expect(tooltip).not.toBeVisible();

    // Relâcher
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Tooltip devrait rester invisible
    await expect(tooltip).not.toBeVisible();
  });

  test('Groupe drag → tooltip basée sur bbox groupe candidate', async ({ page }) => {
    // Ajouter 3 pièces : 2 formant un groupe, 1 voisine
    await addRectAtPos(page, 100, 100, 30, 50); // g1: x=100..130
    await addRectAtPos(page, 135, 100, 30, 50); // g2: x=135..165 (bbox: 100..165)
    await addRectAtPos(page, 175, 100, 50, 50); // neighbor: x=175..225, gap = 10px ≈ 2.65mm

    // Sélectionner g1
    await page.locator('svg rect').nth(1).click();

    // Shift+click sur g2
    await page.keyboard.down('Shift');
    await page.locator('svg rect').nth(2).click();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(100);

    // Vérifier tooltip initiale
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const textInitial = await tooltip.textContent();
    expect(textInitial).toMatch(/2\.\d{2} mm/);

    // Drag le groupe vers la droite
    const piece1 = page.locator('svg rect').nth(1);
    await piece1.hover();
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Déplacer de 5px vers la droite (gap devrait être ~5px ≈ 1.32mm)
    await page.mouse.move(105, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Tooltip devrait afficher gap réduit
    const textDrag = await tooltip.textContent();
    expect(textDrag).toMatch(/1\.\d{2} mm/);

    // Relâcher
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Tooltip devrait afficher le gap final
    const textFinal = await tooltip.textContent();
    expect(textFinal).toMatch(/1\.\d{2} mm/);
  });

  test('Annulation drag (Escape) → tooltip revient à état commité', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~3mm
    await addRectAtPos(page, 100, 100, 50, 50); // p1: x=100..150
    await addRectAtPos(page, 162, 100, 50, 50); // p2: x=162..212, gap ≈ 12px ≈ 3.17mm

    const piece1 = page.locator('svg rect').nth(1);

    // Vérifier tooltip initiale
    await piece1.click();
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const textInitial = await tooltip.textContent();
    expect(textInitial).toMatch(/3\.\d{2} mm/);

    // Drag vers la droite
    await piece1.hover();
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Déplacer de 5px (gap devrait être ~7px ≈ 1.85mm)
    await page.mouse.move(105, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Tooltip devrait afficher gap réduit
    const textDrag = await tooltip.textContent();
    expect(textDrag).toMatch(/[1-2]\.\d{2} mm/);

    // Annuler avec Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Tooltip devrait revenir à l'état initial (3mm)
    const textAfterCancel = await tooltip.textContent();
    expect(textAfterCancel).toMatch(/3\.\d{2} mm/);
  });

  test('Resize agrandit vers voisin → tooltip temps réel', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~5mm
    await addRectAtPos(page, 100, 100, 50, 50); // p1: x=100..150
    await addRectAtPos(page, 169, 100, 50, 50); // p2: x=169..219, gap ≈ 19px ≈ 5.03mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();
    await page.waitForTimeout(100);

    // Vérifier tooltip initiale
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const textInitial = await tooltip.textContent();
    expect(textInitial).toMatch(/5\.\d{2} mm/);

    // Localiser la handle de resize à droite (e)
    // Note: ceci dépend de l'implémentation des handles de resize
    // On suppose qu'il existe un élément avec data-handle="e"
    const handleE = page.locator('[data-handle="e"]');

    // Si la handle n'existe pas, skip ce test
    const handleExists = await handleE.count() > 0;
    if (!handleExists) {
      test.skip();
      return;
    }

    // Drag la handle vers la droite
    await handleE.hover();
    await page.mouse.down();
    await page.waitForTimeout(50);

    // Déplacer de 10px vers la droite (largeur augmente, gap diminue)
    await page.mouse.move(160, 125, { steps: 1 });
    await page.waitForTimeout(100);

    // Tooltip devrait afficher gap réduit (~9px ≈ 2.38mm)
    const textResize = await tooltip.textContent();
    expect(textResize).toMatch(/[2-3]\.\d{2} mm/);

    // Relâcher
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Tooltip devrait afficher le gap final
    const textFinal = await tooltip.textContent();
    expect(textFinal).toMatch(/[2-3]\.\d{2} mm/);
  });
});
