import { describe, it, expect } from "vitest";
import { minScene } from "../src/core/examples/minScene";
import { init, rebuildIndex, collisionsForPieceAsync } from "../src/core/geo/facade";

describe("geo facade (fallback sync in Vitest)", () => {
  it("rebuilds and returns collisions via async API (fallback path)", async () => {
    const scene = structuredClone(minScene);
    scene.pieces.push({ id:"p2", kind:"rect", x:210,y:110,w:40,h:40, rot:0, layerId:"C1", materialId:"mat1" });
    await init(scene); // fallback rebuild
    // collisions p1 ↔ p2
    const hits = await collisionsForPieceAsync(scene, "p1", 0);
    expect(hits).toContain("p2");
  });
});
