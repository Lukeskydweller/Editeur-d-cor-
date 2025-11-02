# E2E PathOps (Playwright) — Notes d'exécution

- Par défaut, les tests E2E PathOps sont **skippés** si l'environnement navigateur n'est pas prêt (WSL sans deps).
- Pour les activer : installez les navigateurs et dépendances système Playwright puis lancez :
  - `pnpm exec playwright install`
  - (Linux/WSL) `sudo pnpm exec playwright install-deps`
  - `pnpm run test:e2e:ready`  (active PWREADY=1)

## Démarrage auto du serveur (webServer)
- Playwright démarre maintenant `vite preview --host 0.0.0.0 --port 5173` **automatiquement** avant les tests E2E.
- Si un serveur tourne déjà, il est réutilisé (`reuseExistingServer: true`).
- `baseURL` = `http://localhost:5173` → `page.goto("/")` fonctionne.
- Serveur preview: http://localhost:5173

## Scripts pratiques
- `pnpm run e2e:preview:start` : lance le serveur preview sur 5173 manuellement (optionnel).
- `pnpm run e2e:preview:stop`  : libère les ports 5173/4173 si besoin.

## WASM PathKit (bundling Vite)
- Le binaire est désormais importé via `?url` et servi depuis `dist/`.
- `wasm.loader.ts` fournit `locateFile: () => wasmUrl`, garantissant le chargement en preview/prod.
- Les E2E PWREADY=1 valident l'exécution réelle du WASM dans le navigateur.

## Geo Worker Initialization & Store Sync (Overlap E2E)
- `window.__waitGeoReady()` (dev/preview only) garantit que le geo worker est initialisé avant les tests.
- **Bridge Draft→V1** : `startValidationBridge()` synchronise automatiquement useSceneStore → editorStore.
  - editorStore (SceneV1) gère la validation avec geo worker (utilisé par StatusBadge/ProblemsPanel)
  - useSceneStore (SceneDraft) gère l'état UI principal (utilisé par App.tsx)
  - Le bridge projette Draft→V1 avec debounce 75ms et trigger validation automatiquement
- **Affichage unifié** : seul le système async (editorStore + worker) est utilisé. StatusBadge et ProblemsPanel sont la source autoritative.
  - L'ancienne bannière de validation sync a été supprimée
  - Plus de double affichage : validation uniquement via editorStore + worker
- Le test E2E overlap fonctionne maintenant car les stores sont synchronisés en continu.

Sans ces prérequis, la suite E2E reste skip, mais les smokes et Vitest assurent la couverture minimale (import & intégration worker).
