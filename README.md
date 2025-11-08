# Éditeur Décor WYSIWYG

[![CI](https://github.com/Lukeskydweller/Editeur-d-cor-/actions/workflows/ci.yml/badge.svg)](https://github.com/Lukeskydweller/Editeur-d-cor-/actions/workflows/ci.yml)

Éditeur WYSIWYG pour conception de décors muraux avec validation fabricabilité temps réel.

## Stack

- **React 19** + **TypeScript 5.9** (strict mode)
- **Vite 7** + **Vitest 4** (tests unitaires + coverage)
- **Playwright** (tests E2E)
- **Zustand** (state management)
- **RBush** (spatial indexing) + **SAT.js** (collision detection)
- **PathKit WASM** (opérations booléennes exactes)

## Qualité & CI

### Badge CI

Le badge ci-dessus montre le statut de la CI. Les 5 jobs suivants s'exécutent en parallèle :

- **typecheck** : vérification types TypeScript (`pnpm typecheck`)
- **lint** : ESLint + règles strictes (`pnpm lint`)
- **unit** : tests unitaires Vitest avec coverage ≥80% (`pnpm test:unit:ci`)
- **e2e** : tests Playwright end-to-end (`PWREADY=1 playwright test`)
- **build** : build production (`pnpm build`)

### Commande de validation locale

Avant de pousser du code, exécutez :

```bash
pnpm validate
```

Cette commande lance séquentiellement : `typecheck` → `lint` → `test:unit` → `build`.

### Validation locale (miroir de la CI)

Pour reproduire exactement ce que la CI va exécuter :

```bash
pnpm validate && pnpm test:unit:ci && pnpm test:e2e
```

Cette commande complète valide :

- Types TypeScript (typecheck)
- Qualité code (lint)
- Tests unitaires avec coverage ≥80% (test:unit:ci)
- Build production (build)
- Tests E2E Playwright (test:e2e)

### Hooks Git (Husky)

Trois hooks sont actifs pour prévenir les régressions :

#### 1. **pre-commit** (lint-staged)

Exécute automatiquement avant chaque commit :

```bash
# Sur fichiers staged uniquement
- eslint --fix (fichiers .ts/.tsx/.js/.jsx)
- prettier --write (tous fichiers)
```

#### 2. **pre-push** (typecheck + tests)

Exécute avant chaque push :

```bash
pnpm typecheck && pnpm test --run
```

Bloque le push si :

- Erreurs TypeScript détectées
- Tests unitaires échouent

#### 3. **commit-msg** (commitlint)

Vérifie le format du message de commit selon **Conventional Commits** :

```bash
pnpm commitlint --edit "$1"
```

### Format Conventional Commits

Tous les commits doivent respecter le format :

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types autorisés :**

- `feat`: nouvelle fonctionnalité
- `fix`: correction de bug
- `docs`: documentation uniquement
- `style`: formatting, point-virgules manquants, etc.
- `refactor`: refactoring code (ni feat ni fix)
- `perf`: amélioration performance
- `test`: ajout/correction tests
- `chore`: maintenance (deps, config, etc.)
- `ci`: modifications CI/CD

**Exemples valides :**

```bash
git commit -m "feat(layers): add C3 layer support with PathOps validation"
git commit -m "fix(snap): correct collision detection for rotated pieces"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(resize): add coverage for isotropic group resize"
```

**Exemples invalides (rejetés par hook) :**

```bash
git commit -m "updated stuff"              # ❌ pas de type
git commit -m "Feature: added layers"      # ❌ majuscule interdite
git commit -m "fix: bug."                  # ❌ point final interdit
```

### Coverage Tests

Les seuils de couverture sont définis dans `vite.config.ts` :

```ts
coverage: {
  thresholds: {
    lines: 80,       // ≥80% lignes
    functions: 80,   // ≥80% fonctions
    statements: 80,  // ≥80% instructions
    branches: 70,    // ≥70% branches
  }
}
```

La CI échoue si le coverage descend sous ces seuils.

### Scripts disponibles

| Commande            | Description                                         |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | Serveur dev Vite (HMR, port 5173)                   |
| `pnpm build`        | Build production (typecheck + vite build)           |
| `pnpm typecheck`    | Vérification types TS (noEmit)                      |
| `pnpm lint`         | ESLint (détecte any, unused vars)                   |
| `pnpm fix`          | ESLint --fix (auto-correct)                         |
| `pnpm format`       | Prettier --write                                    |
| `pnpm test`         | Tests unitaires Vitest (watch mode)                 |
| `pnpm test:unit`    | Tests unitaires run                                 |
| `pnpm test:unit:ci` | Tests + coverage (CI)                               |
| `pnpm test:e2e`     | Tests E2E Playwright                                |
| `pnpm test:e2e:ci`  | Tests E2E (reporter dot, CI)                        |
| `pnpm validate`     | **Validation complète** (typecheck+lint+test+build) |
| `pnpm doctor`       | Healthcheck environnement                           |

## Installation

```bash
# Installer pnpm si absent
npm install -g pnpm

# Installer dépendances
pnpm install

# Installer navigateurs Playwright
pnpm exec playwright install --with-deps chromium

# Lancer dev
pnpm dev
```

## Tests

```bash
# Tests unitaires (watch)
pnpm test

# Tests unitaires + coverage
pnpm test:unit:ci

# Tests E2E
PWREADY=1 pnpm test:e2e

# Validation complète
pnpm validate
```

## Documentation

- [Rapport de reprise projet](./RAPPORT_REPRISE_PROJET.md)
- [Contrats API Scene v1](./docs/contracts.md)
- [Configuration seuils validation](./docs/CONFIGURATION.md)
- [Debug report](./docs/DEBUG_REPORT.md)
- [Notes E2E](./docs/e2e-notes.md)

## Architecture

Voir [RAPPORT_REPRISE_PROJET.md](./RAPPORT_REPRISE_PROJET.md) pour :

- Diagrammes Mermaid (flux données, machine états)
- Arborescence détaillée commentée
- Alignement cahier des charges
- Plan d'action 2 sprints

## License

Privé
