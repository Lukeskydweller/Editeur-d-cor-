/**
 * Wait for exact support calculation to complete in tests.
 *
 * recalculateExactSupport() runs PathOps validation asynchronously.
 * Tests that assert ui.exactSupportResults immediately after drag/resize
 * may need to await this helper to ensure validation has completed.
 *
 * @param ms - Milliseconds to wait (default 100ms, increase if flaky)
 */
export async function waitExact(ms = 100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
