import type { SceneV1, Problem } from "../contracts/scene";
import { rebuildIndex as coreRebuild, updatePiece as coreUpdate } from "../spatial/rbushIndex";
import { collisionsForPiece as coreCollisions } from "../collision/sat";
import type { Poly, Op } from "../booleans/pathopsAdapter";
import { validateAll } from "./validateAll";

let useWorker = false;
let reqId = 1;
let worker: Worker | null = null;
const pending = new Map<number, (v:any)=>void>();

function post<T>(type: string, payload: any): Promise<T> {
  if (!useWorker || !worker) {
    // Fallback synchrone pour les tests Node/Vitest
    if (type === "rebuildIndex") { coreRebuild(payload.scene as SceneV1); return Promise.resolve(undefined as any); }
    if (type === "updatePiece") { coreUpdate(payload.id as string); return Promise.resolve(undefined as any); }
    if (type === "collisionsForPiece") {
      const { scene, id, margin } = payload;
      const res = coreCollisions(scene as SceneV1, id as string, margin ?? 0);
      return Promise.resolve(res as any);
    }
    return Promise.reject(new Error("unknown type"));
  }
  const id = reqId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, type, payload });
    const to = setTimeout(() => {
      pending.delete(id);
      reject(new Error("geo worker timeout"));
    }, 10_000);
    // @ts-ignore
    worker!._lastTimer = to;
  });
}

export function init(scene: SceneV1) {
  try {
    // @ts-ignore
    if (typeof Worker !== "undefined") {
      // Vite: import.meta.url pour workers de type module
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      worker = new Worker(new URL("../../workers/geo.worker.ts", import.meta.url), { type: "module" });
      useWorker = true;
      worker.onmessage = (ev: MessageEvent<{id:number; ok:boolean; result?:any; error?:string}>) => {
        const { id, ok, result, error } = ev.data;
        const res = pending.get(id);
        if (!res) return;
        pending.delete(id);
        // @ts-ignore
        if ((worker as any)._lastTimer) clearTimeout((worker as any)._lastTimer);
        if (!ok) { console.error("[geo.worker] error:", error); res(Promise.reject(new Error(error))); return; }
        res(result);
      };
      // envoyer la scène pour initialiser l'index
      // NB: on passe aussi la scène dans les appels fallback
      // @ts-ignore
      return post<void>("rebuildIndex", { scene });
    }
  } catch { /* ignore: restera en fallback */ }
  // Fallback sans Worker
  coreRebuild(scene);
  return Promise.resolve();
}

export function rebuildIndex(scene: SceneV1) {
  return post<void>("rebuildIndex", { scene });
}
export function updatePiece(id: string) {
  return post<void>("updatePiece", { id });
}
export function collisionsForPieceAsync(scene: SceneV1, id: string, margin = 0) {
  return post<string[]>("collisionsForPiece", { scene, id, margin });
}

// Façade: booleanOpPolys via worker si dispo, sinon fallback direct (si WASM dispo).
export async function booleanOpPolysAsync(a: Poly, b: Poly, kind: Op): Promise<Poly[]> {
  if (useWorker && worker) {
    const id = reqId++;
    return new Promise<Poly[]>((resolve, reject) => {
      pending.set(id, resolve);
      worker!.postMessage({ id, type: "booleanOpPolys", payload: { a, b, kind } });
      const to = setTimeout(() => {
        pending.delete(id);
        reject(new Error("geo worker timeout"));
      }, 10_000);
      // @ts-ignore
      worker!._lastTimer = to;
    });
  }
  const { booleanOpPolys } = await import("../booleans/pathopsAdapter");
  return await booleanOpPolys(a, b, kind);
}

export async function validateOverlapsAsync(scene: SceneV1): Promise<Problem[]> {
  if (useWorker && worker) {
    const id = reqId++;
    return new Promise<Problem[]>((resolve, reject) => {
      pending.set(id, resolve);
      worker!.postMessage({ id, type: "validateOverlaps", payload: {} });
      const to = setTimeout(() => {
        pending.delete(id);
        reject(new Error("geo worker timeout"));
      }, 10_000);
      // @ts-ignore
      worker!._lastTimer = to;
    });
  }
  // Fallback (Node): calcul asynchrone avec validateAll
  return await validateAll(scene);
}
