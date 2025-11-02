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

/**
 * Retourne les 4 coins d'une pièce rectangulaire après rotation autour de son centre.
 * Ordre: [top-left, top-right, bottom-right, bottom-left] dans le repère local non-roté,
 * puis transformés par la rotation.
 * Format compatible avec PathOps Poly (array de {x,y}).
 */
export function getRotatedCorners(p: Piece): Array<{ x: number; y: number }> {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const rad = ((p.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Coins locaux (relatifs au centre)
  const hw = p.w / 2;
  const hh = p.h / 2;

  const corners = [
    { lx: -hw, ly: -hh }, // top-left
    { lx: +hw, ly: -hh }, // top-right
    { lx: +hw, ly: +hh }, // bottom-right
    { lx: -hw, ly: +hh }, // bottom-left
  ];

  // Rotation et translation vers position globale
  return corners.map(c => ({
    x: cx + c.lx * cos - c.ly * sin,
    y: cy + c.lx * sin + c.ly * cos,
  }));
}

/**
 * Convertit un rectangle (avec rotation optionnelle) en polygone (4 sommets).
 * Utilise getRotatedCorners pour les pièces, ou calcule directement pour des rectangles simples.
 * Retourne les sommets dans le sens horaire.
 */
export function rectToPolygon(rect: { x: number; y: number; w: number; h: number; rot?: number }): Array<{ x: number; y: number }> {
  // Si c'est une pièce, utiliser getRotatedCorners
  if ('id' in rect) {
    return getRotatedCorners(rect as Piece);
  }

  // Sinon, calculer les coins directement
  const rot = rect.rot ?? 0;
  if (rot === 0) {
    // Optimisation pour rotation nulle
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
  }

  // Rotation générale
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = rect.w / 2;
  const hh = rect.h / 2;

  const corners = [
    { lx: -hw, ly: -hh },
    { lx: +hw, ly: -hh },
    { lx: +hw, ly: +hh },
    { lx: -hw, ly: +hh },
  ];

  return corners.map(c => ({
    x: cx + c.lx * cos - c.ly * sin,
    y: cy + c.lx * sin + c.ly * cos,
  }));
}

/**
 * Calcule l'AABB (boîte englobante alignée sur les axes) d'un polygone.
 * Retourne {x, y, w, h} où (x,y) est le coin supérieur gauche.
 */
export function polygonAABB(poly: Array<{ x: number; y: number }>): { x: number; y: number; w: number; h: number } {
  if (poly.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  let minX = poly[0].x;
  let minY = poly[0].y;
  let maxX = poly[0].x;
  let maxY = poly[0].y;

  for (let i = 1; i < poly.length; i++) {
    const p = poly[i];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
