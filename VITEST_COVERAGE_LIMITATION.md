# ⚠️ Vitest 4.0.6 - Limitation Coverage Glob Patterns

**Date**: 2025-11-08
**Issue**: Vitest 4.0.6 ne supporte PAS les glob patterns dans `coverage.thresholds`

---

## 🐛 Problème

La documentation Vitest suggère qu'on peut utiliser des glob patterns dans `thresholds` pour appliquer différents seuils par fichier :

```typescript
// ❌ NE FONCTIONNE PAS dans Vitest 4.0.6
coverage: {
  thresholds: {
    lines: 80,
    'src/components/**': { lines: 60 },  // ❌ Ignoré
    'src/lib/**': { lines: 0 }           // ❌ Ignoré
  }
}
```

**Résultat** : Tous les fichiers sont évalués contre le seuil global (80%), les patterns sont ignorés.

**Issue GitHub** : https://github.com/vitest-dev/vitest/issues/4828

---

## ✅ Solution Actuelle (Workaround + Budget Guard)

**Exclusion via `coverage.exclude` avec garde-fou budget** :

```typescript
// vitest.config.ts
import excludeJson from './coverage-exclude.json' assert { type: 'json' };

coverage: {
  exclude: [
    '**/*.test.ts',
    // ⚠️ Exclusions temporaires (budget géré par coverage-exclude.json)
    // Budget enforced by scripts/check-coverage-exclude.mjs (CI gate)
    ...excludeJson.files  // 47 fichiers actuellement
  ],
  thresholds: {
    autoUpdate: false,
    perFile: true,  // ✅ Socle strict 80/80/80/70
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 70
  }
}
```

**Garde-fou Budget** (implémenté 2025-11-08) :

```bash
# scripts/check-coverage-exclude.mjs
# - Lit coverage-exclude.json (source de vérité)
# - Compare au snapshot .ci/coverage-exclude.snapshot.txt
# - Échec CI si tentative d'ajout de fichiers
# - Met à jour snapshot si réduction

# Ajouté dans CI (.github/workflows/ci.yml) avant unit tests :
- name: Check coverage exclude budget
  run: node scripts/check-coverage-exclude.mjs
```

---

## 📊 Impact

| Aspect               | Avant (2025-11-07)           | Après (2025-11-08)                          |
| -------------------- | ---------------------------- | ------------------------------------------- |
| **Fichiers mesurés** | Tous (~120 fichiers)         | ~80 fichiers (47 exclus)                    |
| **Seuils appliqués** | 67/69/67/59 (global abaissé) | 80/80/80/70 (strict)                        |
| **perFile**          | false                        | ✅ true                                     |
| **autoUpdate**       | false                        | ✅ false (garde-fou actif)                  |
| **Budget guard**     | ❌ Aucun                     | ✅ CI bloquant (check-coverage-exclude.mjs) |

**Avantages** :

- Nouveau code DOIT respecter 80/80/80/70, pas de dérive
- Budget gelé : impossible d'ajouter fichiers à la liste d'exclusion
- Source de vérité unique : `coverage-exclude.json`

**Inconvénient** : 47 fichiers exclus ne sont plus mesurés (0% visible dans rapport)

---

## 🔄 Stratégie de Remontée

### Phase 1 : Ajouter tests pour fichiers critiques (priorité haute)

**Cible** : 10 fichiers (App.tsx, core components, state management)

```bash
# Exemple: Ajouter tests pour Toast.tsx
pnpm test src/components/Toast.spec.tsx
# Si coverage ≥80%, retirer de coverage.exclude
```

**Critère** : Fichier atteint 80/80/80/70 → retrait de `exclude`

### Phase 2 : Fichiers lib/utils (priorité moyenne)

**Cible** : 15 fichiers (lib/ui/_, lib/spatial/_, core/geo/\*)

### Phase 3 : Fichiers auxiliaires (priorité basse)

**Cible** : 15 fichiers restants (workers, debug, types)

---

## 📝 Fichiers Exclus (47 total - source: coverage-exclude.json)

### Composants UI (12)

- src/App.tsx
- src/components/DevMetrics.tsx
- src/components/ProblemsPanel.tsx
- src/components/ResizeHandles.tsx
- src/components/ResizeHandlesOverlay.tsx
- src/components/SidebarMaterials.tsx
- src/components/StatusBadge.tsx
- src/components/Toast.tsx
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/ui/debug/DebugNudgeGap.tsx
- src/ui/overlays/GroupResizePreview.tsx

### Core Logic (8)

- src/core/booleans/pathopsAdapter.ts
- src/core/geo/facade.ts
- src/core/geo/geometry.ts
- src/core/geo/transform.ts
- src/core/geo/validateAll.ts
- src/core/snap/candidates.ts
- src/constants/scene.ts
- src/constants/ui.ts

### Lib/Utils (13)

- src/lib/debug/pipelineTrace.ts
- src/lib/env.ts
- src/lib/featureFlags.ts
- src/lib/geom.ts
- src/lib/geom/drag.ts
- src/lib/io/schema.ts
- src/lib/materialUsage.ts
- src/lib/metrics.ts
- src/lib/spatial/globalIndex.ts
- src/lib/typeGuards.ts
- src/lib/typedEntries.ts
- src/lib/ui/keyboardStep.ts
- src/lib/ui/matrix.ts
- src/lib/ui/snap.ts

### State Management (7)

- src/state/ui.guards.ts
- src/state/ui.types.ts
- src/state/useCounter.ts
- src/state/useSceneStore.ts
- src/store/editorStore.ts
- src/store/selectors/gapSelector.ts
- src/store/selectors/selection.ts

### Autres (5)

- src/main.tsx (entry point)
- src/sync/bridge.ts
- src/sync/projector.ts
- src/types/scene.ts
- src/workers/geo.worker.ts
- src/workers/wasm.loader.ts

---

## 🎯 Objectif Final

**Idéal** : 0 fichiers dans `exclude` (sauf tests et .d.ts)

**Réaliste court-terme** : < 20 fichiers exclus

**Réaliste moyen-terme** : < 10 fichiers exclus

---

## 🔗 Références

- [Vitest Coverage Config](https://vitest.dev/config/#coverage)
- [Vitest Issue #4828](https://github.com/vitest-dev/vitest/issues/4828) - Glob patterns not supported
- [Vitest Coverage Thresholds](https://vitest.dev/guide/coverage.html#coverage-thresholds)

---

**Maintainer** : @romua
**Dernière mise à jour** : 2025-11-08
