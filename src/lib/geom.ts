import type { BBox, Piece, Milli, ID, SceneDraft } from '@/types/scene';

/**
 * Calcule une version courte concaténée de la géométrie des pièces.
 * Utilisé pour forcer le re-render des overlays quand la géométrie change.
 * @returns Une chaîne contenant id:x,y,w,h,rotation pour chaque pièce
 */
export function piecesVersion(scene: SceneDraft, ids: ID[]): string {
  let s = '';
  for (const id of ids) {
    const p = scene.pieces[id];
    if (!p) continue;
    const b = pieceBBox(p);
    s += `${id}:${b.x},${b.y},${b.w},${b.h},${p.rotationDeg ?? 0}|`;
  }
  return s;
}

/**
 * Calcule la bounding box (AABB) d'une pièce, rotation-aware.
 * - Si rotation est 0° ou 180°: AABB = {x, y, w, h} inchangée
 * - Si rotation est 90° ou 270°: échanger w/h autour du centre visuel
 */
export function pieceBBox(piece: Piece): BBox {
  const { x, y } = piece.position;
  const { w, h } = piece.size;

  // Normalize rotation to 0-359
  const r = ((piece.rotationDeg ?? 0) % 360 + 360) % 360;

  // If rotated 90° or 270°, swap width/height around center
  if (r === 90 || r === 270) {
    const cx = x + w / 2;
    const cy = y + h / 2;

    return {
      x: cx - h / 2,
      y: cy - w / 2,
      w: h,
      h: w,
    };
  }

  // For 0° or 180°, AABB is unchanged
  return { x, y, w, h };
}

/**
 * Convert AABB position back to piece.position
 * Inverse operation of pieceBBox for position only
 *
 * Given an AABB position (aabbX, aabbY) and a piece with its current size/rotation,
 * compute the piece.position that would result in that AABB position.
 */
export function aabbToPiecePosition(
  aabbX: number,
  aabbY: number,
  piece: Piece
): { x: number; y: number } {
  const { w, h } = piece.size;
  const r = ((piece.rotationDeg ?? 0) % 360 + 360) % 360;

  // If rotated 90° or 270°, need to reverse the swap
  if (r === 90 || r === 270) {
    // AABB center = (aabbX + h/2, aabbY + w/2)  [note: h and w swapped]
    // piece.position = AABB center - (w/2, h/2)
    const cx = aabbX + h / 2;
    const cy = aabbY + w / 2;
    return {
      x: cx - w / 2,
      y: cy - h / 2,
    };
  }

  // For 0° or 180°, AABB position = piece.position
  return { x: aabbX, y: aabbY };
}

// Tolérance flottante pour les comparaisons AABB (en millimètres)
const EPS_MM = 0.01;

function le(a: number, b: number) { return a <= b + EPS_MM; }

/**
 * Teste si deux rectangles AABB se chevauchent.
 * Retourne true s'il y a intersection (bords touchants = overlap).
 * Avec tolérance EPS pour éviter des faux positifs sur micro-gaps.
 */
export function rectsOverlap(a: BBox, b: BBox): boolean {
  // Pas d'overlap si l'un est complètement à gauche/droite/haut/bas de l'autre
  if (le(a.x + a.w, b.x)) return false; // a est à gauche de b
  if (le(b.x + b.w, a.x)) return false; // b est à gauche de a
  if (le(a.y + a.h, b.y)) return false; // a est au-dessus de b
  if (le(b.y + b.h, a.y)) return false; // b est au-dessus de a
  return true;
}

/**
 * Teste si une bbox est complètement contenue dans un rectangle [0..w] × [0..h].
 */
export function bboxInsideRect(bbox: BBox, w: Milli, h: Milli): boolean {
  return bbox.x >= 0 && bbox.y >= 0 && bbox.x + bbox.w <= w && bbox.y + bbox.h <= h;
}
