// Vérifie que "pathkit-wasm" est bien présent
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // Vérifier que le package existe
  const packagePath = join(__dirname, "..", "node_modules", "pathkit-wasm", "package.json");
  if (!existsSync(packagePath)) {
    console.error("pathkit-wasm not found in node_modules");
    process.exit(2);
  }

  // Vérifier que le fichier WASM existe
  const wasmPath = join(__dirname, "..", "node_modules", "pathkit-wasm", "bin", "pathkit.wasm");
  if (!existsSync(wasmPath)) {
    console.error("pathkit.wasm binary not found");
    process.exit(3);
  }

  console.log("verify-pathops ok");
  process.exit(0);
} catch (e) {
  console.error("verify-pathops failed:", e && e.message ? e.message : e);
  process.exit(1);
}
