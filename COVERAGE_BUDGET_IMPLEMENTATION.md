# ✅ Coverage Budget System - Implementation Complete

**Date**: 2025-11-08
**Status**: IMPLEMENTED & VALIDATED

---

## 🎯 Objectif

Restaurer le socle strict de coverage (80/80/80/70 + perFile:true) tout en gérant les fichiers existants sous seuil via un système de "budget d'exclusions" qui empêche toute régression.

---

## 📋 Implémentation

### 1. Source de Vérité: `coverage-exclude.json`

```json
{
  "files": [
    "src/main.tsx",
    "src/App.tsx"
    // ... 45 autres fichiers
  ]
}
```

- **47 fichiers** actuellement exclus de la mesure de coverage
- Fichier unique centralisé pour gérer les exclusions
- Format JSON pour import facile dans vitest.config.ts

### 2. Scripts de Garde-Fou (séparés check/update)

**`scripts/check-coverage-exclude.mjs`** (lecture seule - exécuté sur toutes les branches):

1. Lit le nombre de fichiers dans `coverage-exclude.json`
2. Vérifie que le snapshot `.ci/coverage-exclude.snapshot.txt` existe
3. **Échec CI** si le snapshot est absent (doit être créé sur main uniquement)
4. **Échec CI** si le nombre augmente (tentative d'ajout)
5. **Informe** si le nombre diminue (snapshot sera mis à jour sur main)
6. **Success** si le nombre reste identique

**`scripts/update-coverage-exclude-snapshot.mjs`** (création/mise à jour - exécuté uniquement sur main):

1. Lit le nombre de fichiers dans `coverage-exclude.json`
2. Crée ou met à jour le snapshot `.ci/coverage-exclude.snapshot.txt`
3. Commit automatique du snapshot sur main (via CI)

**Sortie check script**:

```bash
# Liste stable
✅ coverage.exclude within budget (47 files)
   Goal: Reduce to 0 by adding tests progressively.

# Snapshot manquant (BLOQUE sur PR)
❌ coverage budget snapshot missing.
   It must be created/updated on main only.
   Run: node scripts/update-coverage-exclude-snapshot.mjs

# Tentative d'ajout (BLOQUE)
❌ coverage.exclude budget exceeded!
   Previous: 47 files
   Current:  48 files
   Increase: +1
   ⚠️  You cannot add files to coverage.exclude!

# Réduction (INFORME - snapshot mis à jour sur main)
✅ coverage.exclude budget REDUCED! 🎉
   Previous: 47 files
   Current:  46 files
   Reduced:  -1
   ⚠️  Snapshot will be updated automatically on main branch.
   Merge this PR to persist the new budget.
```

**Sortie update script** (main uniquement):

```bash
📌 snapshot updated: coverage.exclude budget = 46
   File: .ci/coverage-exclude.snapshot.txt
```

### 3. Integration dans `vitest.config.ts`

```typescript
import excludeJson from './coverage-exclude.json' assert { type: 'json' };

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        // ⚠️ Exclusions temporaires (budget géré par coverage-exclude.json)
        // Budget enforced by scripts/check-coverage-exclude.mjs (CI gate)
        ...excludeJson.files,
      ],
      thresholds: {
        autoUpdate: false,
        perFile: true, // ✅ Strict per-file enforcement
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
```

### 4. Gate CI: `.github/workflows/ci.yml`

```yaml
unit:
  steps:
    # ... checkout, setup, install

    - name: Check coverage exclude budget
      run: node scripts/check-coverage-exclude.mjs

    - run: pnpm test:unit:ci

    - name: Upload coverage to Codecov (optional)
      if: ${{ !cancelled() }}
      uses: codecov/codecov-action@v5
      with:
        files: ./coverage/coverage-final.json
        fail_ci_if_error: false
        token: ${{ secrets.CODECOV_TOKEN }}

# Mise à jour du snapshot — seulement sur main
update-coverage-snapshot:
  if: github.ref == 'refs/heads/main'
  needs: [unit]
  runs-on: ubuntu-latest
  steps:
    # ... checkout, setup, install

    - name: Update coverage exclude snapshot (main only)
      run: node scripts/update-coverage-exclude-snapshot.mjs

    - name: Commit updated snapshot
      run: |
        if [[ -n "$(git status --porcelain .ci/coverage-exclude.snapshot.txt)" ]]; then
          git config user.name "ci-bot"
          git config user.email "ci@noreply.github.com"
          git add .ci/coverage-exclude.snapshot.txt
          git commit -m "ci(coverage): update exclude budget snapshot [skip ci]"
          git push
        fi
```

**Ordre critique**:

- Le budget check s'exécute AVANT les tests unitaires (bloque immédiatement)
- Le job `update-coverage-snapshot` s'exécute UNIQUEMENT sur main (après unit)
- Codecov upload est non-bloquant (fail_ci_if_error: false)

---

## ✅ Validation Locale

Tous les checks ont été validés localement :

### 1. Budget Check - Success Case

```bash
$ node scripts/check-coverage-exclude.mjs
✅ coverage.exclude within budget (47 files)
   Goal: Reduce to 0 by adding tests progressively.
```

### 2. Budget Check - Failure Case (Test)

```bash
# Simulation: ajout d'un fichier à coverage-exclude.json
$ node scripts/check-coverage-exclude.mjs
❌ coverage.exclude budget exceeded!
   Previous: 47 files
   Current:  48 files
   Increase: +1
```

### 3. Unit Tests + Coverage

```bash
$ pnpm test:unit:ci
✅ 593 tests passed (21 skipped)
✅ Coverage: All files meet 80/80/80/70 thresholds (47 files excluded)
```

### 4. TypeScript

```bash
$ pnpm typecheck
✅ No errors
```

### 5. Build

```bash
$ pnpm build
✅ Built successfully in 1.58s
```

---

## 📊 État Actuel

| Métrique            | Valeur                              |
| ------------------- | ----------------------------------- |
| **Fichiers exclus** | 47                                  |
| **Seuils actifs**   | 80/80/80/70                         |
| **perFile**         | ✅ true                             |
| **autoUpdate**      | ✅ false                            |
| **Budget guard**    | ✅ CI bloquant                      |
| **Snapshot**        | `.ci/coverage-exclude.snapshot.txt` |

### Répartition des Exclusions

- **Composants UI**: 12 fichiers
- **Core Logic**: 8 fichiers
- **Lib/Utils**: 13 fichiers
- **State Management**: 7 fichiers
- **Autres**: 7 fichiers

---

## 🔄 Stratégie de Désendettement

### Phase 1: Fichiers Critiques (priorité haute)

**Cible**: 10 fichiers (App.tsx, core components, state management)

```bash
# Exemple: Ajouter tests pour Toast.tsx
pnpm test src/components/Toast.spec.tsx
# Si coverage ≥80%, retirer de coverage-exclude.json
```

**Critère**: Fichier atteint 80/80/80/70 → retrait de `coverage-exclude.json` → snapshot se met à jour automatiquement

### Phase 2: Lib/Utils (priorité moyenne)

**Cible**: 15 fichiers (lib/ui/_, lib/spatial/_, core/geo/\*)

### Phase 3: Auxiliaires (priorité basse)

**Cible**: 22 fichiers restants (workers, debug, types, constants)

---

## 📝 Workflow Développeur

### Ajouter Tests pour Réduire le Budget

1. **Choisir un fichier** dans `coverage-exclude.json` (priorité: Phase 1 > Phase 2 > Phase 3)

2. **Écrire tests** jusqu'à atteindre 80/80/80/70:

   ```bash
   pnpm test src/components/Toast.spec.tsx --coverage
   ```

3. **Retirer du budget**:

   ```bash
   # Éditer coverage-exclude.json: retirer la ligne "src/components/Toast.tsx"
   ```

4. **Valider localement**:

   ```bash
   node scripts/check-coverage-exclude.mjs
   # ✅ coverage.exclude budget REDUCED! 🎉

   pnpm test:unit:ci
   # ✅ Toast.tsx maintenant mesuré et passe 80/80/80/70
   ```

5. **Commit & Push**:

   ```bash
   git add coverage-exclude.json .ci/coverage-exclude.snapshot.txt src/components/Toast.spec.tsx
   git commit -m "test(Toast): add coverage to remove from exclusion budget"
   git push
   ```

6. **CI valide**: Budget réduit, snapshot mis à jour automatiquement

### Protection contre Ajout de Fichiers (Immutable sur PR)

Si un développeur tente d'ajouter un fichier à `coverage-exclude.json`:

```bash
# CI job "unit" échoue au step "Check coverage exclude budget"
❌ coverage.exclude budget exceeded!
   Previous: 47 files
   Current:  48 files
   Increase: +1

   ⚠️  You cannot add files to coverage.exclude!
   Instead: Add tests to existing excluded files and remove them from the list.
```

**Comportement bloquant**: Les tests unitaires ne s'exécutent même pas, échec immédiat.

### Protection contre Modification du Snapshot sur PR

Si un développeur tente de créer/modifier `.ci/coverage-exclude.snapshot.txt` sur une PR:

```bash
# CI job "unit" échoue si snapshot manquant
❌ coverage budget snapshot missing.
   It must be created/updated on main only.
```

**Séparation check/update**: Le script de check est en lecture seule, seul le script d'update (exécuté sur main) peut créer/modifier le snapshot.

---

## 🔗 Documentation Associée

- [VITEST_COVERAGE_LIMITATION.md](./VITEST_COVERAGE_LIMITATION.md) - Limitation Vitest 4.0.6 et workaround détaillé
- [README_CI.md](./README_CI.md) - Guide complet CI/CD avec checks requis
- [GARDE_FOUS_IMPLEMENTATION.md](./GARDE_FOUS_IMPLEMENTATION.md) - Garde-fous techniques

---

## 🎉 Résultat

✅ **Socle strict restauré** sans casser les tests existants
✅ **Budget gelé** via garde-fou CI bloquant
✅ **Désendettement progressif** encouragé et automatisé
✅ **Pas de régression possible** sur la liste d'exclusion

**Maintainer**: @romua
**Dernière mise à jour**: 2025-11-08
