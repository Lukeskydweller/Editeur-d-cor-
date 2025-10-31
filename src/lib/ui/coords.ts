/**
 * Calcule le facteur de conversion pixels → millimètres.
 * @param svgWidthPx Largeur du SVG en pixels (getBoundingClientRect().width)
 * @param viewBoxWidthMm Largeur du viewBox en millimètres
 * @returns Facteur de conversion (mm/px)
 */
export function pxToMmFactor(svgWidthPx: number, viewBoxWidthMm: number): number {
  if (!isFinite(svgWidthPx) || !isFinite(viewBoxWidthMm) || svgWidthPx <= 0 || viewBoxWidthMm <= 0) return 1;
  return viewBoxWidthMm / svgWidthPx;
}
