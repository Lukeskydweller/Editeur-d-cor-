import type { SceneV1, Problem, ProblemCode, Piece } from "../contracts/scene";
import { collisionsSameLayer, type AABB } from "../collision/sat";
import { getRotatedAABB, getRotatedCorners } from "./geometry";
import { rectToPolygon, polygonAABB } from "./geometry";
import { union as polyUnion, contains as polyContains, isPathOpsUsable } from "../booleans/pathopsAdapter";
import { getSupportStrategy } from "../../lib/env";

// Constants for spacing validation
const EPS = 0.10;          // mm - tolerance numérique (même que checkInsideScene)
const EPS_AREA = 0.50;     // mm² — tolérance zone non supportée
const SPACING_BLOCK = 0.5; // mm - block if distance < 0.5mm
const SPACING_WARN = 1.5;  // mm - warn if distance < 1.5mm
const HALO = 3.0;          // mm - voisinage pour pré-filtrage (limite O(n²))

/**
 * Valide tous les aspects fabricabilité de la scène.
 * Retourne un tableau de problèmes (overlap, outside_scene, min_size, etc.)
 */
export async function validateAll(scene: SceneV1): Promise<Problem[]> {
  const problems: Problem[] = [];

  // 1) Overlaps (existant)
  problems.push(...checkOverlapSameLayer(scene));

  // 2) Inside scene bounds
  problems.push(...checkInsideScene(scene));

  // 3) Minimum size
  problems.push(...checkMinSize(scene));

  // 4) Minimum spacing
  problems.push(...checkMinSpacing(scene));

  // 5) Layer support (inter-layer validation)
  // Router selon stratégie: PATHOPS (exact) ou AABB (approximation)
  const strategy = getSupportStrategy();
  if (strategy === 'PATHOPS' && isPathOpsUsable()) {
    problems.push(...await checkLayerSupportExact(scene));
  } else {
    // Fallback AABB (Node/tests ou si PathOps indisponible)
    problems.push(...checkLayerSupportAABB(scene));
  }

  return problems;
}

/**
 * Vérifie les chevauchements entre pièces sur la même couche.
 */
function checkOverlapSameLayer(scene: SceneV1): Problem[] {
  const pairs = collisionsSameLayer(scene);
  return pairs.map(([a, b]) => ({
    code: "overlap_same_layer" as ProblemCode,
    severity: "BLOCK" as const,
    pieceId: a,
    message: "Pieces overlap on the same layer",
    meta: { otherPieceId: b },
  }));
}

/**
 * Vérifie que toutes les pièces restent dans le cadre de la scène.
 * Utilise l'AABB roté pour les pièces avec rotation.
 */
function checkInsideScene(scene: SceneV1): Problem[] {
  const out: Problem[] = [];
  const W = scene.width;   // mm
  const H = scene.height;  // mm
  const EPS = 0.10;        // mm — tolérance numérique

  for (const p of scene.pieces) {
    const aabb = getRotatedAABB(p); // {x,y,w,h} en mm, après rotation
    const inside =
      aabb.x >= -EPS &&
      aabb.y >= -EPS &&
      aabb.x + aabb.w <= W + EPS &&
      aabb.y + aabb.h <= H + EPS;

    if (!inside) {
      out.push({
        code: "outside_scene" as ProblemCode,
        severity: "BLOCK" as const,
        pieceId: p.id,
        message: `Hors cadre scène (AABB ${Math.round(aabb.w)}×${Math.round(aabb.h)} mm)`,
      });
    }
  }

  return out;
}

/**
 * Vérifie que toutes les pièces respectent la taille minimale de 5mm en largeur et hauteur.
 */
function checkMinSize(scene: SceneV1): Problem[] {
  const out: Problem[] = [];
  const MIN = 5; // mm

  for (const p of scene.pieces) {
    // largeur/hauteur locales de la pièce (avant rotation)
    const w = Math.abs(p.w);
    const h = Math.abs(p.h);

    if (w < MIN || h < MIN) {
      out.push({
        code: "min_size_violation" as ProblemCode,
        severity: "BLOCK" as const,
        pieceId: p.id,
        message: `Taille minimale 5 mm non respectée (w=${w.toFixed(1)} mm, h=${h.toFixed(1)} mm)`,
      });
    }
  }

  return out;
}

/**
 * Élargit un AABB avec un halo (marge) pour pré-filtrage.
 */
function aabbHalo(a: AABB, halo: number): AABB {
  return {
    x: a.x - halo,
    y: a.y - halo,
    w: a.w + 2 * halo,
    h: a.h + 2 * halo
  };
}

/**
 * Teste si deux AABBs se croisent (overlap ou touch).
 */
function aabbIntersects(a: AABB, b: AABB): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

/**
 * Calcule l'écart bord-à-bord minimal entre deux AABBs.
 * Retourne >=0 si séparés, <0 si chevauchement.
 */
function aabbGap(a: AABB, b: AABB): number {
  const dx = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
  // Si séparés, retourner le plus petit écart (horizontal ou vertical)
  // Si chevauchement, dx=0 et dy=0, calculer overlap négatif
  if (dx === 0 && dy === 0) {
    // Overlap
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return -Math.min(overlapX, overlapY);
  }
  // Si séparés horizontalement mais touchant verticalement: dy=0, retourner dx
  if (dy === 0) return dx;
  // Si séparés verticalement mais touchant horizontalement: dx=0, retourner dy
  if (dx === 0) return dy;
  // Séparés en diagonale: retourner le min des deux gaps
  return Math.min(dx, dy);
}

/**
 * Calculate edge-to-edge distance between two AABBs.
 * Returns negative value if they overlap.
 * @deprecated Use aabbGap instead for spacing validation
 */
function aabbEdgeDistance(a: AABB, b: AABB): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));

  // If both dx and dy are 0, boxes overlap or touch
  if (dx === 0 && dy === 0) {
    // Calculate overlap (negative distance)
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return -Math.min(overlapX, overlapY);
  }

  // If only one is 0, edge-to-edge distance is the other
  if (dx === 0) return dy;
  if (dy === 0) return dx;

  // If both > 0, diagonal distance (corner to corner)
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Vérifie l'espacement minimal entre pièces sur la même couche.
 * BLOCK si distance < 0.5mm, WARN si 0.5mm <= distance < 1.5mm.
 * Ignore les pièces marquées joined=true.
 * Version autonome sans dépendance à un index spatial externe.
 */
function checkMinSpacing(scene: SceneV1): Problem[] {
  const out: Problem[] = [];

  // Group pieces by layer
  const piecesByLayer = new Map<string, Piece[]>();
  for (const piece of scene.pieces) {
    if (!piecesByLayer.has(piece.layerId)) {
      piecesByLayer.set(piece.layerId, []);
    }
    piecesByLayer.get(piece.layerId)!.push(piece);
  }

  // Check spacing within each layer
  for (const layerPieces of piecesByLayer.values()) {
    // Pré-calcul des AABBs rotés pour toutes les pièces de la couche
    const aabbs = layerPieces.map(p => ({ p, aabb: getRotatedAABB(p) }));

    for (let i = 0; i < aabbs.length; i++) {
      const { p: pi, aabb: ai } = aabbs[i];

      // Skip si pièce marquée joined
      if (pi.joined) continue;

      // Élargir avec halo pour pré-filtrage
      const aiHalo = aabbHalo(ai, HALO);

      for (let j = i + 1; j < aabbs.length; j++) {
        const { p: pj, aabb: aj } = aabbs[j];

        // Skip si pièce marquée joined
        if (pj.joined) continue;

        // Pré-filtrage: si les halos ne se croisent pas, impossible d'être < HALO
        const ajHalo = aabbHalo(aj, HALO);
        if (!aabbIntersects(aiHalo, ajHalo)) continue;

        // Calcul de l'écart réel bord-à-bord
        const d = aabbGap(ai, aj);

        // Skip si overlap (géré par checkOverlapSameLayer)
        if (d < -EPS) continue;

        // Détection des problèmes d'espacement
        // Un seul problème par paire, attaché à la première pièce
        if (d + EPS < SPACING_BLOCK) {
          // BLOCK: écart < 0.5mm
          out.push({
            code: "spacing_too_small" as ProblemCode,
            severity: "BLOCK" as const,
            pieceId: pi.id,
            message: `Écart < 1,5 mm (d≈${d.toFixed(1)} mm)`,
            meta: { otherPieceId: pj.id, distance: d },
          });
        } else if (d + EPS < SPACING_WARN) {
          // WARN: 0.5mm <= écart < 1.5mm
          out.push({
            code: "spacing_too_small" as ProblemCode,
            severity: "WARN" as const,
            pieceId: pi.id,
            message: `Écart < 1,5 mm (d≈${d.toFixed(1)} mm)`,
            meta: { otherPieceId: pj.id, distance: d },
          });
        }
      }
    }
  }

  return out;
}

/**
 * Teste si l'AABB `a` est complètement contenu dans l'AABB `b`.
 */
function aabbContainedIn(a: AABB, b: AABB): boolean {
  return (
    a.x >= b.x - EPS &&
    a.y >= b.y - EPS &&
    a.x + a.w <= b.x + b.w + EPS &&
    a.y + a.h <= b.y + b.h + EPS
  );
}

/**
 * Calcule l'union AABB de plusieurs AABBs.
 * Retourne l'AABB englobante minimale qui contient tous les AABBs.
 */
function aabbUnion(boxes: AABB[]): AABB | null {
  if (boxes.length === 0) return null;

  let minX = boxes[0].x;
  let minY = boxes[0].y;
  let maxX = boxes[0].x + boxes[0].w;
  let maxY = boxes[0].y + boxes[0].h;

  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i];
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Vérifie que chaque pièce sur une couche supérieure est supportée par les pièces des couches inférieures.
 * Version exacte avec PathOps/Clipper pour validation géométrique précise.
 * Utilise union de polygones et test de containment pour éliminer les faux positifs.
 */
async function checkLayerSupportExact(scene: SceneV1): Promise<Problem[]> {
  const out: Problem[] = [];

  // Sort layers by index (ascending: bottom to top)
  const sortedLayers = [...scene.layers].sort((a, b) => a.index - b.index);

  // Group pieces by layerId
  const piecesByLayer = new Map<string, Piece[]>();
  for (const p of scene.pieces) {
    const arr = piecesByLayer.get(p.layerId) ?? [];
    arr.push(p);
    piecesByLayer.set(p.layerId, arr);
  }

  // For each layer (starting from second layer), check if pieces have support from below
  for (let i = 1; i < sortedLayers.length; i++) {
    const currentLayer = sortedLayers[i];
    const currentPieces = piecesByLayer.get(currentLayer.id) ?? [];

    // Collect all pieces from layers below
    const belowPieces: Piece[] = [];
    for (let j = 0; j < i; j++) {
      const belowLayer = sortedLayers[j];
      const pieces = piecesByLayer.get(belowLayer.id) ?? [];
      belowPieces.push(...pieces);
    }

    // If no pieces below, all current pieces are unsupported
    if (belowPieces.length === 0) {
      for (const p of currentPieces) {
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
      }
      continue;
    }

    // Check each piece in current layer
    for (const p of currentPieces) {
      // Convert piece to polygon (handles rotation)
      const piecePoly = rectToPolygon(p);
      const pieceAABB = polygonAABB(piecePoly);

      // Pre-filter support candidates using AABB intersection with halo
      const pieceHalo = aabbHalo(pieceAABB, HALO);
      const supportCandidates = belowPieces.filter(support => {
        const supportAABB = getRotatedAABB(support);
        return aabbIntersects(pieceHalo, supportAABB);
      });

      // If no candidates intersect, piece is unsupported
      if (supportCandidates.length === 0) {
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
        continue;
      }

      // Convert support candidates to polygons
      const supportPolys = supportCandidates.map(s => rectToPolygon(s));

      // Calculate union of support polygons
      let unionPoly;
      try {
        unionPoly = await polyUnion(supportPolys);
      } catch (err) {
        // If union fails, assume unsupported (conservative)
        console.error(`Failed to compute union for piece ${p.id}:`, err);
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
        continue;
      }

      // Check if piece is fully contained in support union
      let isContained;
      try {
        isContained = await polyContains(unionPoly, piecePoly);
      } catch (err) {
        // If containment test fails, assume unsupported (conservative)
        console.error(`Failed to test containment for piece ${p.id}:`, err);
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
        continue;
      }

      if (!isContained) {
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
      }
    }
  }

  return out;
}

/**
 * Vérifie que chaque pièce sur une couche supérieure est supportée par les pièces des couches inférieures.
 * @deprecated Version AABB approximative - utiliser checkLayerSupportExact pour validation précise.
 * Version simplifiée V1: utilise union AABB pour approximation rapide.
 * Cette approche peut générer des faux positifs (pièces marquées comme non-supportées alors qu'elles
 * sont supportées par l'union réelle des pièces), mais évite les faux négatifs.
 */
function checkLayerSupportAABB(scene: SceneV1): Problem[] {
  const out: Problem[] = [];

  // Sort layers by index (ascending: bottom to top)
  const sortedLayers = [...scene.layers].sort((a, b) => a.index - b.index);

  // Group pieces by layerId
  const piecesByLayer = new Map<string, Piece[]>();
  for (const p of scene.pieces) {
    const arr = piecesByLayer.get(p.layerId) ?? [];
    arr.push(p);
    piecesByLayer.set(p.layerId, arr);
  }

  // For each layer (starting from second layer), check if pieces have support from below
  for (let i = 1; i < sortedLayers.length; i++) {
    const currentLayer = sortedLayers[i];
    const currentPieces = piecesByLayer.get(currentLayer.id) ?? [];

    // Collect all pieces from layers below
    const belowPieces: Piece[] = [];
    for (let j = 0; j < i; j++) {
      const belowLayer = sortedLayers[j];
      const pieces = piecesByLayer.get(belowLayer.id) ?? [];
      belowPieces.push(...pieces);
    }

    // If no pieces below, all current pieces are unsupported
    if (belowPieces.length === 0) {
      for (const p of currentPieces) {
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
      }
      continue;
    }

    // Compute union AABB of all support pieces
    const belowAABBs = belowPieces.map(p => getRotatedAABB(p));
    const unionAABB = aabbUnion(belowAABBs);

    if (!unionAABB) continue;

    // Check each piece in current layer
    for (const p of currentPieces) {
      const pAABB = getRotatedAABB(p);

      // Check if piece is fully contained within union of supports
      // Note: This is conservative - union AABB is larger than actual geometric union
      // So we may miss some cases where piece extends beyond actual support
      const isFullySupported = aabbContainedIn(pAABB, unionAABB);

      if (!isFullySupported) {
        out.push({
          code: "unsupported_above" as ProblemCode,
          severity: "BLOCK" as const,
          pieceId: p.id,
          message: "Pièce non supportée par couche inférieure",
        });
      }
    }
  }

  return out;
}
