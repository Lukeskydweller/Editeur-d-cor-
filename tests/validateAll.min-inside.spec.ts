import { describe, it, expect } from "vitest";
import { validateAll } from "../src/core/geo/validateAll";
import { rebuildIndex } from "../src/core/spatial/rbushIndex";
import type { SceneV1, Piece } from "../src/core/contracts/scene";

// Helper to build a minimal valid scene
function buildScene(options?: { width?: number; height?: number }): SceneV1 {
  return {
    v: 1,
    units: "mm",
    width: options?.width ?? 600,
    height: options?.height ?? 600,
    layers: [{ id: "L1", name: "Layer 1", index: 0 }],
    materials: [{ id: "M1", name: "Material 1", directional: false }],
    pieces: [],
  };
}

// Helper to add a piece to the scene
function addPiece(scene: SceneV1, params: Partial<Piece> & { id: string }): void {
  const piece: Piece = {
    id: params.id,
    kind: "rect",
    x: params.x ?? 10,
    y: params.y ?? 10,
    w: params.w ?? 100,
    h: params.h ?? 50,
    rot: params.rot ?? 0,
    layerId: params.layerId ?? scene.layers[0]?.id ?? "L1",
    materialId: params.materialId ?? scene.materials[0]?.id ?? "M1",
  };
  scene.pieces.push(piece);
}

describe("validateAll — inside_scene & min_size", () => {
  it("flags outside_scene when AABB goes out of bounds (right edge)", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // Piece at (580,10) with 40×40 → right edge at 620 > 600
    addPiece(scene, { id: "p1", x: 580, y: 10, w: 40, h: 40, rot: 0 });

    const problems = validateAll(scene);
    const outsideProblems = problems.filter(p => p.code === "outside_scene");

    expect(outsideProblems.length).toBe(1);
    expect(outsideProblems[0].pieceId).toBe("p1");
    expect(outsideProblems[0].severity).toBe("BLOCK");
  });

  it("flags outside_scene when AABB goes out of bounds (bottom edge)", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // Piece at (10,580) with 40×40 → bottom edge at 620 > 600
    addPiece(scene, { id: "p2", x: 10, y: 580, w: 40, h: 40, rot: 0 });

    const problems = validateAll(scene);
    const outsideProblems = problems.filter(p => p.code === "outside_scene");

    expect(outsideProblems.length).toBe(1);
    expect(outsideProblems[0].pieceId).toBe("p2");
  });

  it("flags outside_scene when rotated AABB goes out of bounds", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // Piece at (580,10) with 20×60 rotated 90° → AABB 60×20, right edge at 640 > 600
    addPiece(scene, { id: "p3", x: 580, y: 10, w: 20, h: 60, rot: 90 });

    const problems = validateAll(scene);
    const outsideProblems = problems.filter(p => p.code === "outside_scene");

    expect(outsideProblems.length).toBe(1);
    expect(outsideProblems[0].pieceId).toBe("p3");
  });

  it("does not flag outside_scene when piece is fully inside", () => {
    const scene = buildScene({ width: 600, height: 600 });
    addPiece(scene, { id: "p4", x: 100, y: 100, w: 40, h: 40, rot: 0 });

    const problems = validateAll(scene);
    const outsideProblems = problems.filter(p => p.code === "outside_scene");

    expect(outsideProblems.length).toBe(0);
  });

  it("flags min_size_violation when w < 5mm", () => {
    const scene = buildScene({ width: 600, height: 600 });
    addPiece(scene, { id: "p5", x: 10, y: 10, w: 4, h: 20, rot: 0 });

    const problems = validateAll(scene);
    const minSizeProblems = problems.filter(p => p.code === "min_size_violation");

    expect(minSizeProblems.length).toBe(1);
    expect(minSizeProblems[0].pieceId).toBe("p5");
    expect(minSizeProblems[0].severity).toBe("BLOCK");
    expect(minSizeProblems[0].message).toContain("w=4.0 mm");
  });

  it("flags min_size_violation when h < 5mm", () => {
    const scene = buildScene({ width: 600, height: 600 });
    addPiece(scene, { id: "p6", x: 10, y: 10, w: 20, h: 3, rot: 0 });

    const problems = validateAll(scene);
    const minSizeProblems = problems.filter(p => p.code === "min_size_violation");

    expect(minSizeProblems.length).toBe(1);
    expect(minSizeProblems[0].pieceId).toBe("p6");
    expect(minSizeProblems[0].message).toContain("h=3.0 mm");
  });

  it("does not flag min_size_violation when w and h >= 5mm", () => {
    const scene = buildScene({ width: 600, height: 600 });
    addPiece(scene, { id: "p7", x: 10, y: 10, w: 5, h: 5, rot: 0 });

    const problems = validateAll(scene);
    const minSizeProblems = problems.filter(p => p.code === "min_size_violation");

    expect(minSizeProblems.length).toBe(0);
  });

  it("can detect multiple problem types simultaneously", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // Piece outside scene
    addPiece(scene, { id: "p8", x: 580, y: 10, w: 40, h: 40, rot: 0 });
    // Piece too small
    addPiece(scene, { id: "p9", x: 10, y: 10, w: 3, h: 20, rot: 0 });

    const problems = validateAll(scene);

    expect(problems.length).toBeGreaterThanOrEqual(2);
    expect(problems.some(p => p.code === "outside_scene" && p.pieceId === "p8")).toBe(true);
    expect(problems.some(p => p.code === "min_size_violation" && p.pieceId === "p9")).toBe(true);
  });

  it("preserves overlap_same_layer detection (no regression)", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // Two overlapping pieces on same layer
    addPiece(scene, { id: "p10", x: 100, y: 100, w: 50, h: 50, rot: 0 });
    addPiece(scene, { id: "p11", x: 120, y: 120, w: 50, h: 50, rot: 0 });

    // Rebuild spatial index for collision detection
    rebuildIndex(scene);

    const problems = validateAll(scene);
    const overlapProblems = problems.filter(p => p.code === "overlap_same_layer");

    expect(overlapProblems.length).toBeGreaterThan(0);
  });

  it("does NOT flag outside_scene for a piece exactly at the right/bottom edge (within EPS)", () => {
    const scene = buildScene({ width: 600, height: 600 });
    // AABB touche exactement les bords droit et bas (x=560, y=560, w=40, h=40 → right=600, bottom=600)
    addPiece(scene, { id: "p12", x: 560, y: 560, w: 40, h: 40, rot: 0 });

    const problems = validateAll(scene);
    const outsideProblems = problems.filter(p => p.code === "outside_scene" && p.pieceId === "p12");

    expect(outsideProblems.length).toBe(0);
  });
});
