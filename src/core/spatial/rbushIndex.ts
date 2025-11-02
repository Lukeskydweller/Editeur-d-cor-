import RBush from "rbush";
import { SceneV1, Piece } from "../contracts/scene";

type Node = { minX: number; minY: number; maxX: number; maxY: number; id: string };

let tree: RBush<Node> | null = null;
let ref: SceneV1 | null = null;
const nodes = new Map<string, Node>();

function bboxOf(p: Piece): Node {
  const x = p.x, y = p.y, w = p.w, h = p.h;
  // Rotations 0/90/180/270 → AABB identique (coords éditeur déjà AABB)
  return { minX: x, minY: y, maxX: x + w, maxY: y + h, id: p.id };
}

export function rebuildIndex(scene: SceneV1): void {
  ref = scene;
  tree = new RBush<Node>();
  nodes.clear();
  const items: Node[] = scene.pieces.map(bboxOf);
  items.forEach(n => nodes.set(n.id, n));
  tree.load(items);
}

export function updatePiece(id: string): void {
  if (!tree || !ref) return;
  const old = nodes.get(id);
  if (old) tree.remove(old, (a,b)=>a.id===b.id);
  const p = ref.pieces.find(pp => pp.id === id);
  if (!p) { nodes.delete(id); return; }
  const nn = bboxOf(p);
  nodes.set(id, nn);
  tree.insert(nn);
}

export function queryBBox(b: {minX:number; minY:number; maxX:number; maxY:number}): string[] {
  if (!tree) return [];
  return tree.search(b).map(n => n.id);
}

export function neighborsForPiece(id: string, margin: number, limit = 16): string[] {
  if (!tree || !ref) return [];
  const n = nodes.get(id); if (!n) return [];
  const box = {
    minX: n.minX - margin,
    minY: n.minY - margin,
    maxX: n.maxX + margin,
    maxY: n.maxY + margin
  };
  const ids = tree.search(box).map(n => n.id).filter(other => other !== id);
  return ids.slice(0, limit);
}
