/**
 * Helpers pour transformations géométriques en repère local
 * Utilisé pour le resize des pièces rotées (pivot = centre)
 */

export interface LocalFrame {
  cx: number;  // centre x en monde
  cy: number;  // centre y en monde
  cos: number; // cos(rotation)
  sin: number; // sin(rotation)
}

/**
 * Crée un repère local pour une pièce rectangulaire
 * @param x Position x en monde
 * @param y Position y en monde
 * @param w Largeur
 * @param h Hauteur
 * @param rotationDeg Rotation en degrés
 */
export function makeLocalFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg = 0
): LocalFrame {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  return {
    cx,
    cy,
    cos: Math.cos(rad),
    sin: Math.sin(rad),
  };
}

/**
 * Convertit un delta monde (dx, dy) en delta repère local (lx, ly)
 * Rotation matrix inverse: local = R^-1 * world
 * @param dx Delta x en monde
 * @param dy Delta y en monde
 * @param f Repère local
 */
export function worldDeltaToLocal(
  dx: number,
  dy: number,
  f: LocalFrame
): { lx: number; ly: number } {
  return {
    lx: dx * f.cos + dy * f.sin,
    ly: -dx * f.sin + dy * f.cos,
  };
}

/**
 * Applique un resize dans le repère local
 * @param w Largeur actuelle
 * @param h Hauteur actuelle
 * @param handle Handle cardinal ('N'|'S'|'E'|'W')
 * @param dl Delta en repère local
 */
export function applyLocalResize(
  w: number,
  h: number,
  handle: 'N' | 'S' | 'E' | 'W',
  dl: { lx: number; ly: number }
): { w: number; h: number } {
  switch (handle) {
    case 'E':
      return { w: w + dl.lx, h };
    case 'W':
      return { w: w - dl.lx, h };
    case 'N':
      return { w, h: h - dl.ly };
    case 'S':
      return { w, h: h + dl.ly };
  }
}
