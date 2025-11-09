/**
 * Helper to wait for requestAnimationFrame cycles.
 * Useful for allowing async state updates to propagate in tests.
 *
 * @param times - Number of RAF cycles to wait (default: 2)
 */
export async function nextFrame(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise(requestAnimationFrame);
  }
}
