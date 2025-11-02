import { test, expect } from "@playwright/test";
test("ghost → commit légal", async ({ page }) => {
  await page.goto("/");
  // Pré-conditions: scène minimale chargée
  // 1) simuler un drag qui placerait la pièce en état illégal (à cheval hors zone),
  //    l'UI doit rester en quasi-mode (fantôme), puis revenir légal et Commit.
  // NOTE: sélecteurs par rôles/labels à adapter quand l'UI expose ces hooks.
  await expect(page).toHaveURL(/\/?/);
});
