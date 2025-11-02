// Adaptateur minimal PathOps : construction de chemins et appel à op()
import PathKitInit from "pathkit-wasm";

export type Pt = { x: number; y: number };
export type Poly = Pt[]; // simple contour fermé (dernier point implicite = premier)
export type Op = "union" | "intersect" | "difference" | "xor";

let PathKit: any = null;

export async function initPathKit() {
  if (!PathKit) {
    PathKit = await PathKitInit();
  }
  return PathKit;
}

export function polyToPath(poly: Poly, pathKit: any) {
  if (!poly.length) throw new Error("empty poly");
  const p = pathKit.NewPath();
  p.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) p.lineTo(poly[i].x, poly[i].y);
  p.close();
  return p;
}

const opMap: Record<Op, any> = {
  union: "UNION",
  intersect: "INTERSECT",
  difference: "DIFFERENCE",
  xor: "XOR",
};

export async function opPolys(a: Poly, b: Poly, kind: Op) {
  const pk = await initPathKit();
  const pa = polyToPath(a, pk);
  const pb = polyToPath(b, pk);
  const opType = pk.PathOp[opMap[kind]];
  const out = pk.MakeFromOp(pa, pb, opType);
  return out;
}
