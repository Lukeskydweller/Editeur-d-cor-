import { SceneV1 } from "../core/contracts/scene";
import { minScene } from "../core/examples/minScene";
import { rebuildIndex, updatePiece } from "../core/spatial/rbushIndex";
import * as geo from "../core/geo/facade";

type Command =
  | { type: "movePiece"; id: string; dx: number; dy: number }
  | { type: "rotatePiece"; id: string; deg: 0|90|180|270 }
  | { type: "scalePiece"; id: string; dw: number; dh: number; anchor?: "nw"|"ne"|"sw"|"se" }
  | { type: "duplicatePiece"; id: string }
  | { type: "deletePiece"; id: string }
  | { type: "setLayer"; id: string; layerId: string }
  | { type: "setMaterial"; id: string; materialId: string }
  | { type: "attachPieces"; aId: string; bId: string }
  | { type: "detachAttachment"; aId: string; bId: string }
  | { type: "commitGhost" }
  | { type: "rollbackGhost" };

let state: SceneV1 = structuredClone(minScene);
rebuildIndex(state);
geo.init(state);

export const editorStore = {
  getState(): SceneV1 { return state; },
  dispatch(cmd: Command): void {
    // NOTE: impl minimale, à compléter dans prochaines étapes.
    switch (cmd.type) {
      case "movePiece": {
        const p = state.pieces.find(p=>p.id===cmd.id); if (!p) return;
        p.x += cmd.dx; p.y += cmd.dy; break;
      }
      case "rotatePiece": {
        const p = state.pieces.find(p=>p.id===cmd.id); if (!p) return;
        p.rot = cmd.deg; break;
      }
      // autres commandes : no-op pour l'instant (contrat figé)
      default: break;
    }
    if ("id" in cmd && typeof (cmd as any).id === "string") {
      updatePiece((cmd as any).id);
      // Async "fire and forget" pour le worker (si dispo)
      geo.updatePiece((cmd as any).id);
    }
  },
  select<T>(selector: (s: SceneV1)=>T): T { return selector(state); }
};

export type { SceneV1 } from "../core/contracts/scene";
