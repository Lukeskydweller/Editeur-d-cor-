import type { SceneDraft, Piece, ID } from '@/types/scene';
import { pieceBBox, rectsOverlap, bboxInsideRect } from '@/lib/geom';
import { shortlistSameLayerAABB } from '@/state/useSceneStore';

/**
 * Vérifie si une pièce est entièrement contenue dans les limites de la scène.
 */
export function isInsideScene(piece: Piece, scene: SceneDraft): boolean {
  const bbox = pieceBBox(piece);
  return bboxInsideRect(bbox, scene.size.w, scene.size.h);
}

/**
 * Valide qu'aucune pièce ne chevauche une autre.
 * Retourne { ok: true } si aucun conflit, sinon { ok: false, conflicts: [...] }.
 */
export function validateNoOverlap(scene: SceneDraft): {
  ok: boolean;
  conflicts: Array<[ID, ID]>;
} {
  const pieces = Object.values(scene.pieces);
  const conflicts: Array<[ID, ID]> = [];

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const bboxA = pieceBBox(pieces[i]);
      const bboxB = pieceBBox(pieces[j]);
      if (rectsOverlap(bboxA, bboxB)) {
        conflicts.push([pieces[i].id, pieces[j].id]);
      }
    }
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Variante utilisée pour un déplacement groupe:
 * - ignore les paires internes (a,b) si a∈candidateIds && b∈candidateIds
 * - teste bien candidats ↔ voisins externes
 */
export function validateNoOverlapForCandidate(
  scene: SceneDraft,
  candidateIds: ID[],
): {
  ok: boolean;
  conflicts: Array<[ID, ID]>;
} {
  const pieces = Object.values(scene.pieces);
  const conflicts: Array<[ID, ID]> = [];
  const cand = new Set(candidateIds);

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const pieceA = pieces[i];
      const pieceB = pieces[j];

      // Skip si les deux sont dans le groupe candidat (pas d'auto-collision interne)
      if (cand.has(pieceA.id) && cand.has(pieceB.id)) {
        continue;
      }

      const bboxA = pieceBBox(pieceA);
      const bboxB = pieceBBox(pieceB);
      if (rectsOverlap(bboxA, bboxB)) {
        conflicts.push([pieceA.id, pieceB.id]);
      }
    }
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Variante same-layer pour drag/resize: teste uniquement les collisions intra-couche.
 * - ignore les paires internes (a,b) si a∈candidateIds && b∈candidateIds
 * - teste candidats ↔ voisins externes MAIS uniquement même couche
 *
 * @param scene - La scène
 * @param candidateIds - IDs des pièces en cours de déplacement/redimensionnement
 * @returns Validation avec conflicts filtrés par couche
 */
export function validateNoOverlapSameLayer(
  scene: SceneDraft,
  candidateIds: ID[],
): {
  ok: boolean;
  conflicts: Array<[ID, ID]>;
} {
  const conflicts: Array<[ID, ID]> = [];
  const cand = new Set(candidateIds);

  // OPTIMIZATION: For each candidate, query spatial index for same-layer neighbors
  for (const candId of candidateIds) {
    const candPiece = scene.pieces[candId];
    if (!candPiece) continue;

    const bboxA = pieceBBox(candPiece);
    const margin = 0; // No margin needed for overlap detection

    try {
      // Use shortlistSameLayerAABB to get only same-layer pieces near this candidate
      // Exclude all candidates from the spatial query to avoid self/internal collisions
      const neighborIds = shortlistSameLayerAABB(
        candPiece.layerId,
        {
          x: bboxA.x - margin,
          y: bboxA.y - margin,
          w: bboxA.w + 2 * margin,
          h: bboxA.h + 2 * margin,
        },
        scene,
        cand, // Exclude all candidates (Set<ID>)
      );

      for (const neighborId of neighborIds) {
        // Candidates already excluded by spatial query, no need to check again

        const neighborPiece = scene.pieces[neighborId];
        if (!neighborPiece) continue;

        const bboxB = pieceBBox(neighborPiece);
        if (rectsOverlap(bboxA, bboxB)) {
          // Store as sorted pair to avoid duplicates
          const pair: [ID, ID] = candId < neighborId ? [candId, neighborId] : [neighborId, candId];
          // Check if we already have this pair
          if (!conflicts.some(([a, b]) => a === pair[0] && b === pair[1])) {
            conflicts.push(pair);
          }
        }
      }
    } catch {
      // Fallback: use O(n) scan for this candidate's layer
      const pieces = Object.values(scene.pieces).filter(
        (p) => p.layerId === candPiece.layerId && p.id !== candId && !cand.has(p.id),
      );

      for (const neighborPiece of pieces) {
        const bboxB = pieceBBox(neighborPiece);
        if (rectsOverlap(bboxA, bboxB)) {
          const pair: [ID, ID] =
            candId < neighborPiece.id ? [candId, neighborPiece.id] : [neighborPiece.id, candId];
          if (!conflicts.some(([a, b]) => a === pair[0] && b === pair[1])) {
            conflicts.push(pair);
          }
        }
      }
    }
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Valide que toutes les pièces sont contenues dans la scène.
 * Retourne { ok: true } si toutes OK, sinon { ok: false, outside: [...] }.
 */
export function validateInsideScene(scene: SceneDraft): {
  ok: boolean;
  outside: Array<ID>;
} {
  const outside = Object.values(scene.pieces)
    .filter((p) => !isInsideScene(p, scene))
    .map((p) => p.id);

  return {
    ok: outside.length === 0,
    outside,
  };
}

/**
 * Valide que les pièces utilisant un matériau orienté sont alignées avec l'orientation du matériau.
 * Retourne des warnings (non bloquants) pour les pièces mal alignées.
 */
export function validateMaterialOrientation(scene: SceneDraft): {
  ok: boolean;
  warnings: Array<{ pieceId: ID; materialId: ID; expectedDeg: number; actualDeg: number }>;
} {
  const warnings: Array<{ pieceId: ID; materialId: ID; expectedDeg: number; actualDeg: number }> =
    [];

  for (const p of Object.values(scene.pieces)) {
    const m = scene.materials[p.materialId];
    if (!m) continue;
    if (m.oriented) {
      // congruence à 180° : 0 ≡ 180, 90 ≡ 270
      const expected = (m.orientationDeg ?? 0) % 180;
      const actual = (p.rotationDeg ?? 0) % 180;
      if (expected !== actual) {
        warnings.push({
          pieceId: p.id,
          materialId: m.id,
          expectedDeg: expected,
          actualDeg: actual,
        });
      }
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}
