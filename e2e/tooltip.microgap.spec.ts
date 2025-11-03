import { test, expect, type Page } from '@playwright/test';
import { addRectAtPos, dragPieceBy, waitForCanvas } from './helpers';

test.describe('Micro-tooltip persistante de gap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('Au repos: sélection pièce gap ~5mm → tooltip visible et persistante', async ({ page }) => {
    // Ajouter 2 pièces côte-à-côte avec gap ~5mm
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 219, 100, 100, 60); // p2: x=219..319, gap ≈ 19px ≈ 5.03mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu pour que la tooltip apparaisse
    await page.waitForTimeout(100);

    // Vérifier que la tooltip affiche "5.03 mm" (ou proche)
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const text = await tooltip.textContent();
    expect(text).toMatch(/5\.\d{2} mm/);

    // En mode sticky, attendre 1 seconde et vérifier que la tooltip est toujours visible
    await page.waitForTimeout(1000);
    await expect(tooltip).toBeVisible();
    const textAfter = await tooltip.textContent();
    expect(textAfter).toMatch(/5\.\d{2} mm/);
  });

  test('Drag à ~0.9mm → "Bord à bord" visible et persiste', async ({ page }) => {
    // Ajouter 2 pièces très proches (gap < 1.0mm)
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 203, 100, 100, 60); // p2: x=203..303, gap ≈ 3px ≈ 0.79mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu pour que la tooltip apparaisse
    await page.waitForTimeout(100);

    // Vérifier que la tooltip affiche "Bord à bord"
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    await expect(tooltip).toHaveText('Bord à bord');

    // En mode sticky, reste visible après 500ms
    await page.waitForTimeout(500);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('Bord à bord');
  });

  test('Collage parfait à 0mm → "Bord à bord" affiché', async ({ page }) => {
    // Ajouter 2 pièces bord-à-bord (gap = 0)
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 200, 100, 100, 60); // p2: x=200..300, gap = 0

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu
    await page.waitForTimeout(100);

    // Vérifier que la tooltip affiche "Bord à bord"
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    await expect(tooltip).toHaveText('Bord à bord');
  });

  test('Gap = 10mm exactement → tooltip visible', async ({ page }) => {
    // Ajouter 2 pièces avec gap exactement 10mm (seuil max inclus)
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 238, 100, 100, 60); // p2: x=238..338, gap ≈ 38px ≈ 10.05mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu
    await page.waitForTimeout(100);

    // Tooltip doit être visible car gap ≤ 10mm
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const text = await tooltip.textContent();
    expect(text).toMatch(/10\.\d{2} mm/);
  });

  test('Gap > 10mm → rien affiché', async ({ page }) => {
    // Ajouter 2 pièces éloignées (gap > 10mm)
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 242, 100, 100, 60); // p2: x=242..342, gap ≈ 42px ≈ 11.11mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu
    await page.waitForTimeout(100);

    // Tooltip ne doit pas être visible
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).not.toBeVisible();
  });

  test('Nudge clavier éloigne au-delà de 10mm → tooltip disparaît', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~3mm
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 212, 100, 100, 60); // p2: x=212..312, gap ≈ 12px ≈ 3.17mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre la tooltip initiale
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    let text = await tooltip.textContent();
    expect(text).toMatch(/3\.\d{2} mm/);

    // Déplacer p1 vers la droite (éloigner, +10mm par défaut avec snap ON)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Tooltip doit avoir disparu car gap > 10mm maintenant
    await expect(tooltip).not.toBeVisible();
  });

  test('Rapprochement drag → tooltip réapparaît, passe à "Bord à bord" < 1mm', async ({ page }) => {
    // Ajouter 2 pièces éloignées
    await addRectAtPos(page, 100, 100, 100, 60); // p1: x=100..200
    await addRectAtPos(page, 250, 100, 100, 60); // p2: x=250..350, gap = 50px ≈ 13.23mm

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu - tooltip ne doit pas être visible (gap > 10mm)
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).not.toBeVisible();

    // Drag p1 vers la droite pour rapprocher (~30mm vers droite)
    const rect1 = page.locator('svg rect').nth(1);
    await dragPieceBy(page, rect1, 114, 0); // ≈30mm

    // Attendre un peu pour stabilisation
    await page.waitForTimeout(100);

    // Tooltip doit maintenant être visible avec gap réduit (~8mm)
    await expect(tooltip).toBeVisible({ timeout: 500 });
    let text = await tooltip.textContent();
    expect(text).toMatch(/\d+\.\d{2} mm/);

    // Continuer à rapprocher pour passer < 1mm
    await dragPieceBy(page, rect1, 26, 0); // ≈7mm de plus

    await page.waitForTimeout(100);

    // Tooltip doit maintenant afficher "Bord à bord"
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('Bord à bord');
  });

  test('Groupe multi-sélection → tooltip basée sur bbox groupe', async ({ page }) => {
    // Ajouter 3 pièces : 2 sélectionnées formant un groupe, 1 voisine
    await addRectAtPos(page, 100, 100, 50, 60); // g1: x=100..150
    await addRectAtPos(page, 160, 100, 50, 60); // g2: x=160..210 (bbox groupe: 100..210)
    await addRectAtPos(page, 216, 100, 50, 60); // neighbor: x=216..266, gap = 6px ≈ 1.59mm

    // Sélectionner g1
    await page.locator('svg rect').nth(1).click();

    // Shift+click sur g2 pour ajouter à la sélection
    await page.keyboard.down('Shift');
    await page.locator('svg rect').nth(2).click();
    await page.keyboard.up('Shift');

    // Attendre la tooltip
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });
    const text = await tooltip.textContent();
    expect(text).toMatch(/1\.\d{2} mm/);

    // En mode sticky, reste visible pour le groupe
    await page.waitForTimeout(1000);
    await expect(tooltip).toBeVisible();
  });

  test('Aucun voisin → pas de tooltip', async ({ page }) => {
    // Ajouter 1 seule pièce
    await addRectAtPos(page, 100, 100, 100, 60);

    // Sélectionner la pièce
    await page.locator('svg rect').nth(1).click();

    // Attendre un peu
    await page.waitForTimeout(100);

    // Tooltip ne doit pas être visible
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).not.toBeVisible();
  });

  test('Désélection → tooltip disparaît', async ({ page }) => {
    // Ajouter 2 pièces avec gap ~3mm
    await addRectAtPos(page, 100, 100, 100, 60);
    await addRectAtPos(page, 212, 100, 100, 60);

    // Sélectionner p1
    await page.locator('svg rect').nth(1).click();

    // Attendre la tooltip
    await page.waitForTimeout(100);
    const tooltip = page.locator('.micro-gap-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 500 });

    // Désélectionner (clic sur fond)
    await page.locator('svg').click({ position: { x: 50, y: 50 } });

    // Attendre un peu
    await page.waitForTimeout(100);

    // Tooltip doit avoir disparu
    await expect(tooltip).not.toBeVisible();
  });
});
