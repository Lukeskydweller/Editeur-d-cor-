/**
 * Helper pour calculer le pas effectif du déplacement clavier
 */

import { KEYBOARD_STEP_MM, KEYBOARD_SHIFT_MULTIPLIER, SNAP_GRID_10MM, MM_TO_PX, PX_TO_MM } from '@/constants/scene';

export interface KeyboardStepOptions {
  /** Shift pressé (multiplicateur x10) */
  shift: boolean;
  /** Snap 10mm activé */
  snap10mm: boolean;
}

export interface EffectiveStepResult {
  /** Pas effectif en pixels */
  stepPx: number;
  /** Pas effectif en millimètres */
  stepMm: number;
  /** Explication du calcul */
  explanation: string;
}

/**
 * Calcule le pas effectif d'un déplacement clavier
 * en tenant compte des modificateurs (Shift) et du snap 10mm.
 *
 * Règles :
 * - Par défaut : 1 flèche = 1mm
 * - Shift+flèche : 1 flèche = 10mm
 * - Snap 10mm ON : le déplacement final est snappé à la grille 10mm
 *   (donc le pas effectif dépend de la position actuelle)
 *
 * @param opts Options (shift, snap10mm)
 * @returns Pas effectif en px et mm, avec explication
 */
export function getEffectiveStep(opts: KeyboardStepOptions): EffectiveStepResult {
  const { shift, snap10mm } = opts;

  // Calcul du pas brut (avant snap grille)
  const baseMm = shift ? KEYBOARD_STEP_MM * KEYBOARD_SHIFT_MULTIPLIER : KEYBOARD_STEP_MM;
  const basePx = baseMm * MM_TO_PX;

  if (!snap10mm) {
    // Pas de snap grille : le pas est fixe
    return {
      stepPx: basePx,
      stepMm: baseMm,
      explanation: shift
        ? `Shift+flèche = ${baseMm}mm (${basePx.toFixed(2)}px)`
        : `Flèche = ${baseMm}mm (${basePx.toFixed(2)}px)`,
    };
  }

  // Snap 10mm ON : le pas effectif dépend de la position de départ
  // Si la pièce est déjà sur la grille 10mm, le pas sera de 10mm
  // Sinon, le premier mouvement snappera à la grille la plus proche
  // Pour simplifier, on retourne le pas de la grille
  const gridMm = SNAP_GRID_10MM;
  const gridPx = gridMm * MM_TO_PX;

  return {
    stepPx: gridPx,
    stepMm: gridMm,
    explanation: shift
      ? `Shift+flèche avec Snap 10mm ON = ${gridMm}mm (${gridPx.toFixed(2)}px, snappé à la grille)`
      : `Flèche avec Snap 10mm ON = ${gridMm}mm (${gridPx.toFixed(2)}px, snappé à la grille)`,
  };
}

/**
 * Calcule le pas effectif pour une position donnée avec snap 10mm.
 * Retourne le delta réel qui sera appliqué à cette position.
 *
 * @param currentPosPx Position actuelle en pixels
 * @param direction Direction (+1 ou -1)
 * @param opts Options (shift, snap10mm)
 * @returns Delta effectif en px et mm
 */
export function getEffectiveStepForPosition(
  currentPosPx: number,
  direction: number,
  opts: KeyboardStepOptions
): EffectiveStepResult {
  const { shift, snap10mm } = opts;

  // Calcul du pas brut
  const baseMm = shift ? KEYBOARD_STEP_MM * KEYBOARD_SHIFT_MULTIPLIER : KEYBOARD_STEP_MM;
  const basePx = baseMm * MM_TO_PX;

  if (!snap10mm) {
    // Pas de snap : retour simple
    return {
      stepPx: basePx * direction,
      stepMm: baseMm * direction,
      explanation: shift
        ? `Shift+flèche = ${baseMm}mm`
        : `Flèche = ${baseMm}mm`,
    };
  }

  // Snap 10mm ON : calculer la cible snappée
  const targetPosPx = currentPosPx + basePx * direction;
  const gridPx = SNAP_GRID_10MM * MM_TO_PX;
  const snappedPosPx = Math.round(targetPosPx / gridPx) * gridPx;
  const effectiveDeltaPx = snappedPosPx - currentPosPx;
  const effectiveDeltaMm = effectiveDeltaPx * PX_TO_MM;

  return {
    stepPx: effectiveDeltaPx,
    stepMm: effectiveDeltaMm,
    explanation: `Snap 10mm ON: ${currentPosPx.toFixed(2)}px → ${snappedPosPx.toFixed(2)}px (Δ=${effectiveDeltaPx.toFixed(2)}px ≈ ${effectiveDeltaMm.toFixed(2)}mm)`,
  };
}
