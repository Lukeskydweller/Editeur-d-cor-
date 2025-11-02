import type { SceneV1, Problem, ProblemCode } from "../contracts/scene";
import { collisionsSameLayer } from "../collision/sat";
import { getRotatedAABB } from "./geometry";

/**
 * Valide tous les aspects fabricabilité de la scène.
 * Retourne un tableau de problèmes (overlap, outside_scene, min_size, etc.)
 */
export function validateAll(scene: SceneV1): Problem[] {
  const problems: Problem[] = [];

  // 1) Overlaps (existant)
  problems.push(...checkOverlapSameLayer(scene));

  // 2) Inside scene bounds
  problems.push(...checkInsideScene(scene));

  // 3) Minimum size
  problems.push(...checkMinSize(scene));

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
