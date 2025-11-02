export type BBox = { id: string; minX: number; minY: number; maxX: number; maxY: number };

export interface SpatialIndex {
  upsert(id: string, rect: { x: number; y: number; w: number; h: number }): void;
  remove(id: string): void;
  neighbors(
    rect: { x: number; y: number; w: number; h: number },
    opts?: { excludeId?: string; excludeIdSet?: Set<string> }
  ): string[];
  stats(): { items: number; rebuilds: number; lastRebuildMs: number };
}

export function createSpatialIndex(): SpatialIndex {
  const items = new Map<string, BBox>();
  let tree: BBox[] | null = null;
  let dirty = false;
  let dirtyCount = 0;
  let rebuilds = 0;
  let lastRebuildMs = 0;
  let debounceTimer: any = null;

  function toBBox(id: string, r: { x: number; y: number; w: number; h: number }): BBox {
    return { id, minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h };
  }

  function scheduleRebuild() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      ensureTree(true);
      debounceTimer = null;
    }, 50);
  }

  function ensureTree(force = false) {
    if (tree && !dirty && !force) return;
    const t0 = performance.now();
    tree = Array.from(items.values()); // simple array; remplaçable par RBush plus tard
    rebuilds++;
    lastRebuildMs = performance.now() - t0;
    dirty = false;
    dirtyCount = 0;
  }

  function intersects(a: BBox, b: BBox) {
    return !(a.minX > b.maxX || a.maxX < b.minX || a.minY > b.maxY || a.maxY < b.minY);
  }

  return {
    upsert(id, r) {
      items.set(id, toBBox(id, r));
      dirty = true;
      if (++dirtyCount > 20) ensureTree();
      else scheduleRebuild();
    },
    remove(id) {
      items.delete(id);
      dirty = true;
      if (++dirtyCount > 20) ensureTree();
      else scheduleRebuild();
    },
    neighbors(r, opts) {
      ensureTree();
      const q = toBBox('q', r);
      const ex1 = opts?.excludeId;
      const exSet = opts?.excludeIdSet;
      const out: string[] = [];
      for (const n of tree as BBox[]) {
        if (n.id === ex1) continue;
        if (exSet && exSet.has(n.id)) continue;
        if (intersects(n, q)) out.push(n.id);
      }
      return out;
    },
    stats() {
      return { items: items.size, rebuilds, lastRebuildMs };
    },
  };
}
