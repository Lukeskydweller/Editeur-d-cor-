# 🛡️ CI/CD & Garde-fous - Guide Complet

Ce document décrit tous les garde-fous mis en place pour éviter les régressions et maintenir la qualité du code.

## 📋 Table des Matières

- [Checks CI Requis](#checks-ci-requis)
- [Commandes Locales](#commandes-locales)
- [Branch Protection](#branch-protection)
- [Artifacts & Traces](#artifacts--traces)
- [Coverage & Mutation Testing](#coverage--mutation-testing)
- [ESLint Rules Strictes](#eslint-rules-strictes)
- [Dependabot & Sécurité](#dependabot--sécurité)
- [CODEOWNERS](#codeowners)
- [Workflow de Contribution](#workflow-de-contribution)

---

## ✅ Checks CI Requis

Tous ces checks **DOIVENT** passer avant merge (sauf lint = informatif). Configuration dans `.github/workflows/ci.yml`.

| Check               | Command                                   | Timeout | Artifacts                  | Bloquant      | Description                                 |
| ------------------- | ----------------------------------------- | ------- | -------------------------- | ------------- | ------------------------------------------- |
| **typecheck**       | `pnpm typecheck`                          | 10min   | -                          | ✅ OUI        | 0 erreur TypeScript                         |
| **lint**            | `pnpm lint --max-warnings=-1`             | 10min   | -                          | ⚠️ Informatif | ESLint (continue-on-error)                  |
| **coverage-budget** | `node scripts/check-coverage-exclude.mjs` | 1min    | -                          | ✅ OUI        | Budget exclusions (bloque si liste grandit) |
| **unit**            | `pnpm test:unit:ci`                       | 10min   | `coverage/`                | ✅ OUI        | Tests unitaires + coverage ≥80% per-file    |
| **e2e-smoke**       | `npx playwright test --grep="@smoke"`     | 20min   | `playwright-report-smoke/` | ✅ OUI        | Tests E2E critiques (< 5 tests)             |
| **build**           | `pnpm build`                              | 10min   | -                          | ✅ OUI        | Build production réussi                     |

### E2E Strategy

**Smoke Tests (Bloquant):**

- Tagués `@smoke` dans les specs E2E (via test title: `test('@smoke ...')`)
- Exécutés sur **chaque PR** avec `--grep="@smoke"`
- < 5 tests, chemin critique uniquement
- < 2min d'exécution totale
- Fichier principal: `e2e/smoke.spec.ts`

**Full Suite (Nightly):**

- Workflow séparé: `.github/workflows/e2e-full-nightly.yml`
- Cron: 3h UTC tous les jours
- Sharding 3 workers parallèles
- Retries: 1 en CI
- Traces: `on-first-retry` (optimisé)

**PWREADY Skip Pattern:**

- Tests E2E complets (non-smoke) sont skippés localement sauf si `PWREADY=1`
- Pattern: `test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1')` au début du `describe`
- Doc: [Playwright Conditional Skip](https://playwright.dev/docs/api/class-test#test-skip-1)

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Les runs obsolètes sont annulés automatiquement (économie ressources).

### Cache pnpm

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
```

Installation accélérée via cache automatique.

---

## 💻 Commandes Locales (Miroir CI)

Avant de pusher, exécuter ces commandes localement pour vérifier :

```bash
# Validation complète (équivalent CI)
pnpm validate

# Ou individuellement :
pnpm typecheck          # TypeScript errors = 0
pnpm lint               # ESLint pass
pnpm test:unit          # Tests unitaires
pnpm test:unit:ci       # Tests + coverage
pnpm test:e2e           # Tests E2E (nécessite build)
pnpm build              # Build production
```

### Hooks Git (Husky)

Protection locale automatique :

- **pre-commit** : `lint-staged` (Prettier auto-format sur fichiers modifiés)
- **pre-push** : `pnpm typecheck` (bloque push si erreurs TS)
- **commit-msg** : `commitlint` (format conventionnel)

#### Configuration lint-staged

**Fichier** : `lint-staged.config.js`

```javascript
export default {
  '**/*.{ts,tsx,js,jsx}': (files) => `prettier --write ${files.join(' ')}`,
  '**/*.{css,md,json,yml,yaml}': (files) => `prettier --write ${files.join(' ')}`,
};
```

**Important** : lint-staged n'exécute pas un shell par défaut. Les opérateurs shell (`||`, `&&`, `;`) sont interprétés comme des arguments et provoquent des erreurs. Utiliser la forme fonctionnelle pour construire les commandes avec la liste de fichiers injectée explicitement.

**Documentation** : https://github.com/lint-staged/lint-staged#how-to-use-lint-staged-in-a-multi-package-monorepo

**Stratégie** :

- pre-commit auto-format avec Prettier uniquement (formatage garanti)
- ESLint reste informatif en CI (non-bloquant, continue-on-error: true)
- Évite les échecs de pre-commit sur erreurs ESLint non-auto-fixables

---

## 🔒 Branch Protection

### Configuration Recommandée

**Settings → Branches → Branch protection rules → `main`**

#### ✅ Protections à Activer

1. **Require a pull request before merging**
   - ☑️ Require approvals: `1`
   - ☑️ Dismiss stale reviews when new commits are pushed
   - ☑️ Require review from Code Owners

2. **Require status checks to pass before merging**
   - ☑️ Require branches to be up to date before merging
   - **Status checks requis** (cocher dans la liste) :
     - `typecheck`
     - `lint`
     - `unit`
     - `e2e`
     - `build`

3. **Require conversation resolution before merging**
   - ☑️ All conversations must be resolved

4. **Require linear history**
   - ☑️ (optionnel, selon workflow équipe)

5. **Do not allow bypassing the above settings**
   - ☑️ Cocher pour admins aussi

#### 📸 Vérification

Après config, vérifier dans l'onglet "Checks" d'une PR que tous les checks apparaissent.

---

## 📦 Artifacts & Traces

### Coverage Report

Artifact : `coverage-report` (retention 7 jours)

```bash
# Télécharger depuis GitHub Actions → Run → Artifacts
# Ouvrir coverage/index.html dans navigateur
```

### Playwright Traces

Artifact : `playwright-report` (retention 7 jours)

**Comment déboguer :**

```bash
# Méthode 1 : Trace Viewer en ligne (recommandé)
# 1. Télécharger artifact depuis GitHub Actions
# 2. Ouvrir https://trace.playwright.dev
# 3. Drag & drop le fichier trace.zip

# Méthode 2 : Local
pnpm exec playwright show-report playwright-report
```

**⚠️ Sécurité** : Les traces contiennent screenshots et DOM. Ne pas les partager publiquement si données sensibles.

---

## 📊 Coverage & Mutation Testing

### Coverage Vitest (vitest.config.ts)

```typescript
coverage: {
  exclude: [
    '**/*.d.ts',
    '**/*.{spec,test}.{ts,tsx}',
    // ⚠️ Exclusions temporaires (budget géré par coverage-exclude.json)
    // Budget enforced by scripts/check-coverage-exclude.mjs (CI gate)
    ...excludeJson.files  // 47 fichiers actuellement
  ],
  thresholds: {
    autoUpdate: false,     // ✅ Jamais auto-update (évite dérive)
    perFile: true,         // ✅ Strict per-file enforcement
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 70
  }
}
```

**Statut actuel (2025-11-08):**

- ✅ **Socle strict restauré** : 80/80/80/70 + `perFile: true`
- ✅ **Budget d'exclusions** : 47 fichiers dans `coverage-exclude.json`
  - Gel via script `scripts/check-coverage-exclude.mjs` (CI bloquant)
  - Snapshot dans `.ci/coverage-exclude.snapshot.txt`
  - Échec CI si tentative d'ajout de fichiers à la liste
- ⚠️ **Limitation Vitest 4.0.6** : Glob patterns non supportés dans `thresholds` (GitHub issue #4828)
  - Workaround : Exclusion complète via `coverage.exclude`
  - Doc détaillée : [VITEST_COVERAGE_LIMITATION.md](./VITEST_COVERAGE_LIMITATION.md)
- 📝 **Stratégie de remontée** : 3 phases documentées dans VITEST_COVERAGE_LIMITATION.md
  - Phase 1 : Fichiers critiques (App.tsx, core components, state management)
  - Phase 2 : Lib/utils (core/geo/_, lib/ui/_, lib/spatial/\*)
  - Phase 3 : Auxiliaires (workers, debug, types)
- ✅ `include`: `src/**/*.{ts,tsx}` (sauf tests)
- ✅ `autoUpdate: false` garde-fou actif (pas de dérive)

**Objectif** : Réduire progressivement les 47 exclusions vers 0

### Mutation Testing (Stryker)

**Workflow** : `.github/workflows/mutation-testing.yml`

- 🕐 Cron : Tous les jours à 2h UTC (non-bloquant)
- 📊 Seuils configurables : `stryker.conf.json`
  - `high`: 80%
  - `low`: 60%
  - `break`: 50% (échec CI)

**Rapport** : Artifact `mutation-report` (retention 14 jours)

```bash
# Lancer localement (long ~30-60min)
pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner
pnpm stryker run
```

---

## 🚨 ESLint Rules Strictes

### Rules Activées (.eslintrc.cjs)

```javascript
rules: {
  // Type safety (ERROR = bloquant)
  '@typescript-eslint/consistent-type-imports': ['error', {
    prefer: 'type-imports',
    fixStyle: 'separate-type-imports'
  }],
  '@typescript-eslint/no-explicit-any': ['error', {
    ignoreRestArgs: false,
    fixToUnknown: false
  }],
}
```

#### Justification `any`

Si `any` nécessaire (frontière lib, legacy), **justifier en commentaire 1-ligne** :

```typescript
// any: legacy Playwright API doesn't expose proper types
const resizingExtended = resizing as any;
```

#### Auto-fix

```bash
pnpm lint --fix  # Corrige consistent-type-imports automatiquement
```

---

## 🔐 Dependabot & Sécurité

### Dependabot (.github/dependabot.yml)

**NPM** : Mise à jour hebdomadaire (lundi)

- Groupes : dev-dependencies, react-ecosystem, testing, linting, build-tools
- Limit : 10 PR max ouvertes simultanément

**GitHub Actions** : Mensuel

```bash
# Auto-merge dépendances mineures (si checks verts)
gh pr merge <PR#> --auto --squash
```

### CodeQL (.github/workflows/codeql.yml)

- 🔍 Scan sécurité JavaScript/TypeScript
- 🕐 Hebdomadaire (lundi 6h UTC) + chaque push/PR
- 📊 Résultats : Security → Code scanning alerts

**Actions en cas d'alerte :**

1. Vérifier détails dans Security tab
2. Patcher code ou dépendance
3. Rouvrir PR avec fix

---

## 👥 CODEOWNERS

Fichier : `.github/CODEOWNERS`

**Reviewers obligatoires** pour fichiers critiques :

| Pattern                  | Owner  | Raison                       |
| ------------------------ | ------ | ---------------------------- |
| `/src/state/**`          | @romua | State management sensible    |
| `/src/core/**`           | @romua | Logique métier critique      |
| `/src/core/contracts/**` | @romua | Interface contrat (Piece V1) |
| `/src/types/**`          | @romua | Types centraux               |
| `/.github/**`            | @romua | CI/CD config                 |
| `/package.json`          | @romua | Sécurité dépendances         |

**Effet** : PR ne peut merger sans approval du CODEOWNER.

---

## 🔄 Workflow de Contribution

### 1. Créer branche feature

```bash
git checkout -b feat/ma-fonctionnalite
```

### 2. Développer + tests

```bash
pnpm test:unit  # Vérifier tests passent
pnpm typecheck  # Vérifier types OK
```

### 3. Commit (Husky hooks actifs)

```bash
git add .
git commit -m "feat(core): add new validation rule"
# → pre-commit : lint-staged auto-fix
# → commit-msg : commitlint vérifie format
```

### 4. Push (pre-push hook)

```bash
git push origin feat/ma-fonctionnalite
# → pre-push : typecheck (bloque si erreurs TS)
```

### 5. Ouvrir PR

Template automatique chargé (`.github/PULL_REQUEST_TEMPLATE.md`)

**Remplir checklist** :

- [ ] Tests ajoutés
- [ ] Coverage ≥ seuils
- [ ] Types only si applicable
- [ ] `any` justifiés
- [ ] CODEOWNERS review si nécessaire

### 6. CI Checks

Attendre que tous les checks passent (5 checks requis).

Si échec :

- **E2E** : Télécharger traces (artifact `playwright-report`)
- **Coverage** : Télécharger rapport (artifact `coverage-report`)
- **Lint/TypeScript** : Corriger localement puis push

### 7. Review & Merge

- CODEOWNER approve si fichiers sensibles
- Tous les checks ✅ verts
- Conversations résolues
- Merge autorisé

---

## 🎯 Critères d'Acceptation (Must-Have)

| Critère                              | Status | Vérification                       |
| ------------------------------------ | ------ | ---------------------------------- |
| Merge bloqué si typecheck KO         | ✅     | Branch protection + CI             |
| Merge bloqué si lint KO              | ✅     | Branch protection + CI             |
| Merge bloqué si unit KO              | ✅     | Branch protection + CI             |
| Merge bloqué si e2e KO               | ✅     | Branch protection + CI             |
| Merge bloqué si build KO             | ✅     | Branch protection + CI             |
| Coverage per-file actif              | ✅     | `vitest.config.ts` + CI            |
| Artifacts Playwright présents        | ✅     | CI workflow                        |
| Lint `consistent-type-imports` error | ✅     | `.eslintrc.cjs`                    |
| Lint `no-explicit-any` error         | ✅     | `.eslintrc.cjs`                    |
| PR template actif                    | ✅     | `.github/PULL_REQUEST_TEMPLATE.md` |
| CODEOWNERS effectif                  | ✅     | `.github/CODEOWNERS`               |
| Dependabot actif                     | ✅     | `.github/dependabot.yml`           |
| CodeQL actif                         | ✅     | `.github/workflows/codeql.yml`     |

---

## 📞 Liens Rapides

- [GitHub Actions Runs](../../actions)
- [Security Alerts](../../security)
- [Branch Protection Settings](../../settings/branches)
- [Dependabot PRs](../../pulls?q=is%3Apr+author%3Aapp%2Fdependabot)
- [Playwright Trace Viewer](https://trace.playwright.dev)

---

## 📝 Notes Additionnelles

### Domain Rule: 2 Formats Piece

**ADR** : Architecture Decision Record "Piece models & single conversion point"

**Règle** : Ne jamais mélanger `Piece` (contract) et `Piece` (V1) sans conversion explicite.

```typescript
// ❌ MAUVAIS
const pieceAABB = getRotatedAABB(piece); // piece = draft format

// ✅ BON
const sceneV1 = projectDraftToV1({ scene: draft.scene });
const pieceV1 = sceneV1.pieces.find((p) => p.id === pieceId)!;
const pieceAABB = getRotatedAABB(pieceV1); // pieceV1 = contract format
```

**Protection** : Danger.js peut alerter sur mélange types (à activer si nécessaire).

---

**Dernière mise à jour** : 2025-11-08
**Maintainer** : @romua
