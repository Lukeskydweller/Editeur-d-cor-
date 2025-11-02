import { SceneV1 } from "../contracts/scene";

export const minScene: SceneV1 = {
  v: 1,
  units: "mm",
  width: 600,
  height: 600,
  layers: [{ id: "C1", name: "C1", index: 0 }],
  materials: [{ id: "mat1", name: "Mat A", directional: false }],
  pieces: [{
    id: "p1", kind: "rect",
    x: 100, y: 100, w: 120, h: 80, rot: 0,
    layerId: "C1", materialId: "mat1",
    constraints: {}
  }],
  problems: []
};
