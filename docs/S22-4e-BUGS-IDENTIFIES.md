# Bugs identifiés : Blocage transverse et absence de signal ghost

## Symptômes observés

1. **Aucun signal visuel** quand un C2 n'est pas soutenu par C1 après drop
2. **Blocage transverse** : Si un C2 est à cheval sur C1, d'autres C2 deviennent immobiles
3. **Resize bloqué** : Le resize d'un C2 "au-dessus d'un C1" se bloque parfois sans raison évidente

## Bugs identifiés avec preuves de code

### BUG #1 : Mode 'exact' jamais utilisé après commit

**Fichier** : `src/state/useSceneStore.ts:4185`

```typescript
const mode = interacting ? 'fast' : 'fast'; // TODO: 'exact' after commit hooks implemented
```

**Impact** : Le mode `'exact'` n'est JAMAIS utilisé. Même après commit, `useIsGhost` utilise le mode `'fast'` (AABB) au lieu du mode `'exact'` (PathOps).

**Conséquence** : Les pièces C2 partiellement supportées sont détectées comme "supportées" par l'AABB union (faux positif), donc **aucun signal ghost n'apparaît**.

---

### BUG #2 : Résultats de `recalculateExactSupport` perdus

**Fichier** : `src/state/useSceneStore.ts:850-895`

**Ligne clé** : 889-894

```typescript
// Trigger minimal state update to cause useIsGhost re-evaluation
// Bump a timestamp to invalidate cached ghost state
useSceneStore.setState((state) => ({
  ui: {
    ...state.ui,
    lastExactCheckAt: Date.now(), // ← Bump timestamp seulement
  },
}));
```

**Problème** :

1. `recalculateExactSupport` calcule les résultats exacts (`exactResults`) pour chaque pièce (ligne 854-885)
2. **Mais ne stocke PAS ces résultats dans le store**
3. Se contente de bumper `lastExactCheckAt` (ligne 892)
4. Le hook `useIsGhost` (ligne 4185) ignore complètement ce timestamp et utilise toujours le mode `'fast'`

**Conséquence** : Le calcul exact est fait mais **jamais utilisé**. Les résultats sont perdus.

---

### BUG #3 : `selectPiece` ne clear pas `ui.ghost`

**Fichier** : `src/state/useSceneStore.ts:1180-1200`

```typescript
selectPiece: (id) =>
  set(
    produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = id ? [id] : undefined;
      draft.ui.primaryId = id;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
      // MANQUANT: draft.ui.ghost = undefined;
    }),
  ),

selectOnly: (id) =>
  set(
    produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = [id];
      draft.ui.primaryId = id;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
      // MANQUANT: draft.ui.ghost = undefined;
    }),
  ),
```

**Problème** : Si `ui.ghost` est actif pour une pièce A (par ex. pendant resize), et qu'on sélectionne une pièce B, le ghost reste actif pour A.

**Conséquence** : **Blocage transverse** possible si :

1. Pièce A est en état ghost (ui.ghost.pieceId = A, problems = BLOCK)
2. On sélectionne pièce B (même couche que A)
3. `ui.ghost` n'est pas clearé
4. Lors du drag/resize de B, la validation pourrait être affectée par le ghost de A

**Mais attendez** : En relisant le code de validation, `ui.ghost` ne devrait **pas** affecter la validation d'une autre pièce. Le problème doit être ailleurs.

---

### BUG #4 : Possible confusion dans la logique de rendu ghost

**Fichier** : `src/App.tsx:902-913`

```typescript
const isGhost = ghost?.pieceId === p.id;
const ghostHasBlock =
  isGhost && ghost.problems.some((prob: { severity: string }) => prob.severity === 'BLOCK');
const ghostHasWarn =
  isGhost &&
  ghost.problems.some((prob: { severity: string }) => prob.severity === 'WARN') &&
  !ghostHasBlock;
```

**Vérification** : Cette logique est **correcte** - seule la pièce `ghost.pieceId` est affectée.

**Mais** : Le style inline appliqué (lignes 933-936) :

```typescript
fill={isGhost ? (ghostHasBlock ? '#ef4444' : '#f59e0b') : '#60a5fa'}
```

Pour un ghost WARN (support issue), la pièce devrait être orange (`#f59e0b`).

**Le problème** : Le CSS `[data-ghost="1"]` (src/styles/ghost.css) applique un `outline` sur le `<g>`, mais ce style peut être **trop subtil** ou **invisible** selon le contexte SVG.

---

### BUG #5 : Vérification signal visuel - CSS outline sur SVG `<g>`

**Fichier** : `src/styles/ghost.css:2-6`

```css
[data-ghost='1'] {
  opacity: 0.55;
  outline: 2px dashed rgba(255, 160, 0, 0.9);
  outline-offset: 2px;
}
```

**Problème** : La propriété CSS `outline` **ne fonctionne PAS de manière fiable sur les éléments SVG** `<g>`. Le support navigateur est limité.

**Référence** : [MDN SVG Styling](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/SVG_and_CSS)

**Conséquence** : Le contour pointillé orange n'apparaît probablement **jamais**, d'où l'absence de signal visuel pour les pièces non supportées.

---

## Analyse du blocage transverse

**Hypothèse initiale** : Le ghost de A bloque le drag de B.

**Réalité après analyse** : Non, car :

1. `handlePointerDown` ne vérifie pas `ui.ghost` (correct)
2. `validateNoOverlapSameLayer` filtre par couche indépendamment de `ui.ghost`
3. Le ghost est unique et isolé par `pieceId`

**Hypothèse #2** : Validation asynchrone de support cause un setState pendant le drag de B

**Vérification ligne 1890** (`src/state/useSceneStore.ts`) :

```typescript
Promise.resolve().then(async () => {
  await recalculateExactSupport(movedIds);
});
```

Cette promise async peut s'exécuter **pendant que B est draggé**, et bumpe `lastExactCheckAt`, ce qui peut déclencher des re-renders.

**Mais** : `lastExactCheckAt` n'est lu nulle part, donc ne devrait pas causer de problème.

**Hypothèse #3** : Le mode 'fast' donne des faux positifs qui bloquent

Si le mode 'fast' (AABB) détecte qu'un C2 est "supporté" alors qu'il ne l'est pas vraiment, cela ne devrait **pas** bloquer les autres pièces car :

- Support → WARN, jamais BLOCK
- Chaque pièce vérifie son propre support indépendamment

**Conclusion** : Le blocage transverse n'est PAS causé par le système ghost lui-même, mais possiblement par un **autre bug** non identifié dans la validation drag/resize.

**Action requise** : Logs réels avec `window.__DBG_DRAG__=true` pour confirmer.

---

## Correctifs proposés

### Correctif #1 : Stocker et utiliser les résultats exacts

**Fichier** : `src/state/useSceneStore.ts`

**Ajouter au store UI** (ligne ~640) :

```typescript
exactSupportResults?: Record<ID, boolean>;
lastExactCheckAt?: number;
```

**Modifier `recalculateExactSupport`** (ligne 889-894) :

```typescript
// Store exact results AND bump timestamp
useSceneStore.setState((state) => ({
  ui: {
    ...state.ui,
    exactSupportResults: exactResults,
    lastExactCheckAt: Date.now(),
  },
}));
```

**Modifier `useIsGhost`** (ligne 4182-4193) :

```typescript
// C2/C3: check support with appropriate mode
// Use exact results if available and fresh
const exactResults = s.ui.exactSupportResults;
const lastCheckAt = s.ui.lastExactCheckAt ?? 0;
const resultsFresh = Date.now() - lastCheckAt < 5000; // 5s freshness

if (exactResults && pieceId in exactResults && resultsFresh) {
  // Use stored exact results
  const isSupported = exactResults[pieceId];
  return {
    isGhost: !isSupported,
    hasBlock: false,
    hasWarn: !isSupported,
  };
}

// Fallback to fast mode if no exact results
const isSupported = isPieceFullySupported(s, pieceId, 'fast');
return {
  isGhost: !isSupported,
  hasBlock: false,
  hasWarn: !isSupported,
};
```

---

### Correctif #2 : Clear ghost lors du changement de sélection

**Fichier** : `src/state/useSceneStore.ts`

**Modifier `selectPiece`** (ligne 1180) :

```typescript
selectPiece: (id) =>
  set(
    produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = id ? [id] : undefined;
      draft.ui.primaryId = id;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);

      // Clear transient ghost when changing selection
      if (draft.ui.ghost && draft.ui.ghost.pieceId !== id) {
        draft.ui.ghost = undefined;
      }
    }),
  ),
```

**Idem pour `selectOnly`** (ligne 1191).

---

### Correctif #3 : Signal visuel robuste sur SVG

**Problème** : `outline` CSS ne marche pas sur `<g>` SVG.

**Solution** : Appliquer les styles directement sur le `<rect>` via `stroke` + `strokeDasharray`.

**Fichier** : `src/App.tsx:926-959`

**Modifier le `<rect>`** :

```typescript
<rect
  x="0"
  y="0"
  width={w}
  height={h}
  rx="6"
  ry="6"
  fill={isGhost ? (ghostHasBlock ? '#ef4444' : '#f59e0b') : '#60a5fa'}
  stroke={
    isFlashingInvalid
      ? '#ef4444'
      : isSelected || isFocused
        ? '#22d3ee'
        : isGhost
          ? '#f59e0b'  // Orange pour ghost WARN
          : '#1e3a8a'
  }
  strokeWidth={isGhost ? '4' : isSelected || isFocused ? '3' : '2'}
  strokeDasharray={isGhost && ghostHasWarn ? '4 4' : undefined}  // ← AJOUT
  onPointerDown={(e) => handlePointerDown(e, p.id)}
  style={{ cursor: 'pointer', opacity: isGhost ? 0.65 : 1 }}
  className={`${isFlashingInvalid ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]' : ''} ${isFlashing ? 'outline-flash' : ''}`}
/>
```

**Supprimer** `src/styles/ghost.css` (ou le rendre optionnel/legacy).

**Résultat** :

- Ghost WARN (support) : stroke orange, dasharray "4 4", opacity 0.65
- Ghost BLOCK (collision) : stroke rouge, solid, opacity 0.65

---

### Correctif #4 : Logs pour diagnostic du blocage transverse

**Ajouter dans `beginDrag`** (ligne 1433) :

```typescript
// DEV: Log drag start
if (import.meta.env.DEV && (window as any).__DBG_DRAG__) {
  console.log('[DRAG_START]', {
    pieceId: id,
    layerId: piece.layerId,
    selectedIds: finalSelectedIds,
    currentGhost: draft.ui.ghost
      ? {
          ghostPieceId: draft.ui.ghost.pieceId,
          problems: draft.ui.ghost.problems.length,
        }
      : null,
  });
}
```

**Ajouter dans `updateDrag` avant validation** (ligne 1635) :

```typescript
// DEV: Log validation input
if (import.meta.env.DEV && (window as any).__DBG_DRAG__) {
  console.log('[DRAG_VALIDATE_INPUT]', {
    selectedIds,
    isGroupDrag,
    candidatePosition: { x: finalX, y: finalY },
    currentGhost: draft.ui.ghost
      ? {
          ghostPieceId: draft.ui.ghost.pieceId,
          affects: selectedIds.includes(draft.ui.ghost.pieceId),
        }
      : null,
  });
}
```

---

## Critères d'acceptation (vérification)

1. **Signal visuel** :
   - Drop un C2 hors support → stroke orange dasharray "4 4" visible immédiatement
   - Log `[SUPPORT_CHECK]` montre `ghost: '1'`, `setHasBlockFrom: 'none'`

2. **Pas de blocage transverse** :
   - C2-A à cheval sur C1 (ghost) → C2-B ailleurs peut se déplacer librement
   - Logs montrent `sameLayerNeighbors` correct (0 si pas de voisin C2)

3. **Resize libre au-dessus de C1** :
   - C2 resize au-dessus de C1 (pas de C2 voisin) → aucun blocage
   - Logs montrent `sameLayerNeighbors: 0`

4. **Pas de faux positifs AABB** :
   - C2 partiellement hors C1 → détecté comme non supporté (via mode exact)
   - `exactSupportResults` stocké et utilisé par `useIsGhost`
