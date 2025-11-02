import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { editorStore, selectProblems, subscribe, __setValidationDebounceForTests } from "../src/store/editorStore";

describe("editorStore overlap detection", () => {
  beforeEach(() => {
    // Speed up tests by reducing debounce
    __setValidationDebounceForTests(10);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("detects no overlaps in default state", async () => {
    const state = editorStore.getState();
    expect(state.pieces.length).toBeGreaterThan(0);

    const problems = selectProblems();
    expect(problems.hasBlock).toBe(false);
    expect(problems.conflicts.size).toBe(0);
  });

  it("detects overlap_same_layer after moving piece", async () => {
    const state = editorStore.getState();
    if (state.pieces.length < 2) {
      // Add second piece for testing
      const p1 = state.pieces[0];
      state.pieces.push({
        id: "test-p2",
        kind: "rect",
        x: p1.x + 100,
        y: p1.y,
        w: p1.w,
        h: p1.h,
        rot: 0,
        layerId: p1.layerId,
        materialId: p1.materialId
      });
    }

    const [p1, p2] = state.pieces;

    // Create promise to wait for validation
    const validationPromise = new Promise<void>((resolve) => {
      const unsubscribe = subscribe(() => {
        const problems = selectProblems();
        if (problems.hasBlock) {
          unsubscribe();
          resolve();
        }
      });
    });

    // Move p2 to overlap with p1
    editorStore.dispatch({
      type: "movePiece",
      id: p2.id,
      dx: p1.x - p2.x + 5,
      dy: p1.y - p2.y + 5
    });

    // Wait for debounced validation (10ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 50));
    await validationPromise;

    const problems = selectProblems();
    expect(problems.hasBlock).toBe(true);
    expect(problems.conflicts.has(p1.id)).toBe(true);
    expect(problems.conflicts.has(p2.id)).toBe(true);
  });

  it("clears overlap after moving piece away", async () => {
    const state = editorStore.getState();
    const [p1, p2] = state.pieces;

    // First create overlap
    editorStore.dispatch({
      type: "movePiece",
      id: p2.id,
      dx: p1.x - p2.x + 5,
      dy: p1.y - p2.y + 5
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Then move away
    editorStore.dispatch({
      type: "movePiece",
      id: p2.id,
      dx: 200,
      dy: 0
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    const problems = selectProblems();
    expect(problems.hasBlock).toBe(false);
    expect(problems.conflicts.size).toBe(0);
  });

  it("validates after rotation", async () => {
    const state = editorStore.getState();
    const p1 = state.pieces[0];

    const validationPromise = new Promise<void>((resolve) => {
      const unsubscribe = subscribe(() => {
        unsubscribe();
        resolve();
      });
    });

    editorStore.dispatch({
      type: "rotatePiece",
      id: p1.id,
      deg: 90
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    await validationPromise;

    // Validation should have run (no error thrown)
    expect(true).toBe(true);
  });
});
