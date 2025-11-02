import { neighborsForPiece } from "../spatial/rbushIndex";
import type { SceneV1 } from "../contracts/scene";

// margin en mm — rayon de recherche pour proposer des guides de snap
export function getSnapNeighbors(id: string, margin = 12, limit = 16): string[] {
  return neighborsForPiece(id, margin, limit);
}

// NEW utilitaire: fromIds(scene, ids) -> renvoie les pièces filtrées par ids
export function piecesFromIds(scene: SceneV1, ids: string[]) {
  const set = new Set(ids);
  return scene.pieces.filter(p => set.has(p.id));
}
