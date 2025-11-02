// Worker "geo" : RBush + SAT + PathOps derrière un petit RPC
import { rebuildIndex as coreRebuild, updatePiece as coreUpdate } from "../core/spatial/rbushIndex";
import { collisionsForPiece as coreCollisions, collisionsSameLayer } from "../core/collision/sat";
import type { SceneV1 } from "../core/contracts/scene";
import { opPolys, booleanOpPolys, type Poly, type Op } from "../core/booleans/pathopsAdapter";

type MsgIn =
  | { id: number; type: "rebuildIndex"; payload: { scene: SceneV1 } }
  | { id: number; type: "updatePiece"; payload: { id: string } }
  | { id: number; type: "collisionsForPiece"; payload: { id: string; margin: number } }
  | { id: number; type: "booleanOp"; payload: { a: Poly; b: Poly; kind: Op } }
  | { id: number; type: "booleanOpPolys"; payload: { a: Poly; b: Poly; kind: Op } }
  | { id: number; type: "validateOverlaps"; payload: {} };
type MsgOut =
  | { id: number; ok: true; result?: any }
  | { id: number; ok: false; error: string };

let sceneRef: SceneV1 | null = null;

function respond(eid: number, ok: boolean, result?: any, error?: string) {
  // @ts-ignore
  postMessage(ok ? ({ id: eid, ok: true, result } as MsgOut) : ({ id: eid, ok: false, error: error || "error" } as MsgOut));
}

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as MsgIn;
  const msgId = msg.id;

  // Handle async booleanOp separately
  if (msg.type === "booleanOp") {
    (async () => {
      try {
        const { a, b, kind } = msg.payload;
        const result = await opPolys(a, b, kind);
        respond(msgId, true, result ? true : false);
      } catch (e: any) {
        respond(msgId, false, undefined, String(e?.message || e));
      }
    })();
    return;
  }

  // Handle async booleanOpPolys separately
  if (msg.type === "booleanOpPolys") {
    (async () => {
      try {
        const { a, b, kind } = msg.payload;
        const polys = await booleanOpPolys(a, b, kind);
        respond(msgId, true, polys);
      } catch (e: any) {
        respond(msgId, false, undefined, String(e?.message || e));
      }
    })();
    return;
  }

  try {
    if (msg.type === "rebuildIndex") {
      sceneRef = msg.payload.scene;
      coreRebuild(sceneRef);
      respond(msgId, true);
      return;
    }
    if (msg.type === "updatePiece") {
      coreUpdate(msg.payload.id);
      respond(msgId, true);
      return;
    }
    if (msg.type === "collisionsForPiece") {
      if (!sceneRef) throw new Error("scene not initialized");
      const res = coreCollisions(sceneRef, msg.payload.id, msg.payload.margin ?? 0);
      respond(msgId, true, res);
      return;
    }
    if (msg.type === "validateOverlaps") {
      if (!sceneRef) throw new Error("scene not initialized");
      const pairs = collisionsSameLayer(sceneRef);
      const problems = pairs.map(([a, b]) => ({
        code: "overlap_same_layer" as const,
        severity: "BLOCK" as const,
        pieceId: a,
        message: "Pieces overlap on the same layer",
        meta: { otherPieceId: b }
      }));
      respond(msgId, true, problems);
      return;
    }
    respond(msgId, false, undefined, "unknown type");
  } catch (e:any) {
    respond(msgId, false, undefined, String(e?.message || e));
  }
};
