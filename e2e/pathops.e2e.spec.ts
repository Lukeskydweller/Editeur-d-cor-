// Test E2E PathOps : exécution réelle de PathKit WASM dans un navigateur
import { test as base, expect } from "@playwright/test";

// Skip automatique si l'env Playwright n'est pas prêt
const test = (process.env.PWREADY === "1") ? base : base.skip;

const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: w + x, y },
  { x: w + x, y: h + y },
  { x, y: h + y },
];

test("PathOps boolean union runs in real browser", async ({ page }) => {
  await page.goto("/");
  const ok = await page.evaluate(async (args) => {
    const [a, b] = args;
    // @ts-ignore
    return await window.__geoBooleanOp(a, b, "union").then(() => true).catch(() => false);
  }, [rect(0, 0, 10, 10), rect(5, 0, 10, 10)]);
  expect(ok).toBe(true);
});

test("PathOps intersect runs in real browser", async ({ page }) => {
  await page.goto("/");
  const ok = await page.evaluate(async (args) => {
    const [a, b] = args;
    // @ts-ignore
    return await window.__geoBooleanOp(a, b, "intersect").then(() => true).catch(() => false);
  }, [rect(0, 0, 10, 10), rect(5, 0, 10, 10)]);
  expect(ok).toBe(true);
});
