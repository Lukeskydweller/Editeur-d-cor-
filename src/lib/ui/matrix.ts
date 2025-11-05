/**
 * 2D transformation matrix utilities for SVG transforms
 * Matrix format: { a, b, c, d, e, f } represents:
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 */

export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Create identity matrix
 */
export function identityMatrix(): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/**
 * Create translation matrix
 */
export function translateMatrix(tx: number, ty: number): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

/**
 * Create scale matrix
 */
export function scaleMatrix(sx: number, sy: number): Matrix2D {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

/**
 * Create rotation matrix (angle in degrees)
 */
export function rotateMatrix(angleDeg: number): Matrix2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

/**
 * Multiply two matrices: result = m1 * m2
 */
export function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

/**
 * Create a scale matrix about a specific pivot point
 * Equivalent to: translate(pivot) * scale(sx, sy) * translate(-pivot)
 */
export function makeScaleAboutPivot(
  pivot: { x: number; y: number },
  scale: number
): Matrix2D {
  // T(pivot) * S(scale) * T(-pivot)
  const t1 = translateMatrix(pivot.x, pivot.y);
  const s = scaleMatrix(scale, scale);
  const t2 = translateMatrix(-pivot.x, -pivot.y);

  // Multiply: t1 * s * t2
  const temp = multiplyMatrices(s, t2);
  return multiplyMatrices(t1, temp);
}

/**
 * Format matrix for SVG transform attribute
 */
export function matrixToSvgTransform(m: Matrix2D): string {
  return `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
}

/**
 * Apply matrix transformation to a point
 */
export function transformPoint(m: Matrix2D, p: { x: number; y: number }): { x: number; y: number } {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  };
}
