import type { SceneDraft, Piece, ID } from '@/types/scene';
import { pieceBBox, rectsOverlap, bboxInsideRect } from '@/lib/geom';

/**
 * Vérifie si une pièce est entièrement contenue dans les limites de la scène.
 */
export function isInsideScene(piece: Piece, scene: SceneDraft): boolean {
  const bbox = pieceBBox(piece);
  return bboxInsideRect(bbox, scene.size.w, scene.size.h);
}

/**
 * Valide qu'aucune pièce ne chevauche une autre.
 * Retourne { ok: true } si aucun conflit, sinon { ok: false, conflicts: [...] }.
 */
export function validateNoOverlap(scene: SceneDraft): {
  ok: boolean;
  conflicts: Array<[ID, ID]>;
} {
  const pieces = Object.values(scene.pieces);
  const conflicts: Array<[ID, ID]> = [];

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const bboxA = pieceBBox(pieces[i]);
      const bboxB = pieceBBox(pieces[j]);
      if (rectsOverlap(bboxA, bboxB)) {
        conflicts.push([pieces[i].id, pieces[j].id]);
      }
    }
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Valide que toutes les pièces sont contenues dans la scène.
 * Retourne { ok: true } si toutes OK, sinon { ok: false, outside: [...] }.
 */
export function validateInsideScene(scene: SceneDraft): {
  ok: boolean;
  outside: Array<ID>;
} {
  const outside = Object.values(scene.pieces)
    .filter((p) => !isInsideScene(p, scene))
    .map((p) => p.id);

  return {
    ok: outside.length === 0,
    outside,
  };
}

/**
 * Valide que les pièces utilisant un matériau orienté sont alignées avec l'orientation du matériau.
 * Retourne des warnings (non bloquants) pour les pièces mal alignées.
 */
export function validateMaterialOrientation(scene: SceneDraft): {
  ok: boolean;
  warnings: Array<{ pieceId: ID; materialId: ID; expectedDeg: number; actualDeg: number }>;
} {
  const warnings: Array<{ pieceId: ID; materialId: ID; expectedDeg: number; actualDeg: number }> = [];

  for (const p of Object.values(scene.pieces)) {
    const m = scene.materials[p.materialId];
    if (!m) continue;
    if (m.oriented) {
      // congruence à 180° : 0 ≡ 180, 90 ≡ 270
      const expected = (m.orientationDeg ?? 0) % 180;
      const actual = (p.rotationDeg ?? 0) % 180;
      if (expected !== actual) {
        warnings.push({ pieceId: p.id, materialId: m.id, expectedDeg: expected, actualDeg: actual });
      }
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}
