import type { BBox, Piece, Milli } from '@/types/scene';

/**
 * Calcule la bounding box (AABB) d'une pièce.
 * V1: rotation ignorée, on prend la bbox axis-aligned.
 */
export function pieceBBox(piece: Piece): BBox {
  const { x, y } = piece.position;
  const { w, h } = piece.size;
  return { x, y, w, h };
}

/**
 * Teste si deux rectangles AABB se chevauchent.
 * Retourne true s'il y a intersection (bords touchants = overlap).
 */
export function rectsOverlap(a: BBox, b: BBox): boolean {
  // Pas d'overlap si l'un est complètement à gauche/droite/haut/bas de l'autre
  if (a.x + a.w <= b.x) return false; // a est à gauche de b
  if (b.x + b.w <= a.x) return false; // b est à gauche de a
  if (a.y + a.h <= b.y) return false; // a est au-dessus de b
  if (b.y + b.h <= a.y) return false; // b est au-dessus de a
  return true;
}

/**
 * Teste si une bbox est complètement contenue dans un rectangle [0..w] × [0..h].
 */
export function bboxInsideRect(bbox: BBox, w: Milli, h: Milli): boolean {
  return bbox.x >= 0 && bbox.y >= 0 && bbox.x + bbox.w <= w && bbox.y + bbox.h <= h;
}
