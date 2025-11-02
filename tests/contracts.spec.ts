import { describe, it, expect } from "vitest";
import { minScene } from "../src/core/examples/minScene";

describe("contracts: SceneV1 round-trip", () => {
  it("produces a stable minimal scene JSON", () => {
    const json = JSON.stringify(minScene);
    const parsed = JSON.parse(json);
    expect(parsed.v).toBe(1);
    expect(parsed.units).toBe("mm");
    expect(Array.isArray(parsed.pieces)).toBe(true);
    expect(parsed.pieces[0].kind).toBe("rect");
  });
});
