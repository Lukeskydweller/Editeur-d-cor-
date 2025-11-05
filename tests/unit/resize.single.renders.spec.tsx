import { describe, test, expect, beforeEach } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: verifies that single-piece resize validation uses EPS_UI_MM throttling
 *
 * CONTEXT: After implementing EPS_UI_MM throttling (0.3mm), validation should only
 * trigger when cursor moves ≥ epsilon, preventing excessive validation calls.
 */
describe('Single-piece resize: EPS throttling', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
  });

  test('_lastResizeValidateMm updated when cursor moves ≥ EPS_UI_MM (0.3mm)', async () => {
    const store = useSceneStore.getState();

    // Insert single piece
    const id = await store.insertRect({ w: 50, h: 50, x: 100, y: 100 });

    // Start resize
    store.selectPiece(id);
    store.startResize(id, 'e', { x: 150, y: 125 });

    // Initially no validation happened yet
    let resizingState = useSceneStore.getState().ui.resizing;
    expect(resizingState?._lastResizeValidateMm).toBeUndefined();

    // Move cursor by 1mm (≥ 0.3mm) - SHOULD trigger validation
    store.updateResize({ x: 151, y: 125 });
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow async validation

    // Check that _lastResizeValidateMm WAS updated
    resizingState = useSceneStore.getState().ui.resizing;
    expect(resizingState?._lastResizeValidateMm).toBeDefined();
    expect(resizingState?._lastResizeValidateMm?.x).toBeCloseTo(151, 1);

    // End resize
    store.endResize(true);

    // Verify _lastResizeValidateMm cleared after resize ends
    expect(useSceneStore.getState().ui.resizing).toBeUndefined();
  });

  test('validation skipped when cursor moves < EPS_UI_MM (0.3mm)', async () => {
    const store = useSceneStore.getState();

    const id = await store.insertRect({ w: 50, h: 50, x: 100, y: 100 });

    store.selectPiece(id);
    store.startResize(id, 'e', { x: 150, y: 125 });

    // Move cursor by 1mm to trigger first validation
    store.updateResize({ x: 151, y: 125 });
    await new Promise(resolve => setTimeout(resolve, 50));

    const lastValidate1 = useSceneStore.getState().ui.resizing?._lastResizeValidateMm;
    expect(lastValidate1).toBeDefined();

    // Move cursor by 0.2mm (< 0.3mm) - should NOT trigger validation
    store.updateResize({ x: 151.2, y: 125 });
    await new Promise(resolve => setTimeout(resolve, 50));

    const lastValidate2 = useSceneStore.getState().ui.resizing?._lastResizeValidateMm;
    // _lastResizeValidateMm should still be at 151 (not updated)
    expect(lastValidate2?.x).toBeCloseTo(151, 1);

    store.endResize(true);
  });

  test('validation throttle resets between separate resize operations', async () => {
    const store = useSceneStore.getState();

    const id = await store.insertRect({ w: 50, h: 50, x: 100, y: 100 });

    // First resize operation
    store.selectPiece(id);
    store.startResize(id, 'e', { x: 150, y: 125 });
    store.updateResize({ x: 151, y: 125 }); // Trigger validation (≥ EPS)
    await new Promise(resolve => setTimeout(resolve, 50));

    const lastValidate1 = useSceneStore.getState().ui.resizing?._lastResizeValidateMm;
    expect(lastValidate1).toBeDefined();

    store.endResize(true);

    // Second resize operation - throttle should be reset
    store.startResize(id, 'e', { x: 160, y: 125 });

    const resizingAfterBegin = useSceneStore.getState().ui.resizing;
    expect(resizingAfterBegin?._lastResizeValidateMm).toBeUndefined(); // Reset confirmed

    store.updateResize({ x: 161, y: 125 }); // Trigger validation again
    await new Promise(resolve => setTimeout(resolve, 50));

    const lastValidate2 = useSceneStore.getState().ui.resizing?._lastResizeValidateMm;
    expect(lastValidate2).toBeDefined();
    expect(lastValidate2?.x).toBeCloseTo(161, 1);

    store.endResize(true);
  });
});
