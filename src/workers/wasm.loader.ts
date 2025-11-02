// Chargeur WASM pour PathOps (pathkit-wasm)
import PathKitInit from "pathkit-wasm";

export async function loadPathOpsWasm() {
  // Chargement différé ; si indisponible, la promesse rejettera et les smokes échoueront
  const PathKit = await PathKitInit();
  return PathKit;
}
