import { describe, it, expect } from "vitest";
import { minScene } from "../src/core/examples/minScene";
import { rebuildIndex, queryBBox, neighborsForPiece } from "../src/core/spatial/rbushIndex";

describe("rbush index", () => {
  it("builds and queries bbox", () => {
    const scene = structuredClone(minScene);
    scene.pieces.push({ id:"p2", kind:"rect", x:300,y:300,w:50,h:50, rot:0, layerId:"C1", materialId:"mat1" });
    rebuildIndex(scene);
    const ids = queryBBox({ minX:295, minY:295, maxX:360, maxY:360 });
    expect(ids.includes("p2")).toBe(true);
  });

  it("returns neighbors around a piece", () => {
    const scene = structuredClone(minScene);
    scene.pieces.push({ id:"p2", kind:"rect", x:210,y:110,w:40,h:40, rot:0, layerId:"C1", materialId:"mat1" });
    rebuildIndex(scene);
    const n = neighborsForPiece("p1", 30, 8);
    expect(n).toContain("p2");
  });
});
