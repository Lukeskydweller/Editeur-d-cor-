import type { Piece } from "../contracts/scene";

/**
 * Retourne l'AABB (Axis-Aligned Bounding Box) en mm d'une pièce potentiellement rotée autour de son centre.
 * Pour une pièce à rotation 0°, retourne la boîte identique à ses dimensions.
 * Pour 90°/270°, les dimensions w et h sont inversées.
 * Pour toute rotation, calcule l'enveloppe rectangulaire minimale alignée sur les axes.
 */
export function getRotatedAABB(p: Piece): { x: number; y: number; w: number; h: number } {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const rad = ((p.rot ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w2 = p.w * cos + p.h * sin;
  const h2 = p.w * sin + p.h * cos;
  return { x: cx - w2 / 2, y: cy - h2 / 2, w: w2, h: h2 };
}
