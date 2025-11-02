import { neighborsForPiece } from "../spatial/rbushIndex";

// margin en mm — rayon de recherche pour proposer des guides de snap
export function getSnapNeighbors(id: string, margin = 12, limit = 16): string[] {
  return neighborsForPiece(id, margin, limit);
}
