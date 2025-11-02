import { test as base, expect } from "@playwright/test";
const test = (process.env.PWREADY === "1") ? base : base.skip;
const rect = (x:number,y:number,w:number,h:number) => ([
  {x, y}, {x:w+x, y}, {x:w+x, y:h+y}, {x, y:h+y}
]);
test("booleanOpPolys returns at least 1 contour for union", async ({ page }) => {
  await page.goto("/");
  const count = await page.evaluate(async (args) => {
    const [a, b] = args;
    // @ts-ignore
    const polys = await window.__geoBooleanOpPolys?.(a, b, "union");
    return Array.isArray(polys) ? polys.length : -1;
  }, [rect(0,0,10,10), rect(5,0,10,10)]);
  expect(count).toBeGreaterThan(0);
});
