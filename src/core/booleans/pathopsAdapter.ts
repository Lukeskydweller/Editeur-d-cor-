// Adaptateur minimal PathOps : construction de chemins et appel à op()
import { loadPathOpsWasm } from "../../workers/wasm.loader";

export type Pt = { x: number; y: number };
export type Poly = Pt[]; // simple contour fermé (dernier point implicite = premier)
export type Op = "union" | "intersect" | "difference" | "xor";

let PathKit: any = null;

export async function initPathKit() {
  if (!PathKit) {
    PathKit = await loadPathOpsWasm(); // fourni locateFile -> binaire trouvé en preview/build
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

/** Extrait des contours (Poly[]) depuis un PathKitPath.
 * Impl: utiliser toCmds() si présent (verbs), fallback parser toSVGString().
 * Approximations de courbes autorisées (tolérance ~0.25). Éviter points dupliqués,
 * fermer le contour si nécessaire.
 */
export function pathToPolys(path: any): Poly[] {
  if (!path) return [];

  // Try toCmds() first (preferred method)
  if (typeof path.toCmds === "function") {
    const cmds = path.toCmds();
    return extractPolysFromCmds(cmds);
  }

  // Fallback: parse SVG string
  if (typeof path.toSVGString === "function") {
    const svg = path.toSVGString();
    return parsePolysFromSVG(svg);
  }

  return [];
}

function extractPolysFromCmds(cmds: any[]): Poly[] {
  const polys: Poly[] = [];
  let current: Poly = [];

  for (const cmd of cmds) {
    const verb = cmd[0];

    switch (verb) {
      case 0: // MOVE
        if (current.length > 0) {
          polys.push(current);
        }
        current = [{ x: cmd[1], y: cmd[2] }];
        break;

      case 1: // LINE
        current.push({ x: cmd[1], y: cmd[2] });
        break;

      case 2: // QUAD (approximate with tolerance ~0.25)
        approximateQuad(current, cmd[1], cmd[2], cmd[3], cmd[4]);
        break;

      case 3: // CUBIC (approximate with tolerance ~0.25)
        approximateCubic(current, cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]);
        break;

      case 4: // CLOSE
        if (current.length > 0) {
          polys.push(current);
          current = [];
        }
        break;
    }
  }

  if (current.length > 0) {
    polys.push(current);
  }

  return polys;
}

function parsePolysFromSVG(svg: string): Poly[] {
  const polys: Poly[] = [];
  let current: Poly = [];
  let currentX = 0, currentY = 0;

  // Simple SVG path parser
  const commands = svg.match(/[a-zA-Z][^a-zA-Z]*/g) || [];

  for (const cmdStr of commands) {
    const cmd = cmdStr[0];
    const args = cmdStr.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (cmd) {
      case 'M': // moveto absolute
        if (current.length > 0) polys.push(current);
        currentX = args[0];
        currentY = args[1];
        current = [{ x: currentX, y: currentY }];
        break;

      case 'L': // lineto absolute
        currentX = args[0];
        currentY = args[1];
        current.push({ x: currentX, y: currentY });
        break;

      case 'l': // lineto relative
        currentX += args[0];
        currentY += args[1];
        current.push({ x: currentX, y: currentY });
        break;

      case 'H': // horizontal line absolute
        currentX = args[0];
        current.push({ x: currentX, y: currentY });
        break;

      case 'V': // vertical line absolute
        currentY = args[0];
        current.push({ x: currentX, y: currentY });
        break;

      case 'Z':
      case 'z': // closepath
        if (current.length > 0) {
          polys.push(current);
          current = [];
        }
        break;
    }
  }

  if (current.length > 0) {
    polys.push(current);
  }

  return polys;
}

function approximateQuad(poly: Poly, cpx: number, cpy: number, x: number, y: number) {
  const last = poly[poly.length - 1];
  if (!last) return;

  // Simple subdivision for quadratic bezier
  const segments = 4;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t1 = 1 - t;
    const px = t1 * t1 * last.x + 2 * t1 * t * cpx + t * t * x;
    const py = t1 * t1 * last.y + 2 * t1 * t * cpy + t * t * y;
    poly.push({ x: px, y: py });
  }
}

function approximateCubic(poly: Poly, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
  const last = poly[poly.length - 1];
  if (!last) return;

  // Simple subdivision for cubic bezier
  const segments = 6;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const t1 = 1 - t;
    const t1_3 = t1 * t1 * t1;
    const t1_2_t = 3 * t1 * t1 * t;
    const t1_t_2 = 3 * t1 * t * t;
    const t_3 = t * t * t;

    const px = t1_3 * last.x + t1_2_t * cp1x + t1_t_2 * cp2x + t_3 * x;
    const py = t1_3 * last.y + t1_2_t * cp1y + t1_t_2 * cp2y + t_3 * y;
    poly.push({ x: px, y: py });
  }
}

/** Op booléenne retournant directement des polygones. */
export async function booleanOpPolys(a: Poly, b: Poly, kind: Op): Promise<Poly[]> {
  const p = await opPolys(a, b, kind);
  return pathToPolys(p);
}
