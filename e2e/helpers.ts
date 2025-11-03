import type { Page } from '@playwright/test';

/**
 * Wait for canvas to be ready (SVG rendered)
 */
export async function waitForCanvas(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('svg[role="img"][aria-label="editor-canvas"]', { timeout: 5000 });

  // Wait for geo worker to be initialized
  await page.evaluate(async () => {
    const fn = (window as any).__waitGeoReady;
    if (fn) await fn();
  });
}

/**
 * Add a rectangle at a specific position via test hook
 */
export async function addRectAtPos(
  page: Page,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<string | null> {
  return await page.evaluate(
    async ({ x, y, w, h }) => {
      const fn = (window as any).__testAddRectAtPos;
      if (!fn) return null;
      return await fn({ x, y, w, h });
    },
    { x, y, w, h }
  );
}

/**
 * Drag a piece by a delta in mm
 */
export async function dragPieceBy(
  page: Page,
  pieceId: string,
  dx: number,
  dy: number
): Promise<boolean> {
  return await page.evaluate(
    async ({ pieceId, dx, dy }) => {
      const fn = (window as any).__testDragPieceBy;
      if (!fn) return false;
      return await fn({ pieceId, dx, dy });
    },
    { pieceId, dx, dy }
  );
}

/**
 * Get piece position
 */
export async function getPiecePosition(
  page: Page,
  pieceId: string
): Promise<{ x: number; y: number } | null> {
  return await page.evaluate(
    async (pieceId) => {
      const fn = (window as any).__testGetPiecePosition;
      if (!fn) return null;
      return await fn(pieceId);
    },
    pieceId
  );
}

/**
 * Nudge selected piece via keyboard
 */
export async function nudgeSelected(
  page: Page,
  dx: number,
  dy: number
): Promise<boolean> {
  return await page.evaluate(
    async ({ dx, dy }) => {
      const fn = (window as any).__testNudgeSelected;
      if (!fn) return false;
      return await fn({ dx, dy });
    },
    { dx, dy }
  );
}

/**
 * Force full validation
 */
export async function forceFullValidation(page: Page): Promise<boolean> {
  const result = await page.evaluate(async () => {
    const fn = (window as any).__testForceFullValidation;
    if (!fn) return { ok: false };
    return await fn();
  });
  return result.ok === true;
}
