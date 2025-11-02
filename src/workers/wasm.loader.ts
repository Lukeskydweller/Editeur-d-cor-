// Chargeur WASM pour PathOps (pathkit-wasm)
import PathKitInit from "pathkit-wasm";
// Import en tant qu'URL résolue par Vite (copiée dans dist et servie).
import wasmUrl from "pathkit-wasm/bin/pathkit.wasm?url";

export async function loadPathOpsWasm() {
  // Important: fournir locateFile => pointe vers le binaire packagé par Vite.
  // @ts-ignore - PathKitInit accepts init options but types don't reflect it
  const mod = await PathKitInit({
    locateFile: () => wasmUrl,
  });
  return mod;
}
