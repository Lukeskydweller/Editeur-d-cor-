/**
 * Sélecteur centralisé pour la bbox de sélection (solo/groupe)
 *
 * Retourne la bounding box (rotation-aware AABB) de la sélection courante:
 * - Si 1 seule pièce sélectionnée → AABB de cette pièce
 * - Si plusieurs pièces sélectionnées → union des AABB (bbox groupe)
 * - Si aucune sélection → null
 *
 * Dépend de scene.revision pour se mettre à jour immédiatement
 * quand une pièce change de position/taille/rotation.
 */

import type { SceneState } from '@/state/useSceneStore';
import { pieceAABB } from '@/lib/geom/aabb';

export interface SelectionBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Sélecteur principal pour la bbox de sélection
 *
 * IMPORTANT: Ce sélecteur doit être utilisé avec selectionBBoxEq comme comparateur
 * pour éviter les re-renders inutiles quand les valeurs n'ont pas changé.
 *
 * Zustand souscrit automatiquement aux propriétés accédées (selectedIds, pieces).
 * Cependant, accéder à state.scene.pieces[id] crée une souscription à l'objet entier.
 * Pour éviter les re-calculs inutiles, on s'appuie sur l'égalité structurelle via
 * selectionBBoxEq qui ne déclenche un re-render QUE si x/y/w/h changent vraiment.
 */
export function selectSelectionBBox(state: SceneState): SelectionBBox | null {

  const selectedIds = state.ui.selectedIds ?? (state.ui.selectedId ? [state.ui.selectedId] : []);

  if (selectedIds.length === 0) {
    return null;
  }

  // Single piece: return its AABB
  if (selectedIds.length === 1) {
    const piece = state.scene.pieces[selectedIds[0]];
    if (!piece) return null;

    const aabb = pieceAABB(piece);
    return {
      x: aabb.x,
      y: aabb.y,
      w: aabb.w,
      h: aabb.h,
    };
  }

  // Multiple pieces: compute union AABB (group bbox)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of selectedIds) {
    const piece = state.scene.pieces[id];
    if (!piece) continue;

    const aabb = pieceAABB(piece);
    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.w);
    maxY = Math.max(maxY, aabb.y + aabb.h);
  }

  // No valid pieces found
  if (minX === Infinity) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

/**
 * Comparateur pour éviter les re-rendus inutiles
 * Compare champ à champ au lieu de référence d'objet
 */
export function selectionBBoxEq(a: SelectionBBox | null, b: SelectionBBox | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;

  return (
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h
  );
}

/**
 * Conversion vers tuple pour comparaison alternative
 * Utile pour les dépendances useMemo/useEffect
 */
export function selectionBBoxToTuple(bbox: SelectionBBox | null): [number, number, number, number] | null {
  return bbox ? [bbox.x, bbox.y, bbox.w, bbox.h] : null;
}
