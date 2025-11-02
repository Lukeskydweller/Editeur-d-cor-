# E2E PathOps (Playwright) — Notes d'exécution

- Par défaut, les tests E2E PathOps sont **skippés** si l'environnement navigateur n'est pas prêt (WSL sans deps).
- Pour les activer : installez les navigateurs et dépendances système Playwright puis lancez :
  - `pnpm exec playwright install`
  - (Linux/WSL) `sudo pnpm exec playwright install-deps`
  - `pnpm run test:e2e:ready`  (active PWREADY=1)

Sans ces prérequis, la suite E2E reste skip, mais les smokes et Vitest assurent la couverture minimale (import & intégration worker).
