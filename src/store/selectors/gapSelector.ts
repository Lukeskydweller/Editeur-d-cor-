import type { SceneDraft, Piece, ID, BBox } from '@/types/scene';
import { pieceBBox } from '@/lib/geom';
import { PX_TO_MM } from '@/constants/validation';

/**
 * DÉFINITION DU GAP
 * ==================
 * Le "gap" calculé par ce module est la distance minimale bord-à-bord
 * entre les AABBs (Axis-Aligned Bounding Boxes) rotation-aware de deux pièces.
 *
 * Mode de calcul :
 * 1. Pour chaque pièce, on calcule son AABB rotation-aware :
 *    - Si rotation = 0° ou 180° : AABB = { x, y, w, h } direct
 *    - Si rotation = 90° ou 270° : AABB swap w↔h et ajuste x,y
 *
 * 2. On calcule les 4 gaps directionnels (horizontal/vertical) :
 *    - gapRight = neighbor.x - (subject.x + subject.w)
 *    - gapLeft = subject.x - (neighbor.x + neighbor.w)
 *    - gapBottom = neighbor.y - (subject.y + subject.h)
 *    - gapTop = subject.y - (neighbor.y + neighbor.h)
 *
 * 3. On retient le gap minimal positif (≥ 0) :
 *    - gap > 0 : pièces séparées
 *    - gap = 0 : pièces bord-à-bord (collage)
 *    - gap < 0 : overlap (tous négatifs → retourne 0)
 *
 * CE QUI EST IGNORÉ :
 * - Les épaisseurs de trait (stroke)
 * - Les ombres portées
 * - Les coins arrondis (borderRadius)
 * - Les transformations CSS
 *
 * Le gap est purement géométrique sur les AABBs, pas sur les contours visuels.
 */

export type GapSide = 'left' | 'right' | 'top' | 'bottom' | null;

export interface NearestGapResult {
  gapMm: number | null;
  nearestId: ID | null;
  side: GapSide;
  subjectCenter: { x: number; y: number };
}

/**
 * State structure expected by the selector.
 * Compatible with useSceneStore state.
 */
export interface SceneStateForGap {
  scene: SceneDraft;
  ui: {
    selectedId?: ID;
    selectedIds?: ID[];
  };
}

/**
 * Calcule le gap minimal bord-à-bord entre la bbox sujet et une bbox voisine.
 * Retourne { gap, side } où side indique le côté du sujet le plus proche.
 *
 * IMPORTANT: Ne mesure que les gaps ALIGNÉS (avec recouvrement dans l'axe perpendiculaire) :
 * - Gaps horizontaux (left/right) : nécessitent un recouvrement vertical
 * - Gaps verticaux (top/bottom) : nécessitent un recouvrement horizontal
 */
function computeGapWithSide(
  subject: BBox,
  neighbor: BBox
): { gap: number; side: GapSide } {
  // Calculer les gaps directionnels (positif = séparé, négatif = overlap)
  const gapRight = neighbor.x - (subject.x + subject.w); // neighbor à droite
  const gapLeft = subject.x - (neighbor.x + neighbor.w);  // neighbor à gauche
  const gapBottom = neighbor.y - (subject.y + subject.h); // neighbor en bas
  const gapTop = subject.y - (neighbor.y + neighbor.h);   // neighbor en haut

  // Vérifier les recouvrements dans les axes perpendiculaires
  const overlapVertical = !(subject.y + subject.h <= neighbor.y || neighbor.y + neighbor.h <= subject.y);
  const overlapHorizontal = !(subject.x + subject.w <= neighbor.x || neighbor.x + neighbor.w <= subject.x);

  // Construire les gaps valides avec condition d'alignement
  const gaps: Array<{ gap: number; side: GapSide }> = [];

  // Gaps horizontaux nécessitent recouvrement vertical
  if (overlapVertical) {
    if (gapRight >= 0) gaps.push({ gap: gapRight, side: 'right' as const });
    if (gapLeft >= 0) gaps.push({ gap: gapLeft, side: 'left' as const });
  }

  // Gaps verticaux nécessitent recouvrement horizontal
  if (overlapHorizontal) {
    if (gapBottom >= 0) gaps.push({ gap: gapBottom, side: 'bottom' as const });
    if (gapTop >= 0) gaps.push({ gap: gapTop, side: 'top' as const });
  }

  if (gaps.length === 0) {
    // Pas de gap aligné positif - peut être overlap (aligned) ou diagonal (non-aligned)
    // Pour distinguer : si overlap dans au moins un axe perpendiculaire, c'est un overlap aligné
    if (overlapVertical || overlapHorizontal) {
      // Overlap aligné → retourner gap=0 avec side=null
      return { gap: 0, side: null };
    } else {
      // Diagonal non-aligné → retourner gap=Infinity pour indiquer "pas de voisin aligné"
      return { gap: Infinity, side: null };
    }
  }

  // Retourner le gap minimal parmi les gaps alignés
  const minGap = gaps.reduce((min, curr) =>
    curr.gap < min.gap ? curr : min
  );

  return minGap;
}

/**
 * Calcule la bbox du groupe (union des AABBs des pièces sélectionnées).
 */
function computeGroupBBox(pieces: Piece[]): BBox {
  if (pieces.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  const bboxes = pieces.map(p => pieceBBox(p));
  const minX = Math.min(...bboxes.map(b => b.x));
  const minY = Math.min(...bboxes.map(b => b.y));
  const maxX = Math.max(...bboxes.map(b => b.x + b.w));
  const maxY = Math.max(...bboxes.map(b => b.y + b.h));

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Options pour le sélecteur de gap.
 */
export interface SelectNearestGapOptions {
  /**
   * Override de la bbox du sujet (pour calcul temps réel sur position candidate).
   * Si fourni, utilisé à la place de la bbox calculée depuis selectedIds.
   */
  subjectOverride?: BBox;
  /**
   * IDs supplémentaires à exclure des voisins (en plus de selectedIds).
   */
  excludeIds?: ID[];
  /**
   * BBox transitoire à exclure (ghost pendant resize/drag).
   * Si une pièce a exactement cette bbox, elle est ignorée.
   */
  excludeTransientBBox?: BBox | null;
}

/**
 * Sélecteur : retourne le gap minimal entre la sélection courante et ses voisins externes.
 *
 * - Pour une pièce solo : bbox de la pièce (rotation-aware)
 * - Pour un groupe : bbox union du groupe
 * - Exclut les membres du groupe courant
 * - Retourne gap en mm, l'ID du voisin le plus proche, le côté, et le centre du sujet
 *
 * @param state État de la scène (scene + ui)
 * @param opts Options (subjectOverride pour bbox candidate, excludeIds pour exclusions supplémentaires)
 */
export function selectNearestGap(
  state: SceneStateForGap,
  opts?: SelectNearestGapOptions
): NearestGapResult {
  const { scene, ui } = state;

  // 1) Déterminer les IDs sélectionnés
  const selectedIds: ID[] = ui.selectedIds ?? (ui.selectedId ? [ui.selectedId] : []);

  // 2) Calculer ou utiliser la bbox override du sujet
  let subjectBBox: BBox;

  if (opts?.subjectOverride) {
    // Utiliser la bbox candidate fournie (position transitoire)
    subjectBBox = opts.subjectOverride;
  } else {
    // Calculer depuis les pièces sélectionnées (état commité)
    if (selectedIds.length === 0) {
      return {
        gapMm: null,
        nearestId: null,
        side: null,
        subjectCenter: { x: 0, y: 0 },
      };
    }

    const selectedPieces = selectedIds
      .map(id => scene.pieces[id])
      .filter(Boolean);

    if (selectedPieces.length === 0) {
      return {
        gapMm: null,
        nearestId: null,
        side: null,
        subjectCenter: { x: 0, y: 0 },
      };
    }

    subjectBBox = computeGroupBBox(selectedPieces);
  }

  const subjectCenter = {
    x: subjectBBox.x + subjectBBox.w / 2,
    y: subjectBBox.y + subjectBBox.h / 2,
  };

  // 3) Récupérer les voisins externes (exclure membres du groupe + excludeIds)
  const excludeSet = new Set([...selectedIds, ...(opts?.excludeIds ?? [])]);
  const neighbors = Object.values(scene.pieces)
    .filter(p => !excludeSet.has(p.id));

  if (neighbors.length === 0) {
    return {
      gapMm: null,
      nearestId: null,
      side: null,
      subjectCenter,
    };
  }

  // 4) Calculer le gap minimal avec chaque voisin
  let minGap = Infinity;
  let nearestId: ID | null = null;
  let nearestSide: GapSide = null;

  const excludeGhost = opts?.excludeTransientBBox;

  for (const neighbor of neighbors) {
    const neighborBBox = pieceBBox(neighbor);

    // Si une bbox transitoire est fournie et correspond à ce voisin, l'ignorer
    if (excludeGhost) {
      const eq = (a: number, b: number) => Math.abs(a - b) <= 0.01;
      if (
        eq(neighborBBox.x, excludeGhost.x) &&
        eq(neighborBBox.y, excludeGhost.y) &&
        eq(neighborBBox.w, excludeGhost.w) &&
        eq(neighborBBox.h, excludeGhost.h)
      ) {
        continue; // Ignorer ce voisin (c'est le ghost)
      }
    }

    const { gap, side } = computeGapWithSide(subjectBBox, neighborBBox);

    // Ne retenir que les gaps alignés (gap !== Infinity)
    // Note: gap=0 avec side=null est un overlap aligné (valide)
    if (gap !== Infinity && gap < minGap) {
      minGap = gap;
      nearestId = neighbor.id;
      nearestSide = side;
    }
  }

  // 5) Convertir en mm et retourner
  if (minGap === Infinity || nearestId === null) {
    return {
      gapMm: null,
      nearestId: null,
      side: null,
      subjectCenter,
    };
  }

  return {
    // minGap est déjà en mm (BBox en mm), pas de conversion nécessaire
    gapMm: minGap,
    nearestId,
    side: nearestSide,
    subjectCenter,
  };
}

/**
 * Type de mode de gap (pour debug)
 */
export type GapMode = 'horizontal' | 'vertical' | 'diagonal' | 'overlap';

/**
 * Résultat détaillé d'explainGap (pour panneau debug)
 */
export interface ExplainGapResult {
  mode: GapMode;
  gapPx: number;
  gapMm: number;
  side: GapSide;
  /** Gaps directionnels calculés (px) */
  gapRight: number;
  gapLeft: number;
  gapBottom: number;
  gapTop: number;
  /** Deltas horizontaux/verticaux (px) */
  dxPx: number; // horizontal separation (can be negative for overlap)
  dyPx: number; // vertical separation (can be negative for overlap)
}

/**
 * Explique en détail comment le gap a été calculé entre deux bboxes.
 * Utilisé par le panneau debug pour afficher les valeurs intermédiaires.
 *
 * @param subjectBBox BBox du sujet (pièce ou groupe sélectionné)
 * @param neighborBBox BBox du voisin le plus proche
 * @returns Détails complets du calcul de gap
 */
export function explainGap(
  subjectBBox: BBox,
  neighborBBox: BBox
): ExplainGapResult {
  // Calculer les 4 gaps directionnels (px)
  const gapRight = neighborBBox.x - (subjectBBox.x + subjectBBox.w);
  const gapLeft = subjectBBox.x - (neighborBBox.x + neighborBBox.w);
  const gapBottom = neighborBBox.y - (subjectBBox.y + subjectBBox.h);
  const gapTop = subjectBBox.y - (neighborBBox.y + neighborBBox.h);

  // Trouver le gap minimal
  const { gap, side } = computeGapWithSide(subjectBBox, neighborBBox);

  // Déterminer le mode
  let mode: GapMode;
  if (gap < 0 || (gapRight < 0 && gapLeft < 0 && gapBottom < 0 && gapTop < 0)) {
    mode = 'overlap';
  } else if (side === 'left' || side === 'right') {
    mode = 'horizontal';
  } else if (side === 'top' || side === 'bottom') {
    mode = 'vertical';
  } else {
    // Cas limite : gap diagonal (coins se faisant face)
    mode = 'diagonal';
  }

  // Calculer les deltas (pour overlap, ce sera négatif)
  const dxPx = Math.min(Math.abs(gapRight), Math.abs(gapLeft));
  const dyPx = Math.min(Math.abs(gapBottom), Math.abs(gapTop));

  return {
    mode,
    // gap/dx/dy sont déjà en mm (BBox en mm), renommer les champs pour clarté
    gapPx: Math.max(0, gap), // en fait en mm, nom historique conservé
    gapMm: Math.max(0, gap), // déjà en mm, pas de conversion
    side,
    gapRight, // en mm
    gapLeft, // en mm
    gapBottom, // en mm
    gapTop, // en mm
    dxPx: mode === 'horizontal' ? gap : dxPx, // en mm
    dyPx: mode === 'vertical' ? gap : dyPx, // en mm
  };
}
