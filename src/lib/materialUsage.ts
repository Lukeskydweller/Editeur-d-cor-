import type { SceneDraft } from '@/types/scene';
import type { Problem } from '@/core/contracts/scene';

export interface MaterialUsage {
  materialId: string;
  materialName: string;
  totalAreaMm2: number;
  sheetAreaMm2: number; // 600*600
  sheets: number;       // ceil(total/sheetArea)
  fillLastPct: number;  // 0..100
  piecesCount: number;
  warnOrientationCount: number; // depuis problems[]
}

/**
 * Calcule l'utilisation de matériau par plaque de 600×600mm.
 * Calcul WYSIWYG simple: aire AABB des pièces, sans kerf/nesting/offset.
 */
export function computeMaterialUsage(draft: SceneDraft, problems: Problem[]): MaterialUsage[] {
  const SHEET = 600 * 600;
  const byMat = new Map<string, { area: number; count: number; name: string }>();

  // Agréger aires par matériau
  for (const pieceId in draft.pieces) {
    const p = draft.pieces[pieceId];
    // Aire AABB (approx) — V1, pas de rotations exactes
    const w = Math.max(0, p.size?.w ?? 0);
    const h = Math.max(0, p.size?.h ?? 0);
    const a = w * h;
    const m = p.materialId;
    if (!m) continue;

    const materialName = draft.materials[m]?.name ?? m;
    const acc = byMat.get(m) ?? { area: 0, count: 0, name: materialName };
    acc.area += a;
    acc.count += 1;
    byMat.set(m, acc);
  }

  // Compter WARN orientation par matériau
  const warnByMat = new Map<string, number>();
  for (const pr of problems) {
    if (pr.code === 'material_orientation_mismatch') {
      // Le materialId peut être dans meta ou pieceId -> material mapping
      let mid: string | undefined = undefined;
      if (pr.meta?.materialId) {
        mid = pr.meta.materialId as string;
      } else if (pr.pieceId) {
        // Retrouver le materialId depuis la pièce
        const piece = draft.pieces[pr.pieceId];
        if (piece) mid = piece.materialId;
      }
      if (mid) {
        warnByMat.set(mid, (warnByMat.get(mid) ?? 0) + 1);
      }
    }
  }

  // Calculer sheets et fill%
  const out: MaterialUsage[] = [];
  for (const [materialId, v] of byMat) {
    const sheets = Math.ceil(v.area / SHEET) || 0;
    const usedOnLast = v.area - (Math.max(0, sheets - 1) * SHEET);
    const fillLastPct = sheets === 0 ? 0 : Math.min(100, Math.max(0, (usedOnLast / SHEET) * 100));

    out.push({
      materialId,
      materialName: v.name,
      totalAreaMm2: v.area,
      sheetAreaMm2: SHEET,
      sheets,
      fillLastPct: Number(fillLastPct.toFixed(1)),
      piecesCount: v.count,
      warnOrientationCount: warnByMat.get(materialId) ?? 0,
    });
  }

  // Tri: plus utilisé en premier
  out.sort((a, b) => b.totalAreaMm2 - a.totalAreaMm2);
  return out;
}
