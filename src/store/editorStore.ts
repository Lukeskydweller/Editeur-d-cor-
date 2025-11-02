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

// --- Validation UI state (problems overlap) ---
type UIProblems = { hasBlock: boolean; conflicts: Set<string> };
let uiProblems: UIProblems = { hasBlock: false, conflicts: new Set() };
let _validateTimer: any = null;
let _debounceMs = 100;
const listeners = new Set<() => void>();

export function __setValidationDebounceForTests(ms: number) { _debounceMs = ms; }

async function runValidation() {
  try {
    const probs = await geo.validateOverlapsAsync(state);
    const conflictIds = new Set<string>();
    let hasBlock = false;
    for (const p of probs) {
      if (p.severity === "BLOCK") hasBlock = true;
      if (p.pieceId) conflictIds.add(p.pieceId);
      if (p.meta?.otherPieceId) conflictIds.add(String(p.meta.otherPieceId));
    }
    uiProblems = { hasBlock, conflicts: conflictIds };
    notifyListeners();
  } catch (e) {
    console.error("Validation failed:", e);
  }
}

function scheduleValidation() {
  if (_validateTimer) clearTimeout(_validateTimer);
  _validateTimer = setTimeout(runValidation, _debounceMs);
}

function notifyListeners() {
  for (const l of listeners) l();
}

export function selectProblems(): UIProblems {
  return uiProblems;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

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
        p.x += cmd.dx; p.y += cmd.dy;
        scheduleValidation();
        break;
      }
      case "rotatePiece": {
        const p = state.pieces.find(p=>p.id===cmd.id); if (!p) return;
        p.rot = cmd.deg;
        scheduleValidation();
        break;
      }
      // autres commandes : no-op pour l'instant (contrat figé)
      default: break;
    }
    if ("id" in cmd && typeof (cmd as any).id === "string") {
      updatePiece((cmd as any).id);
      // Async "fire and forget" pour le worker (si dispo)
      geo.updatePiece((cmd as any).id);
    }
    notifyListeners();
  },
  select<T>(selector: (s: SceneV1)=>T): T { return selector(state); }
};

export type { SceneV1 } from "../core/contracts/scene";
