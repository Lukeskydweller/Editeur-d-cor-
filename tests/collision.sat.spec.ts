import { describe, it, expect } from "vitest";
import { minScene } from "../src/core/examples/minScene";
import { rebuildIndex } from "../src/core/spatial/rbushIndex";
import { collisionsForPiece, collideRectRect } from "../src/core/collision/sat";

describe("collision: SAT + RBush prefilter", () => {
  it("detects basic rect/rect overlap", () => {
    expect(collideRectRect({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10})).toBe(true);
    expect(collideRectRect({x:0,y:0,w:10,h:10},{x:20,y:20,w:10,h:10})).toBe(false);
  });

  it("finds colliding neighbors for a piece", () => {
    const scene = structuredClone(minScene);
    // p1 = (100,100,120x80)
    scene.pieces.push({ id:"p2", kind:"rect", x:210, y:110, w:40, h:40, rot:0, layerId:"C1", materialId:"mat1" }); // touche p1 sur le côté
    scene.pieces.push({ id:"p3", kind:"rect", x:400, y:400, w:40, h:40, rot:0, layerId:"C1", materialId:"mat1" }); // loin
    rebuildIndex(scene);
    const hits = collisionsForPiece(scene, "p1", 0);
    expect(hits).toContain("p2");
    expect(hits).not.toContain("p3");
  });
});
