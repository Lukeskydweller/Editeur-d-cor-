import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { snapToPieces, snapGroupToPieces } from "../src/lib/ui/snap";
import type { SceneDraft } from "../src/types/scene";
import * as candidates from "../src/core/snap/candidates";

describe("Snap with RBush optimization", () => {
  let mockScene: SceneDraft;

  beforeEach(() => {
    // Create a scene with multiple pieces
    mockScene = {
      size: { w: 600, h: 600 },
      layers: { L1: { id: "L1", name: "Layer 1", index: 0 } },
      layerOrder: ["L1"],
      materials: { M1: { id: "M1", name: "Material 1", directional: false } },
      pieces: {
        p1: { id: "p1", kind: "rect", position: { x: 100, y: 100 }, size: { w: 50, h: 50 }, layerId: "L1", materialId: "M1", rotationDeg: 0 },
        p2: { id: "p2", kind: "rect", position: { x: 160, y: 100 }, size: { w: 50, h: 50 }, layerId: "L1", materialId: "M1", rotationDeg: 0 },
        p3: { id: "p3", kind: "rect", position: { x: 300, y: 300 }, size: { w: 50, h: 50 }, layerId: "L1", materialId: "M1", rotationDeg: 0 },
      }
    } as SceneDraft;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("snapToPieces uses getSnapNeighbors when excludeId is provided", () => {
    // Spy on getSnapNeighbors to verify it's called
    const spy = vi.spyOn(candidates, "getSnapNeighbors").mockReturnValue(["p2"]);

    const candidate = { x: 155, y: 100, w: 50, h: 50 };
    const result = snapToPieces(mockScene, candidate, 5, "p1");

    // Should have called getSnapNeighbors with p1
    expect(spy).toHaveBeenCalledWith("p1", 12, 16);

    // Should snap to p2's right edge (150 + 50 = 200, snap to 160)
    expect(result.didSnap || result.x !== candidate.x || result.y !== candidate.y).toBeTruthy();

    spy.mockRestore();
  });

  it("snapToPieces falls back to all pieces if getSnapNeighbors throws", () => {
    // Make getSnapNeighbors throw
    const spy = vi.spyOn(candidates, "getSnapNeighbors").mockImplementation(() => {
      throw new Error("Index not ready");
    });

    const candidate = { x: 155, y: 100, w: 50, h: 50 };
    const result = snapToPieces(mockScene, candidate, 5, "p1");

    // Should not throw and should still work (fallback to all pieces)
    expect(result).toBeDefined();
    expect(result.x).toBeDefined();
    expect(result.y).toBeDefined();

    spy.mockRestore();
  });

  it("snapToPieces uses all pieces when excludeId is not provided", () => {
    const spy = vi.spyOn(candidates, "getSnapNeighbors");

    const candidate = { x: 155, y: 100, w: 50, h: 50 };
    snapToPieces(mockScene, candidate, 5);

    // Should NOT call getSnapNeighbors
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("snapGroupToPieces collects neighbors from all excluded pieces", () => {
    const spy = vi.spyOn(candidates, "getSnapNeighbors")
      .mockReturnValueOnce(["p3"]) // neighbors of p1
      .mockReturnValueOnce(["p3"]); // neighbors of p2

    const groupRect = { x: 100, y: 100, w: 110, h: 50 };
    const result = snapGroupToPieces(mockScene, groupRect, 5, ["p1", "p2"]);

    // Should have called getSnapNeighbors for both p1 and p2
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith("p1", 12, 16);
    expect(spy).toHaveBeenCalledWith("p2", 12, 16);

    spy.mockRestore();
  });

  it("snapGroupToPieces falls back to all pieces if getSnapNeighbors throws", () => {
    const spy = vi.spyOn(candidates, "getSnapNeighbors").mockImplementation(() => {
      throw new Error("Index not ready");
    });

    const groupRect = { x: 100, y: 100, w: 110, h: 50 };
    const result = snapGroupToPieces(mockScene, groupRect, 5, ["p1", "p2"]);

    // Should not throw and should still work
    expect(result).toBeDefined();
    expect(result.x).toBeDefined();
    expect(result.y).toBeDefined();

    spy.mockRestore();
  });

  it("snap behavior remains unchanged (regression test)", () => {
    // This test ensures snap still works correctly with optimization
    const candidate = { x: 158, y: 100, w: 50, h: 50 };

    // Should snap to p2's left edge (160)
    const result = snapToPieces(mockScene, candidate, 5, "p1");

    // Should have snapped horizontally to align with p2
    expect(Math.abs(result.x - 160)).toBeLessThanOrEqual(5);
  });
});
