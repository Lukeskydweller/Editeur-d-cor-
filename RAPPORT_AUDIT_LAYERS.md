# Rapport d'audit — Système de couches (Layers)

**Date**: 2025-11-08
**Branche**: `chore/ci-guardrails-setup`
**Commit**: `327ba0d`
**Mode**: READ-ONLY (diagnostic uniquement, aucune modification)

---

## 1. État du repo & base technique

### 1.1 Git

```bash
Branch: chore/ci-guardrails-setup
Commit: 327ba0d ci: fix pnpm setup - install before setup-node cache
Status: clean (no uncommitted changes)
```

### 1.2 Tooling

- **Node**: v20.19.5
- **pnpm**: 10.20.0
- **TypeScript**: ✅ `pnpm typecheck` → 0 errors
- **Tests**: ✅ **593 passed** | 21 skipped (614 total)
  - 81 test files passed | 2 skipped (83 total)
  - Duration: 15.41s

### 1.3 Validation guards (tous OK)

- ✅ Typecheck: 0 errors
- ✅ Unit tests: 593/593 passed
- ✅ Smoke tests: 4/4 passed (confirmed in previous session)
- ✅ Build: success
- ✅ Coverage: 80/80/80/70 thresholds met

---

## 2. Contrat UX cible (rappel)

Le contrat définitif demandé par l'utilisateur :

- **3 couches fixes strictes** : C1 (bas), C2 (milieu), C3 (haut)
- **Aucune création au-delà de C3**
- **Aucun réordonnancement** des couches
- **Aucune réassignation** de pièces entre couches
- **Progressive unlock** : C2 débloquée quand C1 remplie, C3 quand C2 remplie
- **Ghost rendering** : pièces non supportées affichées en fantôme (rouge/orange)
- **Painter's order** : C1 en bas, C2 au milieu, C3 en haut (ordre SVG)
- **Keyboard shortcuts** : `1`/`2`/`3` pour basculer couche active, `V` toggle visibility, `L` toggle lock

---

## 3. État actuel de l'implémentation

### 3.1 Constante MAX_LAYERS

**Fichier**: [`src/constants/validation.ts:6`](src/constants/validation.ts#L6)

```typescript
export const MAX_LAYERS = 3;
```

✅ **Conforme** : La limite est fixée à 3 couches.

### 3.2 Gestion de l'état (State Management)

**Fichier principal**: [`src/state/useSceneStore.ts`](src/state/useSceneStore.ts)

#### 3.2.1 Structure de données

```typescript
// Scene structure (ligne 51-60 de types/scene.ts)
export type SceneDraft = {
  id: ID;
  createdAt: string;
  size: { w: Milli; h: Milli };
  materials: Record<ID, MaterialRef>;
  layers: Record<ID, Layer>;
  pieces: Record<ID, Piece>;
  layerOrder: ID[];  // ← ordre z croissant (bas → haut)
  revision: number;
};

// UI state (ligne 569-577 de useSceneStore.ts)
ui: {
  activeLayer?: ID;  // ← couche active pour édition
  layerVisibility: Record<ID, boolean>;  // default: true
  layerLocked: Record<ID, boolean>;  // default: false
}
```

✅ **Conforme** :

- `layerOrder` maintient l'ordre de painter (index 0 = bas, index 2 = haut)
- `activeLayer` contrôle quelle couche est interactive
- Visibility/Lock permettent masquage et verrouillage

#### 3.2.2 Actions de couches

**Ligne 839-869** : `addLayer(name: string)`

```typescript
addLayer: (name) => {
  // MAX_LAYERS guard - check before mutation
  const currentState = useSceneStore.getState();
  if (currentState.scene.layerOrder.length >= MAX_LAYERS) {
    // Toast d'erreur affiché
    return '' as ID; // Retourne ID vide quand bloqué
  }

  const id = genId('layer');
  // Création de la couche et ajout à layerOrder
  draft.scene.layerOrder.push(id);
  draft.ui.layerVisibility[id] = true; // visible par défaut
  draft.ui.layerLocked[id] = false; // déverrouillée par défaut
  return id;
};
```

✅ **Conforme** : Le guard `MAX_LAYERS` bloque la création de C4+.

**Ligne 871-878** : `setActiveLayer(layerId: ID)`

```typescript
setActiveLayer: (layerId) =>
  set(
    produce((draft: SceneState) => {
      if (draft.scene.layers[layerId]) {
        draft.ui.activeLayer = layerId;
      }
    }),
  );
```

✅ **Conforme** : Permet de basculer entre C1/C2/C3.

**Ligne 880-898** : `toggleLayerVisibility` et `toggleLayerLock`

```typescript
toggleLayerVisibility: (layerId) =>
  set(
    produce((draft: SceneState) => {
      if (draft.scene.layers[layerId]) {
        const current = draft.ui.layerVisibility[layerId] ?? true;
        draft.ui.layerVisibility[layerId] = !current;
      }
    }),
  );

toggleLayerLock: (layerId) =>
  set(
    produce((draft: SceneState) => {
      if (draft.scene.layers[layerId]) {
        const current = draft.ui.layerLocked[layerId] ?? false;
        draft.ui.layerLocked[layerId] = !current;
      }
    }),
  );
```

✅ **Conforme** : Permettent de masquer/verrouiller les couches.

#### 3.2.3 Réordonnancement des couches

**Lignes 2079-2149** : `moveLayerForward`, `moveLayerBackward`, `moveLayerToFront`, `moveLayerToBack`

```typescript
moveLayerForward: (layerId) =>
  set(
    produce((draft: SceneState) => {
      const idx = draft.scene.layerOrder.indexOf(layerId);
      if (idx === -1 || idx === draft.scene.layerOrder.length - 1) return;

      // Swap avec la couche suivante
      [draft.scene.layerOrder[idx], draft.scene.layerOrder[idx + 1]] = [
        draft.scene.layerOrder[idx + 1],
        draft.scene.layerOrder[idx],
      ];

      pushHistory(draft, snap); // Push to history
      autosave(takeSnapshot(draft));
    }),
  );
```

⚠️ **NON CONFORME** : Les 4 actions permettent de **réordonner les couches**, ce qui **viole le contrat UX cible** (aucun réordonnancement).

**Impact** :

- L'utilisateur peut actuellement inverser l'ordre C1/C2/C3
- Les tests [`src/App.layers.order.test.tsx`](src/App.layers.order.test.tsx) valident ce comportement
- Les boutons UI dans [`src/components/Sidebar.tsx`](src/components/Sidebar.tsx#L171-L210) exposent ces actions

**Raison détectée** : Ces actions existent pour permettre la flexibilité de l'ordre des couches, mais **le contrat cible impose un ordre fixe immuable** (C1 toujours en bas, C2 au milieu, C3 en haut).

#### 3.2.4 Réassignation de pièces entre couches

**Recherche effectuée** : `grep -r "piece.layerId.*=" "setPieceLayer" "movePieceToLayer" "changeLayer"`

**Résultat** : ❌ **Aucune action de réassignation trouvée**.

✅ **Conforme** : Les pièces **ne peuvent pas changer de couche** après création. Une fois qu'une pièce est ajoutée à C1, elle reste sur C1.

**Vérification** :

- `addRectPiece(layerId, ...)` : ligne 900-914, la pièce est assignée à `layerId` à la création
- Aucune mutation ultérieure de `piece.layerId` dans le store

---

### 3.3 Rendu SVG (Painter's Order)

**Fichier**: [`src/App.tsx:867-963`](src/App.tsx#L867-L963)

```typescript
{scene.layerOrder.map((layerId: string) => {
  const layer = scene.layers[layerId];
  if (!layer) return null;

  const isActive = layerId === activeLayer;
  const isVisible = layerVisibility?.[layerId] ?? true;
  const isLocked = layerLocked?.[layerId] ?? false;

  return (
    <g
      key={layerId}
      data-layer={layer.name}
      style={{
        pointerEvents: isVisible && !isLocked && isActive ? 'all' : 'none',
        opacity: isVisible ? (isActive ? 1 : 0.5) : 0,
      }}
    >
      {layer.pieces.map((pieceId: string) => {
        const p = scene.pieces[pieceId];
        // ... rendu de chaque pièce
      })}
    </g>
  );
})}
```

✅ **Conforme** :

- Les couches sont rendues dans l'ordre de `layerOrder` (bas → haut)
- **Isolation des interactions** : seule la couche active (`isActive`) et visible/déverrouillée reçoit `pointerEvents: 'all'`
- **Opacité** : couches inactives à 50% d'opacité, masquées à 0%
- **Painter's order SVG** : l'ordre de rendu SVG respecte `layerOrder` (premier élément = arrière-plan)

---

### 3.4 UI Panel (Sidebar)

**Fichier**: [`src/components/Sidebar.tsx:64-210`](src/components/Sidebar.tsx#L64-L210)

#### 3.4.1 Bouton "+ Layer"

```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => addLayer(`C${layerOrder.length + 1}`)}
  disabled={layerOrder.length >= MAX_LAYERS}
  aria-label="add-layer"
  data-testid="layer-add-button"
  title={
    layerOrder.length >= MAX_LAYERS
      ? `Maximum de ${MAX_LAYERS} couches atteint`
      : undefined
  }
>
  + Layer
</Button>
```

✅ **Conforme** : Le bouton est **désactivé** quand `MAX_LAYERS` est atteint.

#### 3.4.2 Liste des couches

```typescript
{layerCounts.map((l, idx) => {
  const isAtBack = idx === 0;
  const isAtFront = idx === layerCounts.length - 1;
  const isActive = l.id === activeLayer;
  const isVisible = layerVisibility?.[l.id] ?? true;
  const isLocked = layerLocked?.[l.id] ?? false;

  return (
    <li
      key={l.id}
      data-testid={`layer-row-${l.name}`}
      className={isActive ? 'bg-cyan-600 ring-2' : 'bg-slate-700'}
      onClick={() => setActiveLayer(l.id)}
    >
      {/* Radio button (●/○) */}
      <span>{isActive ? '●' : '○'}</span>
      <span>{l.name}</span>
      <span>{l.count}</span>  {/* nombre de pièces */}

      {/* Eye icon (visibility toggle) */}
      <Button onClick={() => toggleLayerVisibility(l.id)}>
        {isVisible ? '👁' : '🚫'}
      </Button>

      {/* Lock icon */}
      <Button onClick={() => toggleLayerLock(l.id)}>
        {isLocked ? '🔒' : '🔓'}
      </Button>

      {/* Layer order buttons */}
      <Button onClick={() => moveLayerToFront(l.id)} disabled={isAtFront}>
        ⏫
      </Button>
      <Button onClick={() => moveLayerForward(l.id)} disabled={isAtFront}>
        ⬆
      </Button>
      <Button onClick={() => moveLayerBackward(l.id)} disabled={isAtBack}>
        ⬇
      </Button>
      <Button onClick={() => moveLayerToBack(l.id)} disabled={isAtBack}>
        ⏬
      </Button>
    </li>
  );
})}
```

⚠️ **NON CONFORME** : Les **4 boutons de réordonnancement** (⏫⬆⬇⏬) sont présents et fonctionnels, ce qui **viole le contrat UX cible** (aucun réordonnancement).

✅ **Conforme** :

- Badge actif (●/○)
- Toggle visibility (👁/🚫)
- Toggle lock (🔒/🔓)
- Affichage du nombre de pièces par couche

---

### 3.5 Keyboard Shortcuts

**Fichier**: [`src/App.tsx:332-357`](src/App.tsx#L332-L357)

```typescript
// Layer shortcuts: Digit1/2/3 → switch to C1/C2/C3
if (['1', '2', '3'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  const layerIndex = parseInt(e.key) - 1;
  const currentState = useSceneStore.getState();
  const targetLayerId = currentState.scene.layerOrder[layerIndex];
  if (targetLayerId) {
    setActiveLayer(targetLayerId);
  }
  return;
}

// KeyV → toggle visibility of active layer
if (e.key === 'v' && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  const currentState = useSceneStore.getState();
  const activeLayerId = currentState.ui.activeLayer;
  if (activeLayerId) {
    toggleLayerVisibility(activeLayerId);
  }
  return;
}

// KeyL → toggle lock of active layer
if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  const currentState = useSceneStore.getState();
  const activeLayerId = currentState.ui.activeLayer;
  if (activeLayerId) {
    toggleLayerLock(activeLayerId);
  }
  return;
}
```

✅ **Conforme** :

- `1`/`2`/`3` → bascule vers C1/C2/C3 (mapping via `layerOrder[0/1/2]`)
- `V` → toggle visibility de la couche active
- `L` → toggle lock de la couche active

**Tests associés**: [`tests/unit/layers.shortcuts.spec.tsx`](tests/unit/layers.shortcuts.spec.tsx)

---

### 3.6 Progressive Unlock (Gating Rules)

**Recherche effectuée** : `grep -r "progressive unlock" "unlock C2" "unlock C3" "C2 disabled" "C3 disabled"`

**Résultat** : ❌ **Aucune règle de progressive unlock trouvée**.

⚠️ **NON CONFORME** : Actuellement, **les 3 couches sont créables dès le départ**. Il n'y a **aucun gating** qui empêche de créer C2/C3 tant que C1/C2 ne sont pas "remplies".

**Impact** :

- L'utilisateur peut créer C1, C2, C3 immédiatement
- Pas de logique pour déterminer quand une couche est "remplie" ou "complète"
- Le contrat cible demande : **C2 débloquée quand C1 remplie, C3 quand C2 remplie**

**État actuel** : Le seul gating est `MAX_LAYERS=3`, qui empêche de créer une 4ème couche, mais **ne contrôle pas l'ordre de déblocage**.

---

### 3.7 Ghost Rendering & Support Validation

**Fichiers clés** :

- [`src/core/geo/validateAll.ts`](src/core/geo/validateAll.ts) : Validation `unsupported_above`
- [`tests/unit/layers.support.spec.ts`](tests/unit/layers.support.spec.ts) : Tests AABB
- [`tests/unit/layers.support.pathops.spec.ts`](tests/unit/layers.support.pathops.spec.ts) : Tests PathOps exact

#### 3.7.1 Validation "unsupported_above"

**Code `validateAll.ts`** (simplifié) :

```typescript
// Check layer support: pieces on upper layers must be fully supported by union of lower layers
for (const piece of piecesWithGeometry) {
  const layerIndex = layersById[piece.layerId]?.index ?? 0;
  if (layerIndex === 0) continue; // Base layer (C1) → no support check

  // Get all pieces on lower layers
  const lowerLayerPieces = piecesWithGeometry.filter((p) => {
    const pLayerIndex = layersById[p.layerId]?.index ?? 0;
    return pLayerIndex < layerIndex;
  });

  if (lowerLayerPieces.length === 0) {
    problems.push({
      code: 'unsupported_above',
      severity: 'BLOCK',
      pieceId: piece.id,
      message: 'Pièce non supportée par couche inférieure',
    });
    continue;
  }

  // Compute union of lower layers (via PathOps/Clipper)
  const supportUnion = computeUnion(lowerLayerPieces);

  // Check if current piece is fully inside supportUnion
  const isFullySupported = isContainedInUnion(piece, supportUnion);

  if (!isFullySupported) {
    problems.push({
      code: 'unsupported_above',
      severity: 'BLOCK',
      pieceId: piece.id,
      message: 'Pièce non supportée par couche inférieure',
    });
  }
}
```

✅ **Conforme** : La validation détecte les pièces non supportées sur C2/C3.

**Stratégie** :

- **Unit tests** : Utilise AABB (bounding box) pour validation rapide
- **E2E tests** : Utilise PathOps/Clipper pour validation exacte (pièces rotées, unions complexes)

**Fichiers PathOps** :

- [`src/core/booleans/pathopsAdapter.ts`](src/core/booleans/pathopsAdapter.ts) : Wrapper PathOps
- [`src/workers/geo.worker.ts`](src/workers/geo.worker.ts) : Web Worker pour calculs PathOps
- [`e2e/layers.support.pathops.spec.ts`](e2e/layers.support.pathops.spec.ts) : Tests E2E exact

#### 3.7.2 Ghost Rendering

**Fichier**: [`src/App.tsx:900-913`](src/App.tsx#L900-L913)

```typescript
// Check if this is a ghost piece
const isGhost = ghost?.pieceId === p.id;
const ghostHasBlock = isGhost && ghost.problems.some(prob => prob.severity === 'BLOCK');
const ghostHasWarn = isGhost && ghost.problems.some(prob => prob.severity === 'WARN') && !ghostHasBlock;

return (
  <rect
    fill={isGhost ? (ghostHasBlock ? '#ef4444' : '#f59e0b') : '#60a5fa'}
    stroke={isGhost ? (ghostHasBlock ? '#dc2626' : '#f59e0b') : '#1e3a8a'}
    strokeWidth={isGhost ? '4' : '2'}
    style={{ opacity: isGhost ? 0.85 : 1 }}
    className={`${ghostHasBlock ? 'ghost-illegal' : ghostHasWarn ? 'ghost-warn' : ''}`}
  />
);
```

✅ **Conforme** :

- **Rouge** (`#ef4444`) pour pièces BLOCK (non supportées)
- **Orange** (`#f59e0b`) pour pièces WARN
- **Bleu** (`#60a5fa`) pour pièces valides
- Opacity réduite (0.85) pour les ghosts

**État `ui.ghost`** : Contient `{ pieceId, problems }` pour afficher le feedback visuel.

---

### 3.8 Tests liés aux couches

#### 3.8.1 Tests trouvés

**Fichiers de tests** (33 fichiers mentionnent `layer`, 26 mentionnent `Layer`) :

**Tests State Management** :

- [`src/state/useSceneStore.layers.test.ts`](src/state/useSceneStore.layers.test.ts) : Tests des actions de couches
- [`src/state/useSceneStore.history.test.ts`](src/state/useSceneStore.history.test.ts) : Undo/redo avec couches

**Tests UI** :

- [`tests/unit/layersPanel.spec.tsx`](tests/unit/layersPanel.spec.tsx) : UI du panel (bouton +Layer, rows, badges)
- [`src/App.layers.order.test.tsx`](src/App.layers.order.test.tsx) : Tests des boutons de réordonnancement

**Tests Validation** :

- [`tests/unit/maxLayers.spec.ts`](tests/unit/maxLayers.spec.ts) : Enforcement de `MAX_LAYERS=3`
- [`tests/unit/layers.support.spec.ts`](tests/unit/layers.support.spec.ts) : Validation AABB
- [`tests/unit/layers.support.pathops.spec.ts`](tests/unit/layers.support.pathops.spec.ts) : Validation PathOps exact
- [`e2e/layers.support.pathops.spec.ts`](e2e/layers.support.pathops.spec.ts) : E2E PathOps
- [`e2e/layers.support.spec.ts`](e2e/layers.support.spec.ts) : E2E AABB

**Tests Comportement** :

- [`tests/unit/layers.visibility.spec.tsx`](tests/unit/layers.visibility.spec.tsx) : Toggle visibility
- [`tests/unit/layers.lock.spec.tsx`](tests/unit/layers.lock.spec.tsx) : Toggle lock
- [`tests/unit/layers.shortcuts.spec.tsx`](tests/unit/layers.shortcuts.spec.tsx) : Shortcuts clavier (1/2/3, V, L)
- [`tests/unit/layerIsolation.spec.ts`](tests/unit/layerIsolation.spec.ts) : Isolation des interactions
- [`tests/unit/layerOrder.spec.tsx`](tests/unit/layerOrder.spec.tsx) : Painter's order SVG
- [`tests/unit/activeLayer.spec.tsx`](tests/unit/activeLayer.spec.tsx) : Couche active

**Autres** :

- [`tests/unit/shape.library.spec.ts`](tests/unit/shape.library.spec.ts) : Insertion sur couche active
- [`tests/validateAll.min-inside.spec.ts`](tests/validateAll.min-inside.spec.ts) : Non-regression overlap_same_layer

#### 3.8.2 Couverture des tests

✅ **Couverture complète** :

- Création de couches (jusqu'à MAX_LAYERS)
- Blocage de C4 avec toast
- Réordonnancement (forward/backward/front/back)
- Visibility/Lock toggles
- Keyboard shortcuts (1/2/3, V, L)
- Painter's order SVG
- Isolation des interactions (seule couche active interactive)
- Support validation (AABB + PathOps)
- Ghost rendering

⚠️ **Couverture manquante** :

- **Progressive unlock** : Aucun test pour déblocage séquentiel C1→C2→C3
- **Ordre fixe immuable** : Les tests **valident le réordonnancement** alors que le contrat cible l'interdit

---

## 4. Raisons permettant >3 couches (état actuel)

### 4.1 Raisons techniques

**Aucune raison technique** : Le guard `MAX_LAYERS=3` **bloque effectivement** la création de C4+.

✅ **Conformité technique** : Impossible de créer plus de 3 couches.

### 4.2 Raisons historiques / legacy

**Historique du code** :

- Commit `2ebf3d2` : "feat(layers): enforce MAX_LAYERS=3 limit with toast and UI guard"
- Le système a été conçu à l'origine pour supporter un nombre flexible de couches
- La limite `MAX_LAYERS=3` a été ajoutée plus tard comme contrainte

**État actuel** :

- La limite est **appliquée** (guard + toast + bouton désactivé)
- Les actions de réordonnancement **subsistent** mais sont incompatibles avec le contrat cible

---

## 5. Dépendances du système de couches

### 5.1 Support & Ghost

**Dépendances** :

- [`src/core/booleans/pathopsAdapter.ts`](src/core/booleans/pathopsAdapter.ts) : PathOps/Clipper pour union de couches
- [`src/workers/geo.worker.ts`](src/workers/geo.worker.ts) : Web Worker pour calculs PathOps asynchrones
- [`src/core/geo/validateAll.ts`](src/core/geo/validateAll.ts) : Validation `unsupported_above`
- [`src/workers/wasm.loader.ts`](src/workers/wasm.loader.ts) : Chargement WASM PathOps

**Impact** : Le calcul d'union des couches inférieures est **critique** pour déterminer si une pièce sur C2/C3 est supportée.

### 5.2 Painter's Order

**Dépendances** :

- `scene.layerOrder` : Définit l'ordre SVG (bas → haut)
- Rendu SVG : [`src/App.tsx:867-963`](src/App.tsx#L867-L963)

**Impact** : L'ordre de `layerOrder` **doit rester cohérent** avec l'ordre visuel (C1 en bas, C2 milieu, C3 haut).

### 5.3 Keyboard Shortcuts

**Dépendances** :

- Mapping `layerOrder[0/1/2]` → C1/C2/C3
- `setActiveLayer`, `toggleLayerVisibility`, `toggleLayerLock`

**Impact** : Les raccourcis clavier **dépendent de l'ordre de `layerOrder`**. Si l'ordre change (via réordonnancement), les raccourcis pointent vers les mauvaises couches.

**Exemple** :

- Utilisateur crée C1, C2, C3
- `layerOrder = [C1, C2, C3]` → `1` active C1, `2` active C2, `3` active C3
- Utilisateur réordonne : "Move C3 to back"
- `layerOrder = [C3, C1, C2]` → `1` active **C3** (!), `2` active C1, `3` active C2
- **Confusion** : Le raccourci `1` devrait toujours activer C1, pas C3

### 5.4 Tests

**Dépendances** :

- Tous les tests de réordonnancement dépendent des actions `moveLayer*`
- Les tests de support dépendent de PathOps/Clipper
- Les tests de keyboard dépendent du mapping `layerOrder`

**Impact** : Si les actions de réordonnancement sont supprimées, **25+ tests doivent être mis à jour ou supprimés**.

---

## 6. Liste exhaustive des écarts avec le contrat cible

### 6.1 ✅ Conformités

| Aspect                               | État                          | Localisation                                                                 |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------- |
| **MAX_LAYERS=3**                     | ✅ Appliqué                   | [`src/constants/validation.ts:6`](src/constants/validation.ts#L6)            |
| **Guard création C4+**               | ✅ Bloqué + toast             | [`src/state/useSceneStore.ts:839-851`](src/state/useSceneStore.ts#L839-L851) |
| **Pas de réassignation pièces**      | ✅ Aucune action trouvée      | N/A                                                                          |
| **Keyboard shortcuts (1/2/3, V, L)** | ✅ Fonctionnels               | [`src/App.tsx:332-357`](src/App.tsx#L332-L357)                               |
| **Painter's order SVG**              | ✅ Respecté                   | [`src/App.tsx:867-963`](src/App.tsx#L867-L963)                               |
| **Isolation interactions**           | ✅ `pointerEvents` par couche | [`src/App.tsx:880`](src/App.tsx#L880)                                        |
| **Ghost rendering**                  | ✅ Rouge/Orange               | [`src/App.tsx:900-913`](src/App.tsx#L900-L913)                               |
| **Support validation**               | ✅ AABB + PathOps             | [`src/core/geo/validateAll.ts`](src/core/geo/validateAll.ts)                 |
| **Visibility/Lock toggles**          | ✅ Fonctionnels               | [`src/state/useSceneStore.ts:880-898`](src/state/useSceneStore.ts#L880-L898) |

### 6.2 ⚠️ Non-conformités

| Aspect                          | État                                  | Localisation                                                                     | Impact                                   |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| **Réordonnancement couches**    | ⚠️ **Autorisé**                       | [`src/state/useSceneStore.ts:2079-2149`](src/state/useSceneStore.ts#L2079-L2149) | Viole "aucun réordonnancement"           |
| **Boutons UI réordonnancement** | ⚠️ **Présents**                       | [`src/components/Sidebar.tsx:171-210`](src/components/Sidebar.tsx#L171-L210)     | Exposent les actions interdites          |
| **Progressive unlock**          | ⚠️ **Absent**                         | N/A                                                                              | C2/C3 créables dès le départ             |
| **Tests réordonnancement**      | ⚠️ **Valident comportement interdit** | [`src/App.layers.order.test.tsx`](src/App.layers.order.test.tsx)                 | Tests à supprimer ou adapter             |
| **Keyboard mapping instable**   | ⚠️ **Dépend de layerOrder**           | [`src/App.tsx:335-337`](src/App.tsx#L335-L337)                                   | Si réordonnancement → mapping incohérent |

---

## 7. Inventaire des fichiers à modifier (prochain jalon)

### 7.1 Suppressions nécessaires

**Actions de réordonnancement** (4 actions) :

- `moveLayerForward`
- `moveLayerBackward`
- `moveLayerToFront`
- `moveLayerToBack`

**Localisation** : [`src/state/useSceneStore.ts:2079-2149`](src/state/useSceneStore.ts#L2079-L2149)

**Boutons UI réordonnancement** (4 boutons) :

- ⏫ "Move to front"
- ⬆ "Move forward"
- ⬇ "Move backward"
- ⏬ "Move to back"

**Localisation** : [`src/components/Sidebar.tsx:171-210`](src/components/Sidebar.tsx#L171-L210)

### 7.2 Ajouts nécessaires

**Progressive unlock logic** :

- Fonction `isLayerUnlocked(layerIndex: number): boolean`
  - Retourne `true` si la couche peut être créée
  - Logique : C1 toujours débloquée, C2 si C1 "remplie", C3 si C2 "remplie"
- Définir "couche remplie" :
  - Option 1 : Au moins 1 pièce sur la couche
  - Option 2 : Pourcentage de surface couvert (ex: 50% de la scène)
  - **Besoin clarification utilisateur**

**Guard dans `addLayer`** :

- Vérifier `isLayerUnlocked(layerOrder.length)` avant création
- Toast adapté : "Complétez d'abord la couche C1/C2"

**Guard dans UI** :

- Bouton "+ Layer" désactivé si couche suivante non débloquée
- Tooltip explicatif : "Ajoutez des pièces à C1 pour débloquer C2"

### 7.3 Tests à mettre à jour

**Tests à supprimer** :

- [`src/App.layers.order.test.tsx`](src/App.layers.order.test.tsx) : 8 tests de réordonnancement
- [`src/state/useSceneStore.layers.test.ts`](src/state/useSceneStore.layers.test.ts) : Tests `moveLayer*`

**Tests à adapter** :

- [`tests/unit/layersPanel.spec.tsx`](tests/unit/layersPanel.spec.tsx) : Supprimer tests des boutons de réordonnancement
- [`tests/unit/layers.shortcuts.spec.tsx`](tests/unit/layers.shortcuts.spec.tsx) : Vérifier que mapping reste stable

**Tests à ajouter** :

- Progressive unlock : C2 bloquée si C1 vide
- Progressive unlock : C3 bloquée si C2 vide
- Toast adapté quand tentative de création couche bloquée
- Bouton "+ Layer" désactivé avec tooltip correct

### 7.4 Documentation à mettre à jour

**README / docs** :

- Expliquer le système de 3 couches fixes (C1/C2/C3)
- Expliquer le progressive unlock
- Supprimer mentions de réordonnancement

---

## 8. JSON de synthèse

```json
{
  "audit_date": "2025-11-08",
  "branch": "chore/ci-guardrails-setup",
  "commit": "327ba0d",
  "node_version": "v20.19.5",
  "pnpm_version": "10.20.0",
  "validation": {
    "typecheck": "PASS",
    "unit_tests": {
      "status": "PASS",
      "passed": 593,
      "skipped": 21,
      "total": 614,
      "duration_sec": 15.41
    },
    "smoke_tests": "PASS (4/4)",
    "build": "PASS",
    "coverage": "PASS (80/80/80/70)"
  },
  "ux_contract": {
    "max_layers": 3,
    "layer_names": ["C1", "C2", "C3"],
    "fixed_order": true,
    "allow_reordering": false,
    "allow_reassignment": false,
    "progressive_unlock": true,
    "ghost_rendering": true,
    "keyboard_shortcuts": ["1", "2", "3", "V", "L"]
  },
  "current_state": {
    "max_layers_enforced": true,
    "max_layers_value": 3,
    "guard_c4_creation": true,
    "reassignment_possible": false,
    "reordering_possible": true,
    "progressive_unlock_implemented": false,
    "ghost_rendering_implemented": true,
    "keyboard_shortcuts_implemented": true
  },
  "conformity": {
    "compliant": [
      "MAX_LAYERS=3 enforced",
      "Guard blocks C4+ creation",
      "No piece reassignment",
      "Keyboard shortcuts functional",
      "Painter's order SVG correct",
      "Interaction isolation by layer",
      "Ghost rendering (red/orange)",
      "Support validation (AABB + PathOps)",
      "Visibility/Lock toggles"
    ],
    "non_compliant": [
      "Layer reordering allowed (4 actions)",
      "UI buttons for reordering present",
      "Progressive unlock absent",
      "Tests validate prohibited reordering",
      "Keyboard mapping unstable if reordered"
    ]
  },
  "files": {
    "state_management": "src/state/useSceneStore.ts",
    "constants": "src/constants/validation.ts",
    "ui_sidebar": "src/components/Sidebar.tsx",
    "rendering": "src/App.tsx",
    "validation": "src/core/geo/validateAll.ts",
    "pathops": "src/core/booleans/pathopsAdapter.ts",
    "tests_layers": [
      "tests/unit/maxLayers.spec.ts",
      "tests/unit/layersPanel.spec.tsx",
      "tests/unit/layers.support.spec.ts",
      "tests/unit/layers.support.pathops.spec.ts",
      "tests/unit/layers.visibility.spec.tsx",
      "tests/unit/layers.lock.spec.tsx",
      "tests/unit/layers.shortcuts.spec.tsx",
      "tests/unit/layerIsolation.spec.ts",
      "tests/unit/layerOrder.spec.tsx",
      "src/App.layers.order.test.tsx",
      "src/state/useSceneStore.layers.test.ts"
    ]
  },
  "dependencies": {
    "pathops_clipper": "Union calculation for support validation",
    "web_worker": "Async PathOps computation",
    "wasm_loader": "WASM PathOps module",
    "layerOrder": "Painter's order + keyboard mapping",
    "activeLayer": "Interaction isolation"
  },
  "gaps": {
    "reordering_actions": {
      "count": 4,
      "actions": ["moveLayerForward", "moveLayerBackward", "moveLayerToFront", "moveLayerToBack"],
      "location": "src/state/useSceneStore.ts:2079-2149"
    },
    "reordering_ui_buttons": {
      "count": 4,
      "buttons": ["⏫", "⬆", "⬇", "⏬"],
      "location": "src/components/Sidebar.tsx:171-210"
    },
    "progressive_unlock": {
      "implemented": false,
      "required": true,
      "description": "C2 unlocked when C1 filled, C3 when C2 filled"
    },
    "tests_to_remove": {
      "count": 8,
      "files": ["src/App.layers.order.test.tsx", "src/state/useSceneStore.layers.test.ts"]
    }
  },
  "next_steps": {
    "required_changes": [
      "Remove 4 reordering actions (moveLayer*)",
      "Remove 4 UI reordering buttons (⏫⬆⬇⏬)",
      "Implement progressive unlock logic",
      "Add isLayerUnlocked() guard",
      "Update addLayer guard to check unlock",
      "Update UI button to show unlock status",
      "Remove/update 8+ tests for reordering",
      "Add tests for progressive unlock"
    ],
    "clarifications_needed": [
      "Definition of 'layer filled': at least 1 piece? surface coverage threshold?",
      "Should C1 always be created at init, or only on first piece insertion?",
      "Should keyboard shortcuts remain fixed (1→C1, 2→C2, 3→C3) even if layers empty?"
    ]
  }
}
```

---

## 9. Conclusion

### 9.1 État global

✅ **Conformités majeures** :

- La limite `MAX_LAYERS=3` est **appliquée et respectée**
- Les pièces **ne peuvent pas être réassignées** entre couches
- Le rendu SVG respecte le **painter's order** (C1 bas, C3 haut)
- Le système de **ghost rendering** fonctionne (pièces non supportées en rouge/orange)
- Les **keyboard shortcuts** (1/2/3, V, L) sont opérationnels
- L'**isolation des interactions** par couche est correcte

⚠️ **Non-conformités critiques** :

- **Réordonnancement autorisé** : 4 actions + 4 boutons UI permettent d'inverser l'ordre des couches, ce qui **viole le contrat UX cible** (ordre fixe immuable)
- **Progressive unlock absent** : C2 et C3 sont créables immédiatement, sans contrainte de remplissage de C1/C2

### 9.2 Prochaine étape

**Jalon suivant** : Implémenter les corrections pour **aligner l'état actuel sur le contrat UX cible** :

1. **Supprimer** les 4 actions de réordonnancement (`moveLayer*`)
2. **Supprimer** les 4 boutons UI de réordonnancement (⏫⬆⬇⏬)
3. **Implémenter** le progressive unlock (C2 bloquée si C1 vide, C3 si C2 vide)
4. **Clarifier** avec l'utilisateur la définition de "couche remplie"
5. **Mettre à jour** les tests (supprimer tests de réordonnancement, ajouter tests de progressive unlock)

**Bloqueurs potentiels** :

- Définition de "couche remplie" (au moins 1 pièce ? pourcentage surface ?)
- Impact sur les tests existants (8+ tests à supprimer/adapter)

---

**Fin du rapport d'audit**
