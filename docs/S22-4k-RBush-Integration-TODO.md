# S22-4k: RBush Integration - Status & TODO

**Date**: 2025-11-09
**Status**: 🟢 Phase 1 (CRUD Hooks) Complete | 🟡 Phase 2 (Shortlist) Pending

## ✅ Accompli

### Fondations RBush

- ✅ Module `LayeredRBush` créé ([src/spatial/rbushIndex.ts](../src/spatial/rbushIndex.ts))
- ✅ Tests unitaires (8/8 passing) ([tests/unit/spatial.rbush.spec.ts](../tests/unit/spatial.rbush.spec.ts))
- ✅ API: `insert`, `load`, `search`, `remove`, `clear`, `stats`, `totalCount`

### Store Integration

- ✅ Types ajoutés dans `SceneState`:
  - `ui.spatialEngine?: 'global' | 'rbush' | 'auto'`
  - `ui.spatialThreshold?: number` (default: 120)
  - `ui.spatialStats?: { itemsByLayer, rebuilds, queries }`
- ✅ Singleton `layeredRBush` instancié
- ✅ Helpers créés:
  - `indexFromPiece()` - Convert piece to AABB (with rotation support)
  - `rebuildLayerIndex()` - Rebuild index for layer
  - `scheduleLayerRebuild()` - Debounced rebuild via microtask
  - `updatePieceInIndex()` - Insert piece into index
  - `removePieceFromRBushIndex()` - Remove piece
  - `bumpQueryCounter()` - Increment metrics
  - **`shortlistSameLayerAABB()`** - 🔑 Core helper for spatial queries

### Shortlist Helper

```typescript
shortlistSameLayerAABB(layerId: ID, bbox: AABB): ID[]
```

- ✅ Switch RBush/Global based on:
  - `window.__SPATIAL__` override (dev)
  - `ui.spatialEngine` setting
  - Auto-enable at `ui.spatialThreshold` (120 pieces)
- ✅ Metrics tracking (GLOBAL/RBUSH/FALLBACK counters)
- ✅ Debug logging (`__DBG_DRAG__`)

### Configuration

- ✅ Metrics initialized in `initSceneWithDefaults`
- ✅ RBush cleared and rebuilt on scene init

### Benchmark Script

- ✅ Script créé ([scripts/bench.spatial.ts](../scripts/bench.spatial.ts))
- ✅ Compare RBush vs Global for N=100/300/500/1000 pieces
- ⚠️ Script npm nécessite `tsx` (à installer ou utiliser alternative)

### Hooks CRUD ✅ COMPLETED (Session S22-4k)

**Status**: Tous les hooks wirés et testés

**Fichier modifié**: `src/state/useSceneStore.ts`

#### Actions hookées:

1. ✅ **`addRectPiece`** (ligne 1319-1328)
   - `updatePieceInIndex(piece)`
   - `itemsByLayer[layerId]++`

2. ✅ **`deleteSelected`** (ligne 2338-2343)
   - `removePieceFromRBushIndex(pieceId, layerId)`
   - `itemsByLayer[layerId]--`

3. ✅ **`endDrag`** (lignes 2133-2146, 2186-2194)
   - `scheduleLayerRebuild(layerId)` pour chaque pièce movée

4. ✅ **`endResize`** (ligne 3431-3434)
   - `scheduleLayerRebuild(piece.layerId)`

5. ✅ **`rotatePiece`** (ligne 1345-1355)
   - `scheduleLayerRebuild(piece.layerId)`

6. ✅ **`rotateSelected`** (lignes 2456-2472, 2490-2507)
   - `scheduleLayerRebuild(layerId)` pour chaque pièce rotée

7. ✅ **`importSceneFileV1`** / **`loadDraftById`** (lignes 2872-2876, 2972-2976)
   - `layeredRBush.clear()`
   - `rebuildLayerIndex(layerId)` pour tous les layers

**Résultats**: 600 tests passing, 0 regressions

## 🟡 En cours / À compléter

### Intégration shortlist

**Besoin**: Remplacer les scans O(n) par `shortlistSameLayerAABB()`

#### Fichiers à modifier:

1. **`src/lib/ui/snap.ts`** - `snapToPieces()`

   ```typescript
   // Remplacer:
   const neighbors = Object.values(scene.pieces).filter((p) => p.layerId === piece.layerId);

   // Par:
   const bbox = pieceBBox(piece);
   const neighborIds = shortlistSameLayerAABB(piece.layerId, bbox);
   const neighbors = neighborIds.map((id) => scene.pieces[id]);
   ```

2. **`src/lib/ui/snap.ts`** - `snapGroupToPieces()`

   ```typescript
   // Similar pattern pour group bbox
   const groupBbox = computeGroupBBox(selectedIds);
   const neighborIds = shortlistSameLayerAABB(layerId, groupBbox);
   ```

3. **`src/lib/sceneRules/index.ts`** - `collisionsForPiece()`

   ```typescript
   // Remplacer scan complet par shortlist
   const bbox = pieceBBox(piece);
   const candidateIds = shortlistSameLayerAABB(piece.layerId, bbox);
   // Puis appliquer SAT exact pour chaque candidat
   ```

4. **`src/lib/sceneRules/index.ts`** - `validateNoOverlapSameLayer()`
   ```typescript
   // Similar pattern
   const candidateIds = shortlistSameLayerAABB(piece.layerId, bbox);
   ```

**Note**: Garder la même logique finale (AABB → shortlist → SAT exact)

### Dev Panel metrics

**Besoin**: Afficher `ui.spatialStats` dans le panneau Dev

**Fichier à modifier**: `src/components/DevMetrics.tsx` (ou équivalent)

```typescript
const spatialStats = useSceneStore(s => s.ui.spatialStats);

<div>
  <h3>Spatial Index</h3>
  <div>Mode: {spatialEngine ?? 'auto'}</div>
  <div>Threshold: {spatialThreshold ?? 120} pieces</div>

  <h4>Queries</h4>
  <ul>
    <li>GLOBAL: {spatialStats.queries.GLOBAL}</li>
    <li>RBUSH: {spatialStats.queries.RBUSH}</li>
    <li>FALLBACK: {spatialStats.queries.FALLBACK}</li>
  </ul>

  <h4>Items by Layer</h4>
  <ul>
    {Object.entries(spatialStats.itemsByLayer).map(([layerId, count]) => (
      <li key={layerId}>{layerNameFromId(layerId)}: {count} pieces</li>
    ))}
  </ul>

  <div>Rebuilds: {spatialStats.rebuilds}</div>
</div>
```

### Tests

#### Unit test non-régression

**Fichier**: `tests/unit/spatial.shortlist.spec.ts` (à créer)

```typescript
it('shortlistSameLayerAABB returns same results as global scan', () => {
  // Create deterministic scene with 50 pieces on C1, C2, C3
  // Make 20 pseudo-random queries
  // Verify RBush shortlist === Global shortlist (as sets)
});
```

#### E2E avec RBush activé

**Exécuter**:

```bash
# Dans browser console avant de lancer tests
window.__SPATIAL__ = 'rbush';

# Puis run E2E
pnpm e2e
```

**Résultat attendu**: 2/2 tests passing (comportement identique)

### Benchmark

**À installer**: `pnpm add -D tsx`

**Exécuter**:

```bash
pnpm bench:spatial
```

**Résultats attendus**:

- N=100: RBush ~2-4× plus rapide
- N=300: RBush ~6-8× plus rapide
- N=500: RBush ~10-15× plus rapide

## 📋 Plan de complétion (session future)

### Phase 1: Hooks CRUD (30 min)

1. Identifier toutes les mutations de pieces (add/delete/move/resize/rotate)
2. Ajouter `updatePieceInIndex()` après create
3. Ajouter `removePieceFromRBushIndex()` avant delete
4. Ajouter `scheduleLayerRebuild()` après move/resize/rotate

### Phase 2: Shortlist integration (45 min)

1. Refactor `snapToPieces` pour utiliser `shortlistSameLayerAABB`
2. Refactor `snapGroupToPieces`
3. Refactor `collisionsForPiece`
4. Refactor `validateNoOverlapSameLayer`
5. Vérifier que tous les tests passent

### Phase 3: Metrics & UI (15 min)

1. Afficher `spatialStats` dans Dev Panel
2. Ajouter toggle pour forcer RBush/Global en dev
3. Vérifier métriques s'incrémentent correctement

### Phase 4: Tests & Bench (30 min)

1. Créer test unit non-régression shortlist
2. Exécuter E2E avec `window.__SPATIAL__='rbush'`
3. Installer `tsx` et exécuter `pnpm bench:spatial`
4. Documenter résultats benchmark

### Phase 5: Rollout (15 min)

1. Commit atomique des hooks
2. Commit atomique de l'intégration shortlist
3. Commit atomique metrics/UI
4. Commit atomique tests/bench
5. Update docs avec résultats

## 🎯 Critères de succès

### Phase 1 (CRUD Hooks) ✅ COMPLETED

- ✅ `pnpm typecheck` passing
- ✅ `pnpm test --run` passing (600/693 tests, 0 regressions)
- ✅ Index RBush wired sur tous CRUD hooks
- ✅ Metrics `itemsByLayer` maintenues
- ✅ Rotation AABB correcte
- ✅ Aucun changement fonctionnel

### Phase 2 (Shortlist) ⏳ PENDING

- ⏳ `shortlistSameLayerAABB()` utilisé dans snap/collision
- ⏳ `pnpm e2e` passing avec RBush activé
- ⏳ Dev Panel affiche RBUSH>0 quand actif
- ⏳ Bench montre RBush 2-10× plus rapide selon N
- ⏳ Comportement fonctionnel identique (snap/collision)

## 📚 Références

- [src/spatial/rbushIndex.ts](../src/spatial/rbushIndex.ts) - Module RBush
- [src/state/useSceneStore.ts](../src/state/useSceneStore.ts) - Store (ligne 76-228 pour helpers)
- [tests/unit/spatial.rbush.spec.ts](../tests/unit/spatial.rbush.spec.ts) - Tests unitaires
- [scripts/bench.spatial.ts](../scripts/bench.spatial.ts) - Benchmark

## 💡 Notes

- Approche incrémentale: peut être activé progressivement
- Flag `window.__SPATIAL__` permet test manuel
- Auto-enable à 120 pièces est conservateur (peut être ajusté)
- Debounce via `queueMicrotask` évite rebuilds multiples

**Session suivante**: Compléter Phase 1-5 (~2h15 estimé)
