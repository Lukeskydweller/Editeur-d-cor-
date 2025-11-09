# 🔄 CI Refactoring V2 - Retour à une CI Saine

**Date**: 2025-11-08
**Objectif**: Éliminer tous les anti-patterns (`|| true`, `continue-on-error` inappropriés) et implémenter une stratégie E2E smoke/full
**Statut**: ✅ **TERMINÉ**

---

## 🎯 Problèmes Résolus

### ❌ Avant (Anti-patterns)

```yaml
# MAUVAIS: Tests E2E contournés
- run: pnpm -s test:e2e:ci || pnpm -s test:e2e || true  # ❌ Jamais en échec

# MAUVAIS: Tests unitaires contournés
unit:
  continue-on-error: true  # ❌ Tests peuvent échouer silencieusement

# MAUVAIS: Lint trop permissif
- run: pnpm lint || true  # ❌ Pas de signal sur problèmes
```

**Conséquences:**

- ✗ Régressions E2E passent inaperçues
- ✗ Tests unitaires échouent sans bloquer
- ✗ Aucun feedback sur qualité code

### ✅ Après (Stratégie Saine)

```yaml
# BON: Smoke tests bloquants
e2e-smoke:
  - run: npx playwright test --grep="@smoke"  # ✅ Bloque si échec

# BON: Tests unitaires bloquants
unit:
  - run: pnpm test:unit:ci  # ✅ Bloque si échec ou coverage < seuils

# BON: Lint informatif (non-bloquant justifié)
lint:
  continue-on-error: true  # ✅ Signale sans bloquer (436 warnings existants)
  - run: pnpm lint --max-warnings=-1
```

---

## 📋 Changements Implémentés

### 1. CI Principal (.github/workflows/ci.yml)

**✅ REFACTORISÉ COMPLÈTEMENT**

| Job       | Before                           | After                                 | Raison                   |
| --------- | -------------------------------- | ------------------------------------- | ------------------------ | ----------------------------------------------- | ----------------------------------------- |
| **e2e**   | `                                |                                       | true` partout            | `e2e-smoke` avec `--grep="@smoke"`              | Smoke tests bloquants sur chemin critique |
| **unit**  | `continue-on-error: true`        | Retiré                                | Tests DOIVENT bloquer    |
| **lint**  | `                                |                                       | true`                    | `continue-on-error: true` + `--max-warnings=-1` | Informatif (436 warnings existants)       |
| **build** | `needs: [typecheck, lint, unit]` | `needs: [typecheck, unit, e2e-smoke]` | Build après checks socle |

**Nouveaux jobs:**

```yaml
e2e-smoke:
  timeout-minutes: 20
  steps:
    - run: npx playwright test --grep="@smoke" --reporter=dot
    # ✅ Pas de || true, pas de continue-on-error
```

### 2. E2E Full Suite Nightly (.github/workflows/e2e-full-nightly.yml)

**✨ NOUVEAU WORKFLOW**

```yaml
name: E2E Full (Nightly)
on:
  schedule:
    - cron: '0 3 * * *' # 3h UTC daily
strategy:
  matrix:
    shard: [1, 2, 3] # Sharding 3 workers
steps:
  - run: npx playwright test --retries=1 --shard=${{ matrix.shard }}/3
```

**Avantages:**

- ⚡ Exécution parallélisée (3x plus rapide)
- 🔄 Retries activés (1 retry en CI)
- 🎯 Tests complets sans ralentir PRs
- 📊 Rapports mergés en artifact

### 3. Playwright Config (playwright.config.ts)

**✅ OPTIMISÉ**

```typescript
export default defineConfig({
  retries: process.env.CI ? 1 : 0, // ✅ 1 retry en CI
  use: {
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure', // ✅ Optimisé
  },
});
```

**Recommandations Playwright appliquées:**

- `retries: 1` pour tests flaky [Source](https://playwright.dev/docs/test-retries)
- `trace: 'on-first-retry'` pour économie espace disque [Source](https://playwright.dev/docs/trace-viewer)

### 4. Tests Smoke (e2e/smoke.spec.ts)

**✨ NOUVEAU FICHIER**

```typescript
test('@smoke app loads and renders canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('svg[data-testid="scene-canvas"]')).toBeVisible();
});

test('@smoke can add a rectangle piece', async ({ page }) => {
  // ...
});

test('@smoke can select and delete piece', async ({ page }) => {
  // ...
});
```

**Critères smoke tests:**

- ✅ < 5 tests (chemin critique uniquement)
- ✅ < 2min d'exécution totale
- ✅ Tagués `@smoke` pour grep
- ✅ Bloquants sur chaque PR

---

## 📊 Comparaison Before/After

| Aspect                | Before                                      | After                               | Amélioration                             |
| --------------------- | ------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| **E2E sur PR**        | Tous tests (~20min), contournés `\|\| true` | Smoke uniquement (~2min), bloquants | ⚡ 10x plus rapide, ✅ vraiment bloquant |
| **E2E complets**      | Jamais exécutés (trop lents)                | Nightly avec sharding 3x            | 🎯 Coverage complet sans ralentir        |
| **Tests unit**        | `continue-on-error: true`                   | Bloquants                           | ✅ Régressions détectées                 |
| **Lint**              | `\|\| true` (silencieux)                    | `continue-on-error` (signale)       | ⚠️ Feedback visible sans bloquer         |
| **Traces Playwright** | `retain-on-failure` toujours                | `on-first-retry` en CI              | 💾 Économie espace disque                |
| **Retries**           | 0 (tests flaky échouent)                    | 1 en CI                             | 🔄 Robustesse améliorée                  |

---

## ✅ Checks Bloquants (Branch Protection)

**À cocher dans Settings → Branches:**

| Check       | Bloquant | Commande                                |
| ----------- | -------- | --------------------------------------- |
| `typecheck` | ✅ OUI   | `pnpm typecheck`                        |
| `unit`      | ✅ OUI   | `pnpm test:unit:ci` (coverage per-file) |
| `e2e-smoke` | ✅ OUI   | `npx playwright test --grep="@smoke"`   |
| `build`     | ✅ OUI   | `pnpm build`                            |

**⚠️ Ne PAS cocher:**

- `lint` (informatif, `continue-on-error: true`)

---

## 🎓 Principes Appliqués

### 1. Jamais de `|| true` sur tests

**❌ MAUVAIS:**

```bash
pnpm test || true  # Test peut échouer silencieusement
```

**✅ BON:**

```bash
pnpm test  # Échec = exit code 1 = CI rouge
```

### 2. `continue-on-error` uniquement pour informatif

**❌ MAUVAIS:**

```yaml
unit:
  continue-on-error: true # Tests critiques ne doivent pas être contournés
```

**✅ BON:**

```yaml
lint:
  continue-on-error: true # OK: lint informatif pendant transition
```

### 3. Stratégie smoke/full pour E2E

**❌ MAUVAIS:**

```yaml
e2e:
  - run: playwright test # Trop lent sur PR (~20min)
  - run: ... || true # Ou contourné pour ne pas ralentir
```

**✅ BON:**

```yaml
e2e-smoke: # Sur PR
  - run: playwright test --grep="@smoke" # < 2min, bloquant

e2e-full: # Nightly
  - run: playwright test --shard=${{matrix.shard}}/3 # Complet + shardé
```

### 4. Traces optimisées en CI

**❌ MAUVAIS:**

```typescript
trace: 'on'; // Toujours = explosion espace disque
```

**✅ BON:**

```typescript
trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure';
```

---

## 📖 Documentation Mise à Jour

| Fichier                          | Changements                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| **README_CI.md**                 | + Section "E2E Strategy" (smoke vs full)<br>+ Tableau checks avec colonne "Bloquant" |
| **BRANCH_PROTECTION_SETUP.md**   | + Note "Ne PAS cocher lint"<br>+ 4 checks au lieu de 5                               |
| **GARDE_FOUS_IMPLEMENTATION.md** | + Section refactoring CI<br>+ E2E strategy expliquée                                 |
| **CI_REFACTORING_V2.md**         | ✨ Ce document (nouveau)                                                             |

---

## 🧪 Validation Finale

```bash
# 1. TypeCheck
pnpm typecheck
# ✅ 0 erreur TypeScript

# 2. Build
pnpm build
# ✅ Build réussi

# 3. Tests unitaires
pnpm test:unit:ci
# ✅ 593/593 passing + coverage ≥80% per-file

# 4. Smoke tests (local)
npx playwright test --grep="@smoke"
# ✅ 4/4 tests passing < 2min
```

---

## 🚀 Prochaines Étapes

1. **Activer Branch Protection**
   - Cocher 4 checks: `typecheck`, `unit`, `e2e-smoke`, `build`
   - Ne PAS cocher `lint`

2. **Ajouter plus de smoke tests**
   - Garder < 5 tests totaux
   - Chemin critique uniquement (add, select, delete, rotate, drag)

3. **Observer métriques nightly**
   - E2E full doit passer chaque nuit
   - Retries: observer taux de flakiness

4. **Nettoyer warnings lint**
   - Progressivement réduire les 436 warnings
   - Objectif: passer lint en bloquant (retirer `continue-on-error`)

---

## 📚 Références

- [Playwright Retries](https://playwright.dev/docs/test-retries)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright Sharding](https://playwright.dev/docs/test-sharding)
- [GitHub Actions continue-on-error](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idcontinue-on-error)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

---

## ✅ Résumé

**Avant:** CI avec anti-patterns (`|| true`, `continue-on-error` partout) → tests contournés, régressions passent

**Après:** CI saine avec stratégie smoke/full → 4 checks bloquants, E2E rapides sur PR, suite complète nightly

**Impact:**

- ⚡ PRs 10x plus rapides (2min smoke vs 20min full)
- ✅ Vraies protections (pas de contournement)
- 🎯 Coverage E2E complet (nightly shardé)
- 📊 Feedback lint conservé (informatif)

---

**Maintainer**: @romua
**Dernière mise à jour**: 2025-11-08
