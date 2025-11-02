import { test, expect } from "@playwright/test";
test("resize lock-edge", async ({ page }) => {
  await page.goto("/");
  // 1) activer lock-edge sur p1
  // 2) resize en conservant le collage ; pas de rupture d'attache
  // NOTE: placeholder en attendant les hooks UI ; le test restera skipped si nécessaire.
  test.skip(true, "UI hooks à câbler dans une étape suivante");
  await expect(page).toHaveURL(/\/?/);
});
