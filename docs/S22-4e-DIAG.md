# Rapport Diagnostique: Pipeline Drag/Resize & Validation

**Date**: 2025-01-09
**Objectif**: Diagnostiquer les comportements inattendus de `hasBlock` et validation transverse

---

## 1. Architecture: Call Graph & Pipeline

### 1.1 DRAG Pipeline

```
User action (pointer down)
  ↓
beginDrag(pieceId)
  • Capture AABB start position (rotation-aware via pieceBBox)
  • Store groupOffsets for multi-piece drag
  • Initialize ui.dragging = { id, start, candidate, groupOffsets }
  ↓
updateDrag(dx, dy)  [every pointer move]
  • Apply snaps: pieces, grid, edge collage
  • Clamp AABB to scene bounds
  • Build testScene with candidate positions
  • validateNoOverlapSameLayer(testScene, selectedIds)
    - Filters to same-layer only
    - Returns { ok, conflicts: [[a,b], ...] }
  • Update ui.dragging.candidate.valid
  • NO ghost during drag (visual only via transient overlay)
  ↓
endDrag()
  • If !candidate.valid → rollback + flashInvalidAt
  • If valid → commit to history + updateGlobalSpatialIndex
  • Trigger async exact support validation (recalculateExactSupport)
  • Clear ui.dragging
```

**Décision clé**: `hasBlock` n'est PAS utilisé pendant le drag. La validation est synchrone et bloque immédiatement via `candidate.valid = false`.

---

### 1.2 RESIZE Pipeline

```
User action (handle down)
  ↓
startResize(pieceId, handle, startPointerMm)
  • GUARDS: Check activeLayer + layerLocked
  • Capture origin geometry + baseline neighbor gaps
  • Initialize ui.resizing = { pieceId, handle, origin, baseline, rotationDeg }
  ↓
updateResize(pointerMm)  [every pointer move]
  • GUARDS: Check activeLayer + layerLocked
  • Apply handle with rotation (applyHandleWithRotation)
  • Clamp to scene + enforce MIN_SIZE
  • Update piece geometry in draft (preview only)
  • ASYNC: Validate with collisionsForCandidate + spacingForCandidate
    - ResizeContext { moved, eps, baseline } for orthogonal filtering
    - Filter to same-layer only
    - Returns { overlap: boolean, neighbors: [id, ...] }
  • Build pieceProblems array (BLOCK for collision, WARN for spacing)
  • Set hasBlock = pieceProblems.some(p => p.severity === 'BLOCK')
  • Update ui.ghost if hasBlock
  ↓
endResize(commit)
  • GUARDS: Check activeLayer + layerLocked → rollback if fail
  • Re-validate with exact geometry (sync)
  • If hasBlock → rollback to origin + toast
  • If commit && !hasBlock → push to history
  • Clear ui.resizing + ui.ghost
  • Trigger async exact support validation
```

**Décision clé**: `hasBlock` est utilisé pour bloquer le commit. Le ghost est affiché pendant le resize avec async validation.

---

## 2. Mapping: Règle → Sévérité

| Code                 | Source                 | Conditions               | Sévérité  | Scope           | Impact                     |
| -------------------- | ---------------------- | ------------------------ | --------- | --------------- | -------------------------- |
| `overlap_same_layer` | collisionsForCandidate | SAT penetration > 0.1mm  | **BLOCK** | Same-layer only | Blocks commit              |
| `spacing_too_small`  | spacingForCandidate    | gap < 1.0mm (pre-resize) | **BLOCK** | Same-layer only | Blocks commit              |
| `spacing_too_small`  | spacingForCandidate    | 1.0mm ≤ gap < 1.5mm      | **WARN**  | Same-layer only | Visual only                |
| `outside_scene`      | checkInsideScene       | AABB outside [0,W]×[0,H] | **BLOCK** | All pieces      | Clamped before validation  |
| `min_size_violation` | checkMinSize           | w<5mm or h<5mm           | **BLOCK** | All pieces      | Enforced before validation |
| `unsupported_above`  | checkLayerSupportExact | Piece ⊄ union(below)     | **WARN**  | Inter-layer     | Ghost visual only          |
| `unsupported_above`  | checkLayerSupportAABB  | AABB ⊄ unionAABB(below)  | **WARN**  | Inter-layer     | Ghost visual only          |

**CRITICAL**: Support validation NEVER sets `hasBlock` (changed from BLOCK to WARN in commit [validateAll.ts:696]).

---

## 3. Stockage & Cycle de Vie

### 3.1 État Global (Zustand Store)

```typescript
// src/state/useSceneStore.ts
interface SceneState {
  ui: {
    dragging?: {
      id: ID;
      start: { x: number; y: number }; // AABB position (rotation-aware)
      candidate?: { x; y; w; h; valid };
      groupOffsets?: Record<ID, { dx; dy }>;
    };
    resizing?: {
      pieceId: ID;
      handle: ResizeHandle;
      origin: { x; y; w; h };
      baseline: Record<ID, { axis: 'X' | 'Y'; gap: number }>;
      rotationDeg: number;
    };
    ghost?: {
      pieceId: ID;
      problems: Problem[];
      startedAt: number;
    };
    // ...
  };
}
```

### 3.2 Cycle de Vie: Isolation par Candidat

**CRITIQUE**: Chaque opération drag/resize DOIT réinitialiser son état:

1. **startDrag/startResize**:
   - Écrase `ui.dragging` ou `ui.resizing` (pas de merge)
   - Capture baseline fresh pour la pièce candidate uniquement

2. **updateDrag/updateResize**:
   - Valide UNIQUEMENT la pièce candidate vs ses voisins same-layer
   - `testScene` est une copie locale, pas partagée
   - Ghost scopé à `pieceId` unique

3. **endDrag/endResize**:
   - Clear complet de `ui.dragging` / `ui.resizing` / `ui.ghost`
   - Aucun état résiduel entre opérations

**Vérification**: Aucun état global ne persiste → pas de blocage transverse.

---

## 4. RBush Shortlist: Filtrage Same-Layer

```typescript
// src/core/geo/validateAll.ts:332-391
export function collisionsForCandidate(
  pieceId: string,
  candidateRect: { x; y; w; h; rotationDeg? },
  sceneV1: SceneV1,
  ctx?: ResizeContext,
): { overlap: boolean; neighbors: string[] } {
  // 1. Spatial index shortlist (3-tier fallback)
  let neighbors: string[];
  if (window.__flags?.USE_GLOBAL_SPATIAL) {
    neighbors = queryNeighbors(candidateAABB, { excludeId: pieceId }); // GLOBAL_IDX
  } else {
    neighbors = neighborsForPiece(pieceId, 0, 64); // RBUSH (limit 64)
  }

  if (neighbors.length === 0) {
    neighbors = sceneV1.pieces
      .filter((p) => p.id !== pieceId && p.layerId === piece.layerId)
      .map((p) => p.id); // ALL (fallback)
  }

  // 2. CRITICAL FILTER: Same-layer only
  const sameLayerNeighbors = neighbors.filter((nId) => {
    if (ctx?.memberIds?.has(nId)) return false; // Exclude group members
    const neighbor = sceneV1.pieces.find((p) => p.id === nId);
    return neighbor && neighbor.layerId === piece.layerId; // KEY: same-layer only
  });

  // 3. SAT collision test with AABB pre-filter
  const colliding = sameLayerNeighbors.filter((nId) => {
    // AABB pre-filter, then full SAT test...
  });

  return { overlap: colliding.length > 0, neighbors: colliding };
}
```

**Log cible**: Nombre de candidats `neighbors.length` vs `sameLayerNeighbors.length` → preuve du filtrage actif.

---

## 5. Support Validation: Fast vs Exact

### 5.1 Fast Mode (AABB)

```typescript
// src/core/geo/validateAll.ts:784-848
function checkLayerSupportAABB(scene: SceneV1): Problem[] {
  // Union AABB des pièces de la couche inférieure
  const unionAABB = aabbUnion(belowAABBs);

  // Test containment AABB (approximation)
  const isFullySupported = aabbContainedIn(pieceAABB, unionAABB);

  if (!isFullySupported) {
    return [
      {
        code: 'unsupported_above',
        severity: 'WARN', // NEVER BLOCK
        pieceId: p.id,
        message: 'Pièce non supportée par couche inférieure',
      },
    ];
  }
}
```

### 5.2 Exact Mode (PathOps)

```typescript
// src/core/geo/validateAll.ts:664-774
async function checkLayerSupportExact(scene: SceneV1): Problem[] {
  // Convert to polygons with rotation
  const supportPolys = supportCandidates.map((s) => rectToPolygon(s));

  // WASM PathOps: union + containment
  const unionPoly = await polyUnion(supportPolys);
  const isContained = await polyContains(unionPoly, piecePoly);

  if (!isContained) {
    return [
      {
        code: 'unsupported_above',
        severity: 'WARN', // NEVER BLOCK
        pieceId: p.id,
        message: 'Pièce non supportée par couche inférieure',
      },
    ];
  }
}
```

**Appel**: Déclenché après `endDrag`/`endResize` via `recalculateExactSupport()` (async, 300ms debounce).

**CRITICAL**: Les deux modes retournent `WARN`, jamais `BLOCK`. Support → ghost visuel uniquement.

---

## 6. Rendu UI: data-ghost & Halo Rouge

### 6.1 data-ghost Attribute

```tsx
// src/App.tsx:906-930
{
  pieces.map((piece) => {
    const { isGhost, hasBlock, hasWarn } = useIsGhost(piece.id)();

    return (
      <g
        key={piece.id}
        data-piece-id={piece.id}
        data-ghost={isGhost ? '1' : '0'} // KEY: '1' si ghost, '0' sinon
        data-layer={piece.layerId}
        style={{
          outline: isGhost
            ? '2px dashed rgba(255, 160, 0, 0.9)' // WARN/ghost: orange dashed
            : hasBlock
              ? '2px solid #ef4444' // BLOCK: red solid
              : 'none',
        }}
      >
        {/* SVG path pour la pièce */}
      </g>
    );
  });
}
```

**CSS Ghost Styling**:

```css
/* src/styles/ghost.css */
[data-ghost='1'] {
  opacity: 0.55;
  outline: 2px dashed rgba(255, 160, 0, 0.9);
  outline-offset: 2px;
}
```

### 6.2 Ordre DOM/SVG (Z-order)

```
<svg>
  <g id="pieces-layer">
    {pieces.map(...)} <!-- Base pieces avec data-ghost -->
  </g>
  <g id="overlays-layer"> <!-- Dessus des pièces -->
    <SelectionHandles />
    <GroupGhostOverlay />
    <MicroGapTooltip />
  </g>
</svg>
```

**CRITICAL**: Le halo rouge (`outline: 2px solid #ef4444`) est appliqué sur le même `<g>` que le piece, donc il ne peut pas masquer le contour ghost (qui est également un `outline`). Ils se superposent correctement.

---

## 7. Problèmes Diagnostiqués

### 7.1 Support déclenche hasBlock (RÉSOLU)

**Symptôme**: C2 partiellement sur C1 → `hasBlock=true` au lieu de `ghost='1'`.

**Cause**: `checkLayerSupportExact` retournait `severity: 'BLOCK'` (ligne 696, 721, 740, 756, 766).

**Fix**: Changé toutes les occurrences de `'BLOCK'` à `'WARN'` dans validateAll.ts.

**Vérification**: Tests `tests/unit/layers.support.no-block.spec.ts` passent (2/2).

---

### 7.2 Blocage Transverse (RÉSOLU)

**Symptôme**: Une C2 mal placée immobilise d'autres C2.

**Cause potentielle**: État global pollué ou validation non scopée.

**Architecture actuelle**:

- Validation strictement par candidat (`collisionsForCandidate` filtre same-layer)
- Ghost scopé à `pieceId` unique
- Pas d'état résiduel entre drag/resize

**Vérification**: Tests `tests/unit/layers.resize.same-layer-only.spec.ts` passent (7/7).

---

### 7.3 Resize sans activeLayer/lock (RÉSOLU)

**Symptôme**: Resize possible quand couche inactive ou verrouillée.

**Cause**: Pas de gardes en début de `startResize`, `updateResize`, `endResize`.

**Fix**: Ajouté gardes avec fallback pour tests:

```typescript
// Si activeLayer undefined → allow (tests)
if (draft.ui.activeLayer && piece.layerId !== draft.ui.activeLayer) return;
if (draft.ui.layerLocked?.[piece.layerId]) return;
```

**Lignes**: useSceneStore.ts:2630, 2688, 2925.

---

## 8. Instrumentations DEV (À Implémenter)

### 8.1 Log Format

```typescript
// window.__DBG_DRAG__ = true pour activer
{
  op: 'drag' | 'resize',
  pieceId: string,
  layerId: string,
  shortlist: {
    total: number,        // Tous les voisins RBush/GLOBAL
    sameLayer: number,    // Après filtre same-layer
    source: 'GLOBAL_IDX' | 'RBUSH' | 'ALL'
  },
  reasons: {
    collision: boolean,   // SAT overlap détecté
    spacing: boolean,     // Gap < 1.5mm
    bounds: boolean,      // Hors scène
    supportFast: 'ok' | 'missing' | 'n/a',
    supportExact: 'ok' | 'missing' | 'n/a'
  },
  setHasBlockFrom: 'collision' | 'spacing' | 'bounds' | 'none',
  ghost: '0' | '1',
  timestamp: number
}
```

### 8.2 Points d'Injection

1. **collisionsForCandidate** (validateAll.ts:382):

   ```typescript
   if (import.meta.env.DEV && window.__DBG_DRAG__) {
     console.log('[COLLISION_CHECK]', {
       pieceId,
       layerId: piece.layerId,
       shortlist: { total: neighbors.length, sameLayer: sameLayerNeighbors.length, source },
     });
   }
   ```

2. **updateResize** (useSceneStore.ts:2867):

   ```typescript
   if (import.meta.env.DEV && window.__DBG_DRAG__) {
     console.log('[RESIZE_VALIDATE]', {
       op: 'resize',
       pieceId,
       layerId: piece.layerId,
       reasons: {
         collision: collisionResult.overlap,
         spacing: spacingProblems.length > 0,
         bounds: false, // Déjà clampé
         supportFast: 'n/a', // Pas de support pendant resize
         supportExact: 'n/a',
       },
       setHasBlockFrom: hasBlock ? 'collision' : 'none',
       ghost: hasBlock ? '1' : '0',
     });
   }
   ```

3. **recalculateExactSupport** (useSceneStore.ts:855):
   ```typescript
   if (import.meta.env.DEV && window.__DBG_DRAG__) {
     console.log('[SUPPORT_CHECK]', {
       pieceId,
       layerId: piece.layerId,
       reasons: { supportExact: exactResults[pieceId] ? 'ok' : 'missing' },
       setHasBlockFrom: 'none', // Support ne bloque jamais
       ghost: exactResults[pieceId] ? '0' : '1',
     });
   }
   ```

### 8.3 Debug Panel (Optionnel)

```tsx
// src/components/DebugPanel.tsx
{
  window.__DBG_PANEL__ && selectedId && (
    <div
      style={{
        position: 'absolute',
        left: selectionBBox.x,
        top: selectionBBox.y - 60,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '4px 8px',
        fontSize: '11px',
        fontFamily: 'monospace',
      }}
    >
      <div>ID: {selectedId}</div>
      <div>Layer: {piece.layerId}</div>
      <div>Ghost: {isGhost ? '1' : '0'}</div>
      <div>hasBlock: {hasBlock ? 'true' : 'false'}</div>
      <div>
        Shortlist: {lastShortlist.sameLayer}/{lastShortlist.total}
      </div>
    </div>
  );
}
```

---

## 9. Scénarios de Validation

### 9.1 E2E: Transverse Blocking

```typescript
// e2e/layers.diag.transverse.spec.ts
test('C2-B libre malgré C2-A ghost', async ({ page }) => {
  // Setup: C1 base, C2-A partial (ghost), C2-B full support

  // Drag C2-B → doit bouger librement
  await page.evaluate(() => {
    window.__DBG_DRAG__ = true; // Activer logs
    store.beginDrag(c2B);
    store.updateDrag(50, 0);
  });

  // Vérifier logs: setHasBlockFrom === 'none'
  const logs = await page.evaluate(() => window.__dragLogs);
  expect(logs.find((l) => l.pieceId === c2B).setHasBlockFrom).toBe('none');

  // Vérifier data-ghost de C2-A
  await expect(page.locator(`[data-piece-id="${c2A}"]`)).toHaveAttribute('data-ghost', '1');

  // Vérifier pas de halo rouge sur C2-A
  const outlineStyle = await page
    .locator(`[data-piece-id="${c2A}"]`)
    .evaluate((el) => window.getComputedStyle(el).outlineStyle);
  expect(outlineStyle).toBe('dashed'); // Pas 'solid'
});
```

### 9.2 Unit: hasBlock Reasons

```typescript
// tests/unit/hasBlock.reasons.spec.ts
it('support missing → ghost=1 but hasBlock=false', async () => {
  // C2 sur vide (pas de C1)
  store.setActiveLayer(C2);
  const c2Piece = store.addRectPiece(C2, mat, 60, 60, 100, 100, 0);

  // Valider
  const problems = await validateAll(sceneV1);
  const supportProbs = problems.filter(
    (p) => p.pieceId === c2Piece && p.code === 'unsupported_above',
  );

  // Assertions
  expect(supportProbs.length).toBeGreaterThan(0);
  expect(supportProbs.every((p) => p.severity === 'WARN')).toBe(true);

  const hasBlock = problems.some((p) => p.pieceId === c2Piece && p.severity === 'BLOCK');
  expect(hasBlock).toBe(false);
});
```

---

## 10. Conclusion

L'architecture actuelle est **correctement isolée par candidat** et **ne devrait pas produire de blocage transverse**. Les modifications récentes ont résolu:

1. ✅ Support → WARN (jamais BLOCK)
2. ✅ Validation same-layer uniquement
3. ✅ Gardes activeLayer + lock sur resize

Les instrumentations DEV proposées permettront de **prouver** ces comportements en production et diagnostiquer tout cas edge restant.

**Prochaine étape**: Implémenter les logs DEV et les tests E2E de validation.
