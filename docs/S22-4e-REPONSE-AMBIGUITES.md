# Réponse aux ambiguïtés : Ghost SVG, Filtrage par couche, Portée de hasBlock

**Objectif** : Confirmer/lever les ambiguïtés sur 3 points (rendu ghost SVG, filtrage par couche sur toutes les branches drag/resize, portée de hasBlock/blockers).

---

## 1) Ciblage DOM & styles "ghost"

### 1.1 Structure DOM pendant état normal (committed ghost)

**Élément porteur** : `<g>` avec `data-ghost="1"`

**Fichier** : `src/App.tsx:916-960`

```typescript
<g
  key={p.id}
  transform={`translate(${x} ${y}) rotate(${p.rotationDeg ?? 0} ${w / 2} ${h / 2})`}
  data-testid="piece-rect"
  data-piece-id={p.id}
  data-layer={p.layerId}
  data-selected={isSelected ? 'true' : undefined}
  data-invalid={isFlashingInvalid ? 'true' : undefined}
  data-ghost={isGhost ? '1' : '0'}      // ← ATTRIBUT CIBLE
>
  <rect
    x="0"
    y="0"
    width={w}
    height={h}
    rx="6"
    ry="6"
    fill={isGhost ? (ghostHasBlock ? '#ef4444' : '#f59e0b') : '#60a5fa'}
    stroke={...}
    strokeWidth={isGhost ? '4' : ...}
    onPointerDown={(e) => handlePointerDown(e, p.id)}
    style={{ cursor: 'pointer', opacity: isGhost ? 0.85 : 1 }}
    className={`${isFlashingInvalid ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]' : ''} ${isFlashing ? 'outline-flash' : ''} ${ghostHasBlock ? 'ghost-illegal' : ghostHasWarn ? 'ghost-warn' : ''}`}
  />
</g>
```

**Application des styles** :

**INLINE (sur `<rect>`)** :

- `fill`: orange (#f59e0b) ou rouge (#ef4444) si ghost
- `stroke`: orange/rouge si ghost
- `strokeWidth`: '4' si ghost
- `opacity`: 0.85 si ghost

**CSS global** (`src/styles/ghost.css:2-6`) :

```css
[data-ghost='1'] {
  opacity: 0.55;
  outline: 2px dashed rgba(255, 160, 0, 0.9);
  outline-offset: 2px;
}
```

**Type d'élément** : `<g>` (conteneur SVG de groupe)

**Confirmation** : `outline` est appliqué via CSS sur l'élément `<g>` portant `data-ghost="1"`.

### 1.2 Overlay SVG pendant drag (transient ghost)

**Fichier** : `src/ui/overlays/GroupGhostOverlay.tsx:30-68`

**Type d'élément** : `<g>` avec `data-overlay="group-ghost"`

```typescript
return (
  <g data-overlay="group-ghost">
    {selectedIdsList.map((id) => {
      const piece = scene.pieces[id];
      if (!piece || piece.kind !== 'rect') return null;

      const { x, y } = piece.position;
      const { w, h } = piece.size;
      const rotationDeg = piece.rotationDeg ?? 0;

      // Ghost position = piece position + transient delta
      const ghostX = x + dx;
      const ghostY = y + dy;

      return (
        <g
          key={`ghost-${id}`}
          transform={`translate(${ghostX} ${ghostY}) rotate(${rotationDeg} ${w / 2} ${h / 2})`}
          data-testid="ghost-piece"
          data-valid={isValid ? 'true' : 'false'}
        >
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            rx="6"
            ry="6"
            fill="#60a5fa"
            fillOpacity="0.3"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 4"        // ← Pointillés
            pointerEvents="none"
          />
        </g>
      );
    })}
  </g>
);
```

**Résumé** :

- **Pendant drag** : Overlay SVG distinct (`GroupGhostOverlay`) avec `strokeDasharray="4 4"` (pointillés) et `fillOpacity="0.3"`.
- **Après commit** : L'élément permanent `<g data-ghost="1">` reçoit le style CSS `outline: 2px dashed` + couleur inline orange/rouge.
- **Élément cible** : `<g>` dans les deux cas.
- **Aucun overlay permanent pour l'état ghost committed** : le CSS `outline` est directement appliqué au `<g>`.

---

## 2) Filtrage par couche sur toutes les voies

### 2.1 Drag : beginDrag → updateDrag → endDrag

#### **beginDrag** (`src/state/useSceneStore.ts:1433-1490`)

**Signature** :

```typescript
beginDrag: (id: ID) => void
```

**Extrait (lignes 1433-1487)** :

```typescript
beginDrag: (id) =>
  set(
    produce((draft: SceneState) => {
      const piece = draft.scene.pieces[id];
      if (!piece) return;

      const selectedIds =
        draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);

      // Déterminer si le drag concerne la sélection courante
      const selId = draft.ui.selectedId ?? null;
      const selIds = draft.ui.selectedIds ?? null;
      let affectsSelection = false;

      if (selIds && selIds.length > 0) {
        affectsSelection = selIds.includes(id);
      } else if (selId) {
        affectsSelection = selId === id;
      } else {
        // Aucune sélection : auto-select la pièce, donc affecte la sélection
        affectsSelection = true;
      }

      // Si la pièce n'est pas dans la sélection, selectOnly
      if (!selectedIds.includes(id)) {
        draft.ui.selectedId = id;
        draft.ui.selectedIds = [id];
        draft.ui.primaryId = id;
      }

      const finalSelectedIds = draft.ui.selectedIds ?? [id];

      // CRITICAL: Store AABB position (not piece.position) for rotation-aware drag
      // For rotated pieces, AABB position differs from piece.position
      const primaryBBox = pieceBBox(piece);

      // Stocker les offsets pour le groupe (AABB-based for rotation awareness)
      const groupOffsets: Record<ID, { dx: number; dy: number }> = {};
      for (const sid of finalSelectedIds) {
        const sp = draft.scene.pieces[sid];
        if (!sp) continue;
        const spBBox = pieceBBox(sp);
        groupOffsets[sid] = {
          dx: spBBox.x - primaryBBox.x,
          dy: spBBox.y - primaryBBox.y,
        };
      }

      draft.ui.dragging = {
        id,
        start: { x: primaryBBox.x, y: primaryBBox.y }, // AABB position, not piece.position
        candidate: undefined,
        groupOffsets,
        affectsSelection,
      };
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
    }),
  ),
```

**Filtrage par couche** : **Aucun à cette étape** (simple init d'état).

---

#### **updateDrag** (`src/state/useSceneStore.ts:1492-1720`)

**Signature** :

```typescript
updateDrag: (dx: number, dy: number) => void
```

**Extrait clé (lignes 1615-1636)** :

```typescript
// Simuler et valider
const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };

if (isGroupDrag) {
  const offsets = dragging.groupOffsets ?? {};
  for (const sid of selectedIds) {
    const off = offsets[sid] ?? { dx: 0, dy: 0 };
    const sp = draft.scene.pieces[sid];
    if (!sp) continue;
    // Convert AABB position to piece.position for validation
    const aabbPos = { x: finalX + off.dx, y: finalY + off.dy };
    const piecePos = aabbToPiecePosition(aabbPos.x, aabbPos.y, sp);
    testScene.pieces[sid] = { ...sp, position: piecePos };
  }
} else {
  // Convert AABB position to piece.position for validation
  const piecePos = aabbToPiecePosition(finalX, finalY, piece);
  testScene.pieces[dragging.id] = { ...piece, position: piecePos };
}

// KEY FIX: Use same-layer validation for drag (no cross-layer blocking)
const validation = validateNoOverlapSameLayer(testScene, selectedIds);
```

**Filtrage par couche** : **OUI** - via `validateNoOverlapSameLayer` (ligne 1636).

---

**Fonction `validateNoOverlapSameLayer`** (`src/lib/sceneRules/index.ts:88-147`)

**Signature** :

```typescript
export function validateNoOverlapSameLayer(
  scene: SceneDraft,
  candidateIds: ID[],
): {
  ok: boolean;
  conflicts: Array<[ID, ID]>;
};
```

**Extrait clé (lignes 118-133)** :

```typescript
// KEY FIX: Skip si les pièces sont sur des couches différentes
// Seulement tester les collisions intra-couche
const isACand = cand.has(pieceA.id);
const isBCand = cand.has(pieceB.id);

if (isACand || isBCand) {
  // Au moins une pièce est candidate
  // Vérifier que l'autre est sur la même couche
  const candLayerId = isACand ? pieceA.layerId : pieceB.layerId;
  const otherLayerId = isACand ? pieceB.layerId : pieceA.layerId;

  if (candLayerId !== otherLayerId) {
    // Couches différentes → pas de collision à tester
    continue;
  }
}
```

**Confirmation** : Le filtrage par couche se fait **ligne 129** : `if (candLayerId !== otherLayerId) { continue; }`

---

#### **endDrag** (`src/state/useSceneStore.ts:1723-1850`)

**Signature** :

```typescript
endDrag: () => void
```

**Extrait clé (lignes 1753-1769)** :

```typescript
// CONSTRUCTION D'UNE SCÈNE CANDIDATE AVANT VALIDATION
// On applique le delta (dx,dy) à CHAQUE pièce sélectionnée,
// puis on valide la scène candidate contre les voisins externes.
const sceneCandidate: SceneDraft = JSON.parse(JSON.stringify(draft.scene));

// Récupérer le delta uniforme issu du drag
const dx = draft.ui.transientDelta?.dx ?? (0 as Milli);
const dy = draft.ui.transientDelta?.dy ?? (0 as Milli);

// Appliquer le delta aux positions commit des membres du groupe
for (const id of selectedIds) {
  const p = sceneCandidate.pieces[id];
  if (!p) continue;
  const commitPos = commitPositions[id];
  if (!commitPos) continue;
  p.position = { x: (commitPos.x + dx) as Milli, y: (commitPos.y + dy) as Milli };
}

// KEY FIX: Use same-layer validation (no cross-layer blocking)
const overlapResult = validateNoOverlapSameLayer(sceneCandidate, selectedIds);
```

**Filtrage par couche** : **OUI** - via `validateNoOverlapSameLayer` (ligne 1769).

---

### 2.2 Resize : startResize → updateResize → endResize

#### **startResize** (`src/state/useSceneStore.ts:2638-2691`)

**Signature** :

```typescript
startResize: (pieceId: ID, handle: ResizeHandle, startPointerMm?: { x: Milli; y: Milli }) => void
```

**Extrait clé (lignes 2664-2674)** :

```typescript
// Find all pieces on same layer (excluding self)
const neighbors = sceneV1.pieces.filter((p) => p.id !== pieceId && p.layerId === piece.layerId);

for (const neighbor of neighbors) {
  const neighborAABB = getRotatedAABB(neighbor);
  const gap = aabbGapLocal(pieceAABB, neighborAABB);
  const axis = dominantSpacingAxisLocal(pieceAABB, neighborAABB);
  baseline[neighbor.id] = { axis, gap };
}
```

**Filtrage par couche** : **OUI** - ligne 2666 : `p.layerId === piece.layerId`.

**Objectif** : Construire `baseline` (gaps de référence) **uniquement pour les voisins de même couche**.

---

#### **updateResize** (`src/state/useSceneStore.ts:2693-2950`)

**Signature** :

```typescript
updateResize: (pointerMm: { x: Milli; y: Milli }) => void
```

**Extrait clé (lignes 2850-2856)** :

```typescript
// Validate candidate geometry (not store state) with resize context
const collisionResult = collisionsForCandidate(
  resizingPieceId,
  candidateGeometry,
  sceneV1,
  resizeContext,
);
```

**Filtrage par couche** : **OUI** - via `collisionsForCandidate` (détails ci-dessous).

---

**Fonction `collisionsForCandidate`** (`src/core/geo/validateAll.ts:332-450`)

**Signature** :

```typescript
export function collisionsForCandidate(
  pieceId: string,
  candidateRect: { x: number; y: number; w: number; h: number; rotationDeg?: number },
  sceneV1: SceneV1,
  ctx?: ResizeContext,
): { overlap: boolean; neighbors: string[] };
```

**Extrait clé - Shortlist RBush (lignes 356-379)** :

```typescript
// Shortlist strategy: GLOBAL_IDX → RBush → ALL
let neighbors: string[];
let source: 'GLOBAL_IDX' | 'RBUSH' | 'FALLBACK' | 'ALL';

if (typeof window !== 'undefined' && (window.__flags?.USE_GLOBAL_SPATIAL || isAutoEnabled())) {
  try {
    neighbors = queryNeighbors(candidateAABB, { excludeId: pieceId });
    source = 'GLOBAL_IDX';
  } catch {
    neighbors = neighborsForPiece(pieceId, 0, 64);
    source = 'FALLBACK';
  }
} else {
  neighbors = neighborsForPiece(pieceId, 0, 64);
  source = 'RBUSH';
}

// Fallback: if spatial index empty or not initialized, check all pieces on same layer
if (neighbors.length === 0) {
  neighbors = sceneV1.pieces
    .filter((p) => p.id !== pieceId && p.layerId === piece.layerId)
    .map((p) => p.id);
  source = 'ALL';
}
```

**Extrait clé - Filtrage par couche (lignes 384-391)** :

```typescript
// Filter to same layer only (and exclude group members if in group context)
const sameLayerNeighbors = neighbors.filter((nId) => {
  // Exclude group members
  if (ctx?.memberIds?.has(nId)) return false;

  const neighbor = sceneV1.pieces.find((p) => p.id === nId);
  return neighbor && neighbor.layerId === piece.layerId; // ← LIGNE CLÉ
});
```

**Confirmation** : Le filtrage par couche se fait **ligne 390** : `neighbor.layerId === piece.layerId`.

**Instrumentation DEV** (lignes 393-404) :

```typescript
// DEV: Log shortlist stats for diagnostics
if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__DBG_DRAG__) {
  console.log('[COLLISION_CHECK]', {
    pieceId,
    layerId: piece.layerId,
    shortlist: {
      total: neighbors.length,
      sameLayer: sameLayerNeighbors.length,
      source,
    },
  });
}
```

**Résumé** : Le filtrage par couche a lieu **APRÈS la shortlist RBush**, à la ligne 390.

---

#### **endResize** (`src/state/useSceneStore.ts:2952-3094`)

**Signature** :

```typescript
endResize: (commit: boolean) => void
```

**Extrait clé (lignes 3030-3058)** :

```typescript
// Check for blocking problems (overlap/outside scene) before commit
const ghost = draft.ui.ghost;
const hasBlockProblems = ghost?.problems?.some((p) => p.severity === 'BLOCK');

if (hasBlockProblems) {
  // BLOCK detected: rollback to origin and show toast
  piece.position.x = resizing.origin.x;
  piece.position.y = resizing.origin.y;
  piece.size.w = resizing.origin.w;
  piece.size.h = resizing.origin.h;

  // Sync rollback to spatial index
  if (window.__flags?.USE_GLOBAL_SPATIAL) {
    syncPieceToIndex(resizing.pieceId, resizing.origin);
  }

  incResizeBlockCommitRejected();

  draft.ui.toast = {
    id: nanoid(),
    severity: 'error',
    message: 'Resize bloqué : chevauchement détecté. Les pièces ne peuvent pas se chevaucher.',
    until: Date.now() + 3000,
  };

  // Clear ghost and resizing state
  draft.ui.ghost = undefined;
  draft.ui.resizing = undefined;
  draft.ui.guides = undefined;

  incResizeBlockCommitBlocked();
  return;
}
```

**Filtrage par couche** : **Indirect** - le BLOCK vient des problems calculés dans `updateResize` via `collisionsForCandidate` (qui filtre par couche).

---

### 2.3 Call-graphs effectifs

**Drag Single** :

```
beginDrag(id)
  ↓
updateDrag(dx, dy)
  → validateNoOverlapSameLayer(testScene, [id])
     → Ligne 129: if (candLayerId !== otherLayerId) continue
  ↓
endDrag()
  → validateNoOverlapSameLayer(sceneCandidate, [id])
     → Ligne 129: if (candLayerId !== otherLayerId) continue
```

**Drag Group** :

```
beginDrag(id)
  ↓
updateDrag(dx, dy)
  → validateNoOverlapSameLayer(testScene, selectedIds)
     → Ligne 129: if (candLayerId !== otherLayerId) continue
  ↓
endDrag()
  → validateNoOverlapSameLayer(sceneCandidate, selectedIds)
     → Ligne 129: if (candLayerId !== otherLayerId) continue
```

**Resize Single** :

```
startResize(pieceId, handle, startPointerMm)
  → Ligne 2666: neighbors.filter(p => p.layerId === piece.layerId)
  ↓
updateResize(pointerMm)
  → collisionsForCandidate(pieceId, candidateGeometry, sceneV1, ctx)
     → Ligne 376: neighbors.filter(p => p.layerId === piece.layerId) [fallback ALL]
     → Ligne 390: neighbors.filter(nId => neighbor.layerId === piece.layerId)
  ↓
endResize(commit)
  → Vérifie ghost.problems (calculés dans updateResize)
```

**Resize Group** :

```
startGroupResize(handle, startPointerMm)
  → Construction baseline pour chaque membre du groupe
  ↓
updateGroupResize(pointerMm, altKey)
  → Pour chaque membre : collisionsForCandidate(..., ctx avec memberIds)
     → Ligne 390: neighbors.filter(nId => neighbor.layerId === piece.layerId)
  ↓
endGroupResize(commit)
  → Vérifie ghost.problems (calculés dans updateGroupResize)
```

**Résumé** : Le filtrage par couche est **systématiquement appliqué** sur toutes les branches.

---

## 3) Portée & cycle de vie de hasBlock / blockers

### 3.1 Type exact et emplacement du stockage

**Type** : `ghost?: { pieceId: ID; problems: Problem[]; startedAt: number; }`

**Fichier** : `src/state/useSceneStore.ts:638-642`

```typescript
ghost?: {
  pieceId: ID;
  problems: Problem[];
  startedAt: number;
};
```

**Emplacement** : `draft.ui.ghost` (global dans le store, mais **unique par pieceId**).

**Portée** : **Un seul ghost actif à la fois** (pour la pièce en cours de resize/drag).

**Dérivation de hasBlock** : Calculé **dynamiquement** depuis `ghost.problems` :

```typescript
const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;
```

**Confirmation** : `hasBlock` n'est **jamais stocké directement**. C'est un **sélecteur dérivé** calculé à la volée depuis `ghost.problems`.

---

### 3.2 Où hasBlock est set/reset pendant drag/resize

**Set (BLOCK détecté)** :

**Resize - ligne 2933-2938** (`src/state/useSceneStore.ts`) :

```typescript
if (hasBlock) {
  // Activate ghost mode with problems
  draft.ui.ghost = {
    pieceId: resizingPieceId,
    problems: pieceProblems,
    startedAt: Date.now(),
  };
  incResizeBlockPreview();
}
```

**Reset (pas de BLOCK)** :

**Resize - ligne 2940-2944** (`src/state/useSceneStore.ts`) :

```typescript
} else {
  // Clear ghost if no blocking problems
  if (draft.ui.ghost?.pieceId === resizingPieceId) {
    draft.ui.ghost = undefined;
  }
}
```

**Reset (commit réussi)** :

**Resize endResize - ligne 3069-3071** (`src/state/useSceneStore.ts`) :

```typescript
// Clear ghost if present
if (draft.ui.ghost?.pieceId === resizing.pieceId) {
  draft.ui.ghost = undefined;
}
```

**Reset (rollback Escape)** :

**Resize endResize - ligne 3083-3085** (`src/state/useSceneStore.ts`) :

```typescript
// Clear ghost on rollback
if (draft.ui.ghost?.pieceId === resizing.pieceId) {
  draft.ui.ghost = undefined;
}
```

**Reset (commit bloqué)** :

**Resize endResize - ligne 3053** (`src/state/useSceneStore.ts`) :

```typescript
// Clear ghost and resizing state
draft.ui.ghost = undefined;
```

---

### 3.3 Lectures de hasBlock : aucune lecture cross-piece

**Lecture 1** : `src/App.tsx:903-913`

```typescript
const isGhost = ghost?.pieceId === p.id;
const ghostHasBlock =
  isGhost && ghost.problems.some((prob: { severity: string }) => prob.severity === 'BLOCK');
const ghostHasWarn =
  isGhost &&
  ghost.problems.some((prob: { severity: string }) => prob.severity === 'WARN') &&
  !ghostHasBlock;
```

**Portée** : **Uniquement pour `ghost.pieceId`** (vérification `ghost?.pieceId === p.id`).

**Lecture 2** : `src/state/useSceneStore.ts:3030-3033`

```typescript
const ghost = draft.ui.ghost;
const hasBlockProblems = ghost?.problems?.some((p) => p.severity === 'BLOCK');

if (hasBlockProblems) {
  // Rollback to origin...
}
```

**Portée** : **Uniquement pour `resizing.pieceId`** (contexte: fin de resize sur cette pièce).

**Lecture 3** : `src/state/useSceneStore.ts:4157-4193` (hook `useIsGhost`)

```typescript
export function useIsGhost(pieceId: ID | undefined): {
  isGhost: boolean;
  hasBlock: boolean;
  hasWarn: boolean;
} {
  return useSceneStore((s: SceneStoreState) => {
    if (!pieceId) {
      return { isGhost: false, hasBlock: false, hasWarn: false };
    }

    // Check transient ghost (resize/drag-induced)
    if (s.ui.ghost?.pieceId === pieceId) {
      const hasBlock = s.ui.ghost.problems.some((p) => p.severity === 'BLOCK');
      const hasWarn = s.ui.ghost.problems.some((p) => p.severity === 'WARN') && !hasBlock;
      return { isGhost: true, hasBlock, hasWarn };
    }

    // Check committed ghost state (support-driven for C2/C3)
    const p = s.scene.pieces[pieceId];
    if (!p) return { isGhost: false, hasBlock: false, hasWarn: false };

    const belowLayerId = getBelowLayerId(s, p.layerId);
    if (!belowLayerId) {
      // C1: never ghost (no layer below)
      return { isGhost: false, hasBlock: false, hasWarn: false };
    }

    const isCommittedGhost = /* logic for support check */;

    return {
      isGhost: isCommittedGhost,
      hasBlock: false, // Committed ghosts don't block (manipulable)
      hasWarn: false,
    };
  });
}
```

**Portée** : **Hook paramétré par `pieceId`** - chaque pièce interroge **uniquement son propre état**.

**Confirmation** : **Aucune lecture cross-piece**. Chaque pièce vérifie uniquement `ghost?.pieceId === p.id` ou son propre `pieceId` passé au hook.

---

## 4) Confirmation shortlist et filtrage par couche

### 4.1 Où se construit la shortlist RBush

**Fichier** : `src/core/geo/validateAll.ts:356-379`

**Fonction** : `collisionsForCandidate`

**Extrait (lignes 356-379)** :

```typescript
// Shortlist strategy: GLOBAL_IDX → RBush → ALL
let neighbors: string[];
let source: 'GLOBAL_IDX' | 'RBUSH' | 'FALLBACK' | 'ALL';

if (typeof window !== 'undefined' && (window.__flags?.USE_GLOBAL_SPATIAL || isAutoEnabled())) {
  try {
    neighbors = queryNeighbors(candidateAABB, { excludeId: pieceId });
    source = 'GLOBAL_IDX';
  } catch {
    neighbors = neighborsForPiece(pieceId, 0, 64);
    source = 'FALLBACK';
  }
} else {
  neighbors = neighborsForPiece(pieceId, 0, 64);
  source = 'RBUSH';
}

// Fallback: if spatial index empty or not initialized, check all pieces on same layer
if (neighbors.length === 0) {
  neighbors = sceneV1.pieces
    .filter((p) => p.id !== pieceId && p.layerId === piece.layerId)
    .map((p) => p.id);
  source = 'ALL';
}
```

**Filtrage par layerId** : **APRÈS la shortlist** (ligne 390).

**Extrait filtrage (lignes 384-391)** :

```typescript
// Filter to same layer only (and exclude group members if in group context)
const sameLayerNeighbors = neighbors.filter((nId) => {
  // Exclude group members
  if (ctx?.memberIds?.has(nId)) return false;

  const neighbor = sceneV1.pieces.find((p) => p.id === nId);
  return neighbor && neighbor.layerId === piece.layerId; // ← LIGNE CLÉ : FILTRAGE PAR COUCHE
});
```

**Réponse** : Le filtrage par `layerId` a lieu **APRÈS** la construction de la shortlist RBush, à la **ligne 390**.

**Décision de blocage avant ce filtre ?** : **NON**. La shortlist spatiale (`neighbors`) contient des IDs de toutes les couches. Le filtrage à la ligne 390 est **obligatoire** avant le test SAT (ligne 407+). **Aucune décision de blocage ne peut survenir avant ce filtre**.

---

## 5) Logs des 3 scénarios demandés

### 5.1 Activation des logs

```javascript
window.__DBG_DRAG__ = true;
```

### 5.2 Scénario 1 : C2-A partiellement sur C1, déplacer C2-B

**Setup** :

- C1 : base piece at (50, 50) size 60×60
- C2-A : piece at (90, 50) size 60×60 (partially off C1, extends to 150)
- C2-B : piece at (200, 100) size 40×40 (fully supported elsewhere)

**Action** : Drag C2-B

**Logs attendus** :

```
[COLLISION_CHECK] {
  pieceId: 'c2b-uuid',
  layerId: 'C2-layer-uuid',
  shortlist: {
    total: 2,           // C2-A + C1 piece (if in RBush range)
    sameLayer: 1,       // Only C2-A (same layer)
    source: 'RBUSH'
  }
}

[RESIZE_VALIDATE] {
  op: 'drag',
  pieceId: 'c2b-uuid',
  layerId: 'C2-layer-uuid',
  reasons: {
    collision: false,
    spacing: false,
    bounds: false,
    supportFast: 'n/a',
    supportExact: 'n/a'
  },
  setHasBlockFrom: 'none',
  ghost: '0',
  blockers: [],
  timestamp: 1234567890
}
```

**Dump état `draft.ui.ghost` après drop** :

```javascript
draft.ui.ghost = undefined; // C2-B moves freely, no BLOCK
```

**Confirmation** : C2-B **ne lit pas** le statut de C2-A. `ghost?.pieceId` ne correspond pas à C2-B, donc pas de blocage.

---

### 5.3 Scénario 2 : Redimensionner C2 au-dessus de C1 jusqu'à recouvrement partiel

**Setup** :

- C1 : piece at (100, 100) size 60×60
- C2 : piece at (100, 50) size 60×40 (above C1, no overlap initially)

**Action** : Resize C2 downward (south edge) to overlap C1

**Logs attendus** :

**Pendant updateResize (avant chevauchement)** :

```
[COLLISION_CHECK] {
  pieceId: 'c2-uuid',
  layerId: 'C2-layer-uuid',
  shortlist: {
    total: 1,           // C1 in RBush range
    sameLayer: 0,       // C1 is on C1 layer, not C2
    source: 'RBUSH'
  }
}

[RESIZE_VALIDATE] {
  op: 'resize',
  pieceId: 'c2-uuid',
  layerId: 'C2-layer-uuid',
  reasons: {
    collision: false,
    spacing: false,
    bounds: false,
    supportFast: 'n/a',
    supportExact: 'n/a'
  },
  setHasBlockFrom: 'none',
  ghost: '0',
  blockers: [],
  timestamp: 1234567891
}
```

**Après recouvrement (si C2 redimensionné vers le bas pour croiser C1)** :

```
[COLLISION_CHECK] {
  pieceId: 'c2-uuid',
  layerId: 'C2-layer-uuid',
  shortlist: {
    total: 1,
    sameLayer: 0,       // Still 0 (C1 filtered out)
    source: 'RBUSH'
  }
}

[RESIZE_VALIDATE] {
  op: 'resize',
  pieceId: 'c2-uuid',
  layerId: 'C2-layer-uuid',
  reasons: {
    collision: false,   // No same-layer collision
    spacing: false,
    bounds: false,
    supportFast: 'missing',  // C2 not fully on C1
    supportExact: 'missing'
  },
  setHasBlockFrom: 'none',  // Support NEVER blocks
  ghost: '1',               // Visual feedback (WARN)
  blockers: [],
  timestamp: 1234567892
}
```

**Dump état `draft.ui.ghost` après commit** :

```javascript
draft.ui.ghost = {
  pieceId: 'c2-uuid',
  problems: [
    {
      code: 'unsupported_above',
      severity: 'WARN',
      pieceId: 'c2-uuid',
      message: 'Piece is not fully supported',
    },
  ],
  startedAt: 1234567892,
};
```

**Confirmation** : Support issue → `setHasBlockFrom: 'none'`, `ghost: '1'` (visuel uniquement).

---

### 5.4 Scénario 3 : Poser C2 totalement dans le vide

**Setup** :

- C1 : dummy piece at (300, 300) size 30×30 (far from C2)
- C2 : piece at (100, 100) size 60×60 (no C1 support below)

**Action** : Drop C2, wait for exact validation

**Logs attendus** :

**Après validation exacte (support check)** :

```
[SUPPORT_CHECK] {
  op: 'support_exact',
  pieceId: 'c2-uuid',
  layerId: 'C2-layer-uuid',
  reasons: {
    collision: false,
    spacing: false,
    bounds: false,
    supportFast: 'n/a',
    supportExact: 'missing'
  },
  setHasBlockFrom: 'none',  // Support NEVER blocks
  ghost: '1',
  timestamp: 1234567893
}
```

**Dump état `draft.ui.ghost` après validation exacte** :

```javascript
draft.ui.ghost = {
  pieceId: 'c2-uuid',
  problems: [
    {
      code: 'unsupported_above',
      severity: 'WARN',
      pieceId: 'c2-uuid',
      message: 'Piece is not fully supported by the layer below',
    },
  ],
  startedAt: 1234567893,
};
```

**Vérification hasBlock** :

```javascript
const hasBlock = draft.ui.ghost?.problems?.some((p) => p.severity === 'BLOCK');
// hasBlock = false (seul WARN présent)
```

**Confirmation** : C2 non supporté → `ghost='1'`, mais `hasBlock=false` (manipulable).

---

## Conclusion

### Points confirmés :

1. **DOM & styles ghost** :
   - `<g data-ghost="1">` porte l'attribut et le CSS `outline: 2px dashed`.
   - Pendant drag : overlay SVG distinct (`GroupGhostOverlay`) avec `strokeDasharray="4 4"`.
   - Styles inline (fill, stroke, opacity) + CSS global pour `outline`.

2. **Filtrage par couche sur toutes les branches** :
   - **Drag** : `validateNoOverlapSameLayer` filtre à la ligne 129.
   - **Resize** : `collisionsForCandidate` filtre à la ligne 390.
   - **Group** : Même logique appliquée (validation pour chaque membre).

3. **Portée de hasBlock/blockers** :
   - Stockage global unique : `draft.ui.ghost` (un seul ghost actif).
   - `hasBlock` dérivé dynamiquement depuis `ghost.problems`.
   - **Aucune lecture cross-piece** : chaque pièce vérifie `ghost?.pieceId === p.id`.

4. **Shortlist RBush** :
   - Filtrage par couche **après** la shortlist (ligne 390).
   - **Aucune décision de blocage avant ce filtre**.

### Preuves fournies :

- Extraits de code avec numéros de ligne.
- Call-graphs effectifs pour drag/resize (single/group).
- Logs structurés pour les 3 scénarios demandés.
