import type { SceneDraft, ID, Piece } from '@/types/scene';
import { pieceAABB, edgesOfRect, type AABB as BBox } from '@/lib/geom/aabb';
import { getSnapNeighbors } from '@/core/snap/candidates';
import { queryNeighbors, isAutoEnabled } from '@/lib/spatial/globalIndex';
import { metrics, incShortlistSource } from '@/lib/metrics';
import { MIN_GAP_MM, SNAP_EDGE_THRESHOLD_MM, MM_TO_PX, PX_TO_MM } from '@/constants/validation';
import { selectNearestGap } from '@/store/selectors/gapSelector';
import { shortlistSameLayerAABB } from '@/state/useSceneStore';

// Ré-exporter pour compatibilité
export { MM_TO_PX, PX_TO_MM } from '@/constants/validation';

export type SnapGuide = { kind: 'v'; x: number } | { kind: 'h'; y: number };

export type RectMM = { x: number; y: number; w: number; h: number };

export function rectEdges(r: RectMM) {
  return edgesOfRect(r);
}

/**
 * Compute snap-to-other-pieces for a candidate rect.
 * - thresholdMm: snap radius (e.g. 5)
 * - excludeId: piece being dragged
 *
 * OPTIMIZATION: Uses RBush spatial index to only check nearby pieces (margin=12mm, limit=16)
 * instead of iterating through all pieces. Falls back to full iteration if index unavailable.
 */
export function snapToPieces(
  scene: SceneDraft,
  candidate: RectMM,
  thresholdMm = 5,
  excludeId?: ID,
): { x: number; y: number; guides: SnapGuide[] } {
  const c = rectEdges(candidate);
  let bestDx = 0;
  let bestDy = 0;
  const guides: SnapGuide[] = [];

  // OPTIMIZATION: Use LayeredRBush spatial index to get nearby same-layer pieces only
  let piecesToCheck: Array<(typeof scene.pieces)[string]>;

  // Determine layer to query
  if (excludeId && scene.pieces[excludeId]) {
    const movingLayerId = scene.pieces[excludeId].layerId;
    const margin = 12; // mm

    try {
      // Use shortlistSameLayerAABB (handles RBush/Global switching internally)
      // Exclude the moving piece from spatial query results
      const excludeIdSet = excludeId ? new Set([excludeId]) : undefined;
      const neighborIds = shortlistSameLayerAABB(
        movingLayerId,
        {
          x: candidate.x - margin,
          y: candidate.y - margin,
          w: candidate.w + 2 * margin,
          h: candidate.h + 2 * margin,
        },
        scene,
        excludeIdSet,
      );

      piecesToCheck = neighborIds.map((id) => scene.pieces[id]).filter((p) => p !== undefined);

      // Fallback: if no neighbors found (e.g., spatial index not ready in tests),
      // use all same-layer pieces to ensure snap still works
      if (piecesToCheck.length === 0) {
        piecesToCheck = Object.values(scene.pieces).filter(
          (p) => p.layerId === movingLayerId && p.id !== excludeId,
        );
      }
    } catch {
      // Fallback: use all same-layer pieces
      piecesToCheck = Object.values(scene.pieces).filter(
        (p) => p.layerId === movingLayerId && p.id !== excludeId,
      );
    }
  } else {
    // No excludeId: cannot determine layer, fallback to all pieces
    piecesToCheck = Object.values(scene.pieces);
  }

  // Explore nearby pieces (using rotation-aware AABB)
  for (const p of piecesToCheck) {
    if (p.id === excludeId) continue;
    const r = pieceAABB(p); // Use rotated AABB instead of raw position/size
    const e = rectEdges(r);

    // vertical alignments (x axis): left, centerX, right (+ cross-alignments)
    const candidatesV: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.left, current: c.left, guide: { kind: 'v', x: e.left } },
      { target: e.cx, current: c.cx, guide: { kind: 'v', x: e.cx } },
      { target: e.right, current: c.right, guide: { kind: 'v', x: e.right } },
      // Cross-alignments: snap current.left to target.right, current.right to target.left
      { target: e.right, current: c.left, guide: { kind: 'v', x: e.right } },
      { target: e.left, current: c.right, guide: { kind: 'v', x: e.left } },
    ];

    for (const v of candidatesV) {
      const dx = v.target - v.current;
      if (Math.abs(dx) <= thresholdMm && Math.abs(dx) >= Math.abs(bestDx)) {
        if (Math.abs(dx) > Math.abs(bestDx)) {
          bestDx = dx;
          // Remplacer les guides verticaux existants
          guides.splice(0, guides.length, ...guides.filter((g) => g.kind === 'h'), v.guide);
        }
      }
    }

    // horizontal alignments (y axis): top, centerY, bottom (+ cross-alignments)
    const candidatesH: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.top, current: c.top, guide: { kind: 'h', y: e.top } },
      { target: e.cy, current: c.cy, guide: { kind: 'h', y: e.cy } },
      { target: e.bottom, current: c.bottom, guide: { kind: 'h', y: e.bottom } },
      // Cross-alignments: snap current.top to target.bottom, current.bottom to target.top
      { target: e.bottom, current: c.top, guide: { kind: 'h', y: e.bottom } },
      { target: e.top, current: c.bottom, guide: { kind: 'h', y: e.top } },
    ];

    for (const h of candidatesH) {
      const dy = h.target - h.current;
      if (Math.abs(dy) <= thresholdMm && Math.abs(dy) >= Math.abs(bestDy)) {
        if (Math.abs(dy) > Math.abs(bestDy)) {
          bestDy = dy;
          // Remplacer les guides horizontaux existants
          guides.splice(0, guides.length, ...guides.filter((g) => g.kind === 'v'), h.guide);
        }
      }
    }
  }

  return { x: candidate.x + bestDx, y: candidate.y + bestDy, guides };
}

/**
 * Compute snap-to-other-pieces for a group bounding box.
 * - thresholdMm: snap radius (e.g. 5)
 * - excludeIds: pieces being dragged
 *
 * OPTIMIZATION: Uses RBush spatial index to only check nearby pieces (margin=12mm, limit=16)
 * by querying neighbors of each piece in the group. Falls back to full iteration if index unavailable.
 */
export function snapGroupToPieces(
  scene: SceneDraft,
  groupRect: RectMM,
  thresholdMm = 5,
  excludeIds: ID[] = [],
): { x: number; y: number; guides: SnapGuide[] } {
  const c = rectEdges(groupRect);
  let bestDx = 0;
  let bestDy = 0;
  const guides: SnapGuide[] = [];

  // OPTIMIZATION: Use LayeredRBush spatial index to get nearby same-layer pieces only
  let piecesToCheck: Array<(typeof scene.pieces)[string]>;

  // Determine layer to query
  if (excludeIds.length > 0 && scene.pieces[excludeIds[0]]) {
    const movingLayerId = scene.pieces[excludeIds[0]].layerId;
    const margin = 12; // mm
    const excludeIdSet = new Set(excludeIds);

    try {
      // Collect neighbors of all pieces in the group (not just groupRect)
      // This ensures we find pieces near any group member, not just the group bbox
      const neighborSet = new Set<string>();
      for (const id of excludeIds) {
        const piece = scene.pieces[id];
        if (!piece) continue;

        const pieceBbox = pieceAABB(piece);
        const neighborIds = shortlistSameLayerAABB(
          movingLayerId,
          {
            x: pieceBbox.x - margin,
            y: pieceBbox.y - margin,
            w: pieceBbox.w + 2 * margin,
            h: pieceBbox.h + 2 * margin,
          },
          scene,
          excludeIdSet,
        );
        neighborIds.forEach((nid) => neighborSet.add(nid));
      }

      piecesToCheck = Array.from(neighborSet)
        .map((id) => scene.pieces[id])
        .filter((p) => p !== undefined);

      // Fallback: if no neighbors found (e.g., spatial index not ready in tests),
      // use all same-layer pieces to ensure snap still works
      if (piecesToCheck.length === 0) {
        piecesToCheck = Object.values(scene.pieces).filter(
          (p) => p.layerId === movingLayerId && !excludeIdSet.has(p.id),
        );
      }
    } catch {
      // Fallback: use all same-layer pieces (excluding group members)
      piecesToCheck = Object.values(scene.pieces).filter(
        (p) => p.layerId === movingLayerId && !excludeIdSet.has(p.id),
      );
    }
  } else {
    // No excludeIds: cannot determine layer, fallback to all pieces
    piecesToCheck = Object.values(scene.pieces);
  }

  // Explore nearby pieces (using rotation-aware AABB)
  for (const p of piecesToCheck) {
    if (excludeIds.includes(p.id)) continue;
    const r = pieceAABB(p); // Use rotated AABB instead of raw position/size
    const e = rectEdges(r);

    // vertical alignments (x axis): left, centerX, right (+ cross-alignments)
    const candidatesV: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.left, current: c.left, guide: { kind: 'v', x: e.left } },
      { target: e.cx, current: c.cx, guide: { kind: 'v', x: e.cx } },
      { target: e.right, current: c.right, guide: { kind: 'v', x: e.right } },
      // Cross-alignments: snap current.left to target.right, current.right to target.left
      { target: e.right, current: c.left, guide: { kind: 'v', x: e.right } },
      { target: e.left, current: c.right, guide: { kind: 'v', x: e.left } },
    ];

    for (const v of candidatesV) {
      const dx = v.target - v.current;
      if (Math.abs(dx) <= thresholdMm && Math.abs(dx) >= Math.abs(bestDx)) {
        if (Math.abs(dx) > Math.abs(bestDx)) {
          bestDx = dx;
          // Remplacer les guides verticaux existants
          guides.splice(0, guides.length, ...guides.filter((g) => g.kind === 'h'), v.guide);
        }
      }
    }

    // horizontal alignments (y axis): top, centerY, bottom (+ cross-alignments)
    const candidatesH: Array<{ target: number; current: number; guide: SnapGuide }> = [
      { target: e.top, current: c.top, guide: { kind: 'h', y: e.top } },
      { target: e.cy, current: c.cy, guide: { kind: 'h', y: e.cy } },
      { target: e.bottom, current: c.bottom, guide: { kind: 'h', y: e.bottom } },
      // Cross-alignments: snap current.top to target.bottom, current.bottom to target.top
      { target: e.bottom, current: c.top, guide: { kind: 'h', y: e.bottom } },
      { target: e.top, current: c.bottom, guide: { kind: 'h', y: e.top } },
    ];

    for (const h of candidatesH) {
      const dy = h.target - h.current;
      if (Math.abs(dy) <= thresholdMm && Math.abs(dy) >= Math.abs(bestDy)) {
        if (Math.abs(dy) > Math.abs(bestDy)) {
          bestDy = dy;
          // Remplacer les guides horizontaux existants
          guides.splice(0, guides.length, ...guides.filter((g) => g.kind === 'v'), h.guide);
        }
      }
    }
  }

  return { x: groupRect.x + bestDx, y: groupRect.y + bestDy, guides };
}

/**
 * Calcule le gap minimal bord-à-bord entre un rect et ses voisins.
 * Retourne Infinity si aucun voisin proche.
 */
export function computeMinGap(subjectRect: RectMM, neighbors: Array<Piece>): number {
  if (neighbors.length === 0) return Infinity;

  const c = rectEdges(subjectRect);
  let minGap = Infinity;

  for (const p of neighbors) {
    const r = pieceAABB(p);
    const e = rectEdges(r);

    // Calcul gap bord-à-bord pour chaque direction
    const gapLeftToRight = e.left - c.right;
    const gapRightToLeft = c.left - e.right;
    const gapTopToBottom = e.top - c.bottom;
    const gapBottomToTop = c.top - e.bottom;

    // Prendre le gap minimal positif (séparé, pas overlap)
    const gaps = [gapLeftToRight, gapRightToLeft, gapTopToBottom, gapBottomToTop].filter(
      (g) => g > 0,
    );
    if (gaps.length > 0) {
      minGap = Math.min(minGap, ...gaps);
    }
  }

  return minGap;
}

/**
 * Snap "edge collage" — colle automatiquement bord-à-bord si gap < 0,5mm.
 *
 * @param candidate - Rect candidat (x,y,w,h)
 * @param scene - Scène pour trouver les voisins
 * @param excludeIds - IDs à exclure (pièce candidate + membres groupe si applicable)
 * @param gapThreshold - Seuil de collage en mm (défaut 1.0mm)
 * @param prevGapPx - Gap précédent (optionnel). Si fourni, colle seulement si gap_new < prevGapPx (directionnalité)
 * @returns Position ajustée {x, y} si collage appliqué, sinon position inchangée
 */
export function snapEdgeCollage(
  candidate: RectMM,
  scene: SceneDraft,
  excludeIds: ID[] = [],
  gapThreshold = SNAP_EDGE_THRESHOLD_MM,
  prevGapPx?: number,
): { x: number; y: number; snapped: boolean } {
  // Feature flag: allow disabling gap collage if regression detected
  const enabled = import.meta.env.VITE_FEAT_GAP_COLLAGE !== 'false';
  if (!enabled) {
    return { x: candidate.x, y: candidate.y, snapped: false };
  }

  const SNAP_THRESHOLD = gapThreshold;
  // Tolérance directionnelle pour arrondis px/mm (~0.35px ≈ 0.13mm @96DPI)
  const DIR_EPS_PX = 0.35;
  const c = rectEdges(candidate);

  // Obtenir tous les voisins potentiels (même logique que snapToPieces)
  let piecesToCheck: Array<(typeof scene.pieces)[string]> = [];

  // Determine layer to query
  if (excludeIds.length > 0 && scene.pieces[excludeIds[0]]) {
    const movingLayerId = scene.pieces[excludeIds[0]].layerId;
    const margin = 12; // mm
    const excludeIdSet = new Set(excludeIds);

    try {
      // Use shortlistSameLayerAABB (handles RBush/Global switching internally)
      // Exclude all specified IDs from spatial query results
      const neighborIds = shortlistSameLayerAABB(
        movingLayerId,
        {
          x: candidate.x - margin,
          y: candidate.y - margin,
          w: candidate.w + 2 * margin,
          h: candidate.h + 2 * margin,
        },
        scene,
        excludeIdSet,
      );

      piecesToCheck = neighborIds.map((id) => scene.pieces[id]).filter((p) => p !== undefined);
    } catch {
      // Fallback: use all same-layer pieces (excluding specified IDs)
      piecesToCheck = Object.values(scene.pieces).filter(
        (p) => p.layerId === movingLayerId && !excludeIdSet.has(p.id),
      );
    }
  } else {
    // No excludeIds: cannot determine layer, fallback to all pieces
    piecesToCheck = Object.values(scene.pieces).filter((p) => !excludeIds.includes(p.id));
  }

  let bestDx = 0;
  let bestDy = 0;
  let minGap = Infinity;

  for (const p of piecesToCheck) {
    const r = pieceAABB(p);
    const e = rectEdges(r);

    // Calcul gap bord-à-bord pour chaque direction (left/right/top/bottom)
    // Gap horizontal (left→right ou right→left)
    const gapLeftToRight = e.left - c.right; // Candidate à gauche de neighbor
    const gapRightToLeft = c.left - e.right; // Candidate à droite de neighbor

    // Gap vertical (top→bottom ou bottom→top)
    const gapTopToBottom = e.top - c.bottom; // Candidate au-dessus de neighbor
    const gapBottomToTop = c.top - e.bottom; // Candidate en-dessous de neighbor

    // Pour chaque gap positif (pas de chevauchement) < threshold, proposer collage
    const candidates: Array<{ gap: number; dx: number; dy: number }> = [];

    if (gapLeftToRight > 0 && gapLeftToRight < SNAP_THRESHOLD) {
      // Coller candidate.right à neighbor.left
      candidates.push({ gap: gapLeftToRight, dx: gapLeftToRight, dy: 0 });
    }
    if (gapRightToLeft > 0 && gapRightToLeft < SNAP_THRESHOLD) {
      // Coller candidate.left à neighbor.right
      candidates.push({ gap: gapRightToLeft, dx: -gapRightToLeft, dy: 0 });
    }
    if (gapTopToBottom > 0 && gapTopToBottom < SNAP_THRESHOLD) {
      // Coller candidate.bottom à neighbor.top
      candidates.push({ gap: gapTopToBottom, dx: 0, dy: gapTopToBottom });
    }
    if (gapBottomToTop > 0 && gapBottomToTop < SNAP_THRESHOLD) {
      // Coller candidate.top à neighbor.bottom
      candidates.push({ gap: gapBottomToTop, dx: 0, dy: -gapBottomToTop });
    }

    // Choisir le gap le plus petit (collage le plus proche)
    for (const cand of candidates) {
      if (cand.gap < minGap) {
        minGap = cand.gap;
        bestDx = cand.dx;
        bestDy = cand.dy;
      }
    }
  }

  // Vérifier directionnalité : ne coller que si on s'approche
  // Avec tolérance DIR_EPS_PX pour gérer les arrondis px/mm
  if (prevGapPx !== undefined && minGap >= prevGapPx - DIR_EPS_PX) {
    // On s'éloigne ou gap constant, pas de collage
    return { x: candidate.x, y: candidate.y, snapped: false };
  }

  // Vérifier qu'après collage on ne crée pas d'overlap avec un autre voisin
  // (test simplifié : si bestDx ou bestDy non-nuls, vérifier la position finale)
  if (minGap < SNAP_THRESHOLD) {
    const snappedCandidate = {
      x: candidate.x + bestDx,
      y: candidate.y + bestDy,
      w: candidate.w,
      h: candidate.h,
    };
    const snappedEdges = rectEdges(snappedCandidate);

    // Vérifier overlap potentiel avec tous les voisins (pas seulement le gap minimal)
    for (const p of piecesToCheck) {
      const r = pieceAABB(p);
      const e = rectEdges(r);

      // Test AABB simple : overlap si les rectangles se chevauchent
      const overlapX = snappedEdges.right > e.left && snappedEdges.left < e.right;
      const overlapY = snappedEdges.bottom > e.top && snappedEdges.top < e.bottom;

      if (overlapX && overlapY) {
        // Overlap détecté après collage, annuler
        return { x: candidate.x, y: candidate.y, snapped: false };
      }
    }
  }

  const snapped = minGap < SNAP_THRESHOLD;

  // Debug logging (dev mode uniquement)
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_GAP_COLLAGE === 'true') {
    const isApproaching = prevGapPx === undefined || minGap < prevGapPx - DIR_EPS_PX;
    console.log('[snapEdgeCollage]', {
      prevGapPx: prevGapPx?.toFixed(2),
      gapNewPx: minGap.toFixed(2),
      isApproaching,
      didSnap: snapped,
      dx: bestDx.toFixed(2),
      dy: bestDy.toFixed(2),
    });
  }

  return {
    x: candidate.x + bestDx,
    y: candidate.y + bestDy,
    snapped,
  };
}

/**
 * Garde-fou de collage final : force le collage à gap=0 si le gap actuel ∈ (0 ; maxGapPx).
 *
 * Appliqué juste avant commit (keyboard/mouse), indépendant des toggles snap et de la direction.
 * Si le collage créerait un overlap, retourne didSnap=false (sécurité).
 *
 * @param subjectBBox - BBox de la pièce ou du groupe au moment du commit
 * @param neighbors - Voisins externes (exclusions déjà faites en amont)
 * @param maxGapMm - Seuil maximal en mm (typiquement 1.0mm = MIN_GAP_MM)
 * @returns { didSnap, dx, dy } - didSnap=true si collage appliqué, (dx,dy) à ajouter
 */
export function finalizeCollageGuard(params: {
  subjectBBox: RectMM;
  neighbors: Array<Piece>;
  maxGapMm: number;
}): { didSnap: boolean; dx: number; dy: number } {
  const { subjectBBox, neighbors, maxGapMm } = params;

  // Feature flag: allow disabling gap collage if regression detected
  const enabled = import.meta.env.VITE_FEAT_GAP_COLLAGE !== 'false';
  if (!enabled) {
    return { didSnap: false, dx: 0, dy: 0 };
  }

  const MIN_EPS = 1e-6; // Epsilon pour éviter artefacts flottants
  const c = rectEdges(subjectBBox);

  let bestDx = 0;
  let bestDy = 0;
  let minGap = Infinity;

  // Trouver le gap minimal bord-à-bord dans (0 ; maxGapPx)
  for (const p of neighbors) {
    const r = pieceAABB(p);
    const e = rectEdges(r);

    // Calcul gap bord-à-bord pour chaque direction
    const gapLeftToRight = e.left - c.right; // Subject à gauche de neighbor
    const gapRightToLeft = c.left - e.right; // Subject à droite de neighbor
    const gapTopToBottom = e.top - c.bottom; // Subject au-dessus de neighbor
    const gapBottomToTop = c.top - e.bottom; // Subject en-dessous de neighbor

    const candidates: Array<{ gap: number; dx: number; dy: number }> = [];

    // Filtrer gaps strictement positifs et < maxGapMm
    if (gapLeftToRight > MIN_EPS && gapLeftToRight < maxGapMm) {
      candidates.push({ gap: gapLeftToRight, dx: gapLeftToRight, dy: 0 });
    }
    if (gapRightToLeft > MIN_EPS && gapRightToLeft < maxGapMm) {
      candidates.push({ gap: gapRightToLeft, dx: -gapRightToLeft, dy: 0 });
    }
    if (gapTopToBottom > MIN_EPS && gapTopToBottom < maxGapMm) {
      candidates.push({ gap: gapTopToBottom, dx: 0, dy: gapTopToBottom });
    }
    if (gapBottomToTop > MIN_EPS && gapBottomToTop < maxGapMm) {
      candidates.push({ gap: gapBottomToTop, dx: 0, dy: -gapBottomToTop });
    }

    // Choisir le gap le plus petit
    for (const cand of candidates) {
      if (cand.gap < minGap) {
        minGap = cand.gap;
        bestDx = cand.dx;
        bestDy = cand.dy;
      }
    }
  }

  // Si aucun gap dans la fenêtre (0 ; maxGapMm), pas de collage
  if (!isFinite(minGap)) {
    return { didSnap: false, dx: 0, dy: 0 };
  }

  // Vérifier qu'après collage on ne crée pas d'overlap avec un voisin
  const snappedBBox = {
    x: subjectBBox.x + bestDx,
    y: subjectBBox.y + bestDy,
    w: subjectBBox.w,
    h: subjectBBox.h,
  };
  const snappedEdges = rectEdges(snappedBBox);

  for (const p of neighbors) {
    const r = pieceAABB(p);
    const e = rectEdges(r);

    // Test AABB : overlap si chevauchement
    const overlapX = snappedEdges.right > e.left && snappedEdges.left < e.right;
    const overlapY = snappedEdges.bottom > e.top && snappedEdges.top < e.bottom;

    if (overlapX && overlapY) {
      // Overlap détecté, annuler le collage
      return { didSnap: false, dx: 0, dy: 0 };
    }
  }

  // Collage safe, retourner l'ajustement
  return { didSnap: true, dx: bestDx, dy: bestDy };
}

// ============================================================================
// Gap Normalization Helpers
// ============================================================================

/**
 * Convert array of Pieces to Record<ID, Piece> for selector compatibility
 */
function indexById(pieces: Piece[]): Record<ID, Piece> {
  const indexed: Record<ID, Piece> = {};
  for (const p of pieces) {
    indexed[p.id] = p;
  }
  return indexed;
}

/**
 * Check if adjusted bbox overlaps with any neighbor (rotation-aware)
 */
function detectOverlapsBBox(bbox: BBox, neighbors: Piece[]): boolean {
  for (const neighbor of neighbors) {
    const neighborBBox = pieceAABB(neighbor);
    // Simple AABB overlap test
    if (
      bbox.x < neighborBBox.x + neighborBBox.w &&
      bbox.x + bbox.w > neighborBBox.x &&
      bbox.y < neighborBBox.y + neighborBBox.h &&
      bbox.y + bbox.h > neighborBBox.y
    ) {
      return true;
    }
  }
  return false;
}

export interface NormalizeGapResult {
  didNormalize: boolean;
  dx: number;
  dy: number;
}

/**
 * Normalize gap to exact target when in [target, target+epsilon] window
 *
 * Usage: Call at commit phase (keyboard nudge, mouse endDrag) to eliminate
 * "bavante" values like 1.06mm by micro-adjusting to exactly 1.00mm.
 *
 * @param opts.subjectBBox - Candidate bbox (solo piece or group)
 * @param opts.neighbors - External neighbors (exclusions already applied)
 * @param opts.targetMm - Target gap (e.g., 1.00mm)
 * @param opts.epsilonMm - Epsilon window (e.g., 0.12mm)
 * @param opts.sceneBounds - Scene dimensions for bounds checking
 * @returns Adjustment deltas if normalized, or zero if no normalization applied
 */
export function normalizeGapToThreshold(opts: {
  subjectBBox: BBox;
  neighbors: Piece[];
  targetMm: number;
  epsilonMm: number;
  sceneBounds: { w: number; h: number };
}): NormalizeGapResult {
  const { subjectBBox, neighbors, targetMm, epsilonMm, sceneBounds } = opts;

  // Find nearest neighbor and gap using existing selector
  const { nearestId, gapMm, side } = selectNearestGap(
    // Override scene to use candidate bbox
    { scene: { pieces: indexById(neighbors) } as any, ui: { selectedIds: [] } },
    { subjectOverride: subjectBBox },
  );

  // No neighbor or no valid gap
  if (gapMm == null || side == null) {
    return { didNormalize: false, dx: 0, dy: 0 };
  }

  // Gap outside normalization window (target, target+epsilon]
  // Note: gapMm === targetMm means already perfect, no need to normalize
  if (gapMm <= targetMm || gapMm > targetMm + epsilonMm) {
    return { didNormalize: false, dx: 0, dy: 0 };
  }

  // Calculate micro-delta to achieve exact target
  const deltaMm = gapMm - targetMm; // > 0 and ≤ epsilon
  let dx = 0;
  let dy = 0;

  // Apply delta based on side
  if (side === 'left') dx = -deltaMm;
  if (side === 'right') dx = deltaMm;
  if (side === 'top') dy = -deltaMm;
  if (side === 'bottom') dy = deltaMm;

  // Create adjusted bbox
  const adjusted: BBox = {
    ...subjectBBox,
    x: subjectBBox.x + dx,
    y: subjectBBox.y + dy,
  };

  // Guard: Check scene bounds
  if (
    adjusted.x < 0 ||
    adjusted.y < 0 ||
    adjusted.x + adjusted.w > sceneBounds.w ||
    adjusted.y + adjusted.h > sceneBounds.h
  ) {
    return { didNormalize: false, dx: 0, dy: 0 };
  }

  // Guard: Check for overlaps with neighbors
  if (detectOverlapsBBox(adjusted, neighbors)) {
    return { didNormalize: false, dx: 0, dy: 0 };
  }

  return { didNormalize: true, dx, dy };
}
