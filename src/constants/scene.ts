/**
 * Constantes de scène : tailles, grille, seuils de snap
 */

import { DPI, MM_PER_INCH, MM_TO_PX, PX_TO_MM } from './validation';

// ==================== TAILLE DE LA SCÈNE ====================
/**
 * Largeur de la scène en pixels (rendu SVG)
 * Correspond à 600mm × (96 DPI / 25.4) ≈ 2267.7px
 * En pratique : 600px dans le viewport (facteur d'échelle 1:1 simplifié)
 */
export const SCENE_WIDTH_PX = 600;

/**
 * Hauteur de la scène en pixels (rendu SVG)
 */
export const SCENE_HEIGHT_PX = 600;

/**
 * Largeur de la scène en millimètres (dimensions réelles)
 */
export const SCENE_WIDTH_MM = 600;

/**
 * Hauteur de la scène en millimètres (dimensions réelles)
 */
export const SCENE_HEIGHT_MM = 600;

// ==================== GRILLE ====================
/**
 * Pas de la grille mineure (mm)
 * Utilisé pour les lignes fines de la grille visuelle
 */
export const GRID_MINOR_MM = 10;

/**
 * Pas de la grille majeure (mm)
 * Utilisé pour les lignes épaisses de la grille visuelle
 */
export const GRID_MAJOR_MM = 50;

/**
 * Pas de la grille mineure en pixels
 */
export const GRID_MINOR_PX = GRID_MINOR_MM * MM_TO_PX;

/**
 * Pas de la grille majeure en pixels
 */
export const GRID_MAJOR_PX = GRID_MAJOR_MM * MM_TO_PX;

// ==================== SNAP & GUIDES ====================
/**
 * Seuil de snap pour les guides magnétiques (px)
 * Distance maximale pour qu'un bord/centre s'aligne sur un autre
 */
export const SNAP_THRESHOLD_PX = 5;

/**
 * Tolérance directionnelle pour les guides (px)
 * Utilisée pour filtrer les guides quasi-parallèles
 */
export const DIR_EPS_PX = 0.5;

// ==================== MOUVEMENT CLAVIER ====================
/**
 * Pas de déplacement standard au clavier (sans Shift) en mm
 * Une pression de flèche = 1mm
 */
export const KEYBOARD_STEP_MM = 1.0;

/**
 * Pas de déplacement standard au clavier en pixels
 */
export const KEYBOARD_STEP_PX = KEYBOARD_STEP_MM * MM_TO_PX;

/**
 * Multiplicateur pour Shift+flèche (pas rapide)
 * Shift+flèche = 10mm
 */
export const KEYBOARD_SHIFT_MULTIPLIER = 10;

/**
 * Pas de la grille de snap 10mm (mm)
 * Quand le toggle "Snap 10mm" est activé
 */
export const SNAP_GRID_10MM = 10.0;

/**
 * Pas de la grille de snap 10mm en pixels
 */
export const SNAP_GRID_10MM_PX = SNAP_GRID_10MM * MM_TO_PX;

// ==================== CONVERSIONS & HELPERS ====================
/**
 * Exporte les constantes de conversion pour usage dans debug
 */
export { DPI, MM_PER_INCH, MM_TO_PX, PX_TO_MM };

/**
 * Helper : convertir mm → px
 */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

/**
 * Helper : convertir px → mm
 */
export function pxToMm(px: number): number {
  return px * PX_TO_MM;
}

/**
 * Helper : arrondir à N décimales
 */
export function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
