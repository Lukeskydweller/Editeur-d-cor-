/**
 * Constantes de validation pour l'espacement et le collage
 */

// Maximum number of layers allowed in the scene
export const MAX_LAYERS = 3;

// Seuil minimal d'espacement et de collage automatique (mm)
export const MIN_GAP_MM = 1.0;

// Seuil pour le collage automatique bord-à-bord (identique à MIN_GAP_MM)
export const SNAP_EDGE_THRESHOLD_MM = 1.0;

// Seuil de pré-collage : smart nudge clavier si gap dans (MIN_GAP_MM ; PRECOLLAGE_MM]
export const PRECOLLAGE_MM = 5.0;

// Seuil de warning pour espacement (mm) - WARN si MIN_GAP_MM <= distance < SPACING_WARN_MM
export const SPACING_WARN_MM = 1.5;

// Seuil d'affichage du tooltip de gap (mm)
export const TOOLTIP_GAP_MAX_MM = 10.0;

// Normalisation du gap à 1.00 mm dans la fenêtre [1.00 ; 1.00+ε]
/** Cible de normalisation pour le gap (mm) */
export const NORMALIZE_GAP_TARGET_MM = 1.0;

/** Fenêtre epsilon pour la normalisation (~0.10-0.15 mm recommandé) */
export const EPSILON_GAP_NORMALIZE_MM =
  Number(import.meta.env.VITE_UI_EPSILON_GAP_NORMALIZE_MM ?? 0.12);

/** Activation de la normalisation du gap (ON par défaut) */
export const ENABLE_GAP_NORMALIZATION =
  (import.meta.env.VITE_UI_NORMALIZE_GAP ?? 'true').toLowerCase() === 'true';

/** Seuil epsilon pour l'affichage "Bord à bord" dans le tooltip */
export const EPS_NORM_MM = Number(import.meta.env.VITE_UI_EPSILON_GAP_NORMALIZE_MM ?? 0.12);

/** Seuil epsilon pour l'affichage "1.00 mm" (précision d'affichage) */
// Passe à 0.02 mm pour rendre 10.00 & 7.00 mm robustes (inclusifs)
export const EPS_UI_MM = 0.02;

// Helpers de comparaison UI (centralisés pour éviter les divergences)
export const uiLE = (a: number, b: number, eps: number = EPS_UI_MM) => a <= b + eps;
export const uiNEAR = (a: number, b: number, eps: number = EPS_UI_MM) => Math.abs(a - b) <= eps;

// Conversion DPI standard
export const DPI = 96;
export const MM_PER_INCH = 25.4;
export const MM_TO_PX = DPI / MM_PER_INCH; // ≈ 3.78
export const PX_TO_MM = MM_PER_INCH / DPI; // ≈ 0.265
