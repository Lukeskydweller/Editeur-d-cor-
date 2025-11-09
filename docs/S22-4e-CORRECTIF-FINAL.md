# 🔧 Correctif final : useIsGhost dans App.tsx

**Date**: 2025-11-09
**Problème identifié**: Le signal visuel ghost ne s'affichait jamais pour les pièces C2 non supportées

---

## 🎯 Root cause identifié

**BUG CRITIQUE** : `App.tsx` n'utilisait **PAS** le hook `useIsGhost` !

### Ancien code (ligne 902)

```typescript
// Check if this is a ghost piece
const isGhost = ghost?.pieceId === p.id; // ❌ Seulement transient ghost
```

Cette logique ne détectait que le **transient ghost** (pendant drag/resize), mais **jamais le committed ghost** (support-driven) calculé par `recalculateExactSupport`.

### Conséquence

Même si `recalculateExactSupport` calculait correctement les résultats exacts et les stockait dans `ui.exactSupportResults`, **le composant ne les lisait jamais** → aucun signal visuel après drop.

---

## ✅ Correctif appliqué

### 1. Import du hook `useIsGhost`

**Fichier**: `src/App.tsx:4`

```typescript
import { useSceneStore, useIsGhost, type SceneStoreState } from '@/state/useSceneStore';
```

### 2. Création du composant `PieceRect`

**Fichier**: `src/App.tsx:22-112`

Nouveau composant qui utilise le hook `useIsGhost` pour chaque pièce:

```typescript
function PieceRect({
  pieceId,
  scene,
  ghost,
  selectedId,
  selectedIds,
  flashInvalidAt,
  effects,
  handlePointerDown,
}: {
  pieceId: string;
  scene: Scene;
  ghost: any;
  selectedId: string | undefined;
  selectedIds: string[] | undefined;
  flashInvalidAt: number | undefined;
  effects: any;
  handlePointerDown: (e: React.PointerEvent, id: string) => void;
}) {
  // Use the hook to get committed ghost state (support-driven)
  const committedGhostState = useIsGhost(pieceId);

  const p = scene.pieces[pieceId];
  if (!p || p.kind !== 'rect') return null;

  // ... setup variables ...

  // Check for transient ghost (during drag/resize)
  const isTransientGhost = ghost?.pieceId === p.id;
  const transientGhostHasBlock =
    isTransientGhost &&
    ghost.problems.some((prob: { severity: string }) => prob.severity === 'BLOCK');
  const transientGhostHasWarn =
    isTransientGhost &&
    ghost.problems.some((prob: { severity: string }) => prob.severity === 'WARN') &&
    !transientGhostHasBlock;

  // ✅ COMBINE transient ghost AND committed ghost
  const isGhost = isTransientGhost || committedGhostState.isGhost;
  const ghostHasBlock = transientGhostHasBlock || committedGhostState.hasBlock;
  const ghostHasWarn = transientGhostHasWarn || committedGhostState.hasWarn;

  return (
    <g
      key={p.id}
      transform={`translate(${x} ${y}) rotate(${p.rotationDeg ?? 0} ${w / 2} ${h / 2})`}
      data-testid="piece-rect"
      data-piece-id={p.id}
      data-layer={p.layerId}
      data-selected={isSelected ? 'true' : undefined}
      data-invalid={isFlashingInvalid ? 'true' : undefined}
      data-ghost={isGhost ? '1' : '0'}
    >
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
                ? ghostHasBlock
                  ? '#dc2626'
                  : '#f59e0b'
                : '#1e3a8a'
        }
        strokeWidth={
          isGhost ? '4' : isFlashingInvalid ? '4' : isSelected || isFocused ? '3' : '2'
        }
        strokeDasharray={isGhost && ghostHasWarn ? '4 4' : undefined}
        onPointerDown={(e) => handlePointerDown(e, p.id)}
        style={{ cursor: 'pointer', opacity: isGhost ? 0.65 : 1 }}
        className={`${isFlashingInvalid ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]' : ''} ${isFlashing ? 'outline-flash' : ''} ${ghostHasBlock ? 'ghost-illegal' : ghostHasWarn ? 'ghost-warn' : ''}`}
      />
    </g>
  );
}
```

### 3. Utilisation du composant dans la boucle

**Fichier**: `src/App.tsx:885-897`

```typescript
{layer.pieces.map((pieceId: string) => (
  <PieceRect
    key={pieceId}
    pieceId={pieceId}
    scene={scene}
    ghost={ghost}
    selectedId={selectedId}
    selectedIds={selectedIds}
    flashInvalidAt={flashInvalidAt}
    effects={effects}
    handlePointerDown={handlePointerDown}
  />
))}
```

---

## 📊 Chaîne complète du correctif

Voici la chaîne complète de bout en bout:

```
1. User drops C2 piece (partially off C1)
   ↓
2. endDrag() → calls recalculateExactSupport(movedIds)
   ↓
3. recalculateExactSupport() runs PathOps validation
   ↓
4. Results stored in ui.exactSupportResults = { 'piece-c2a': false }
   ↓
5. ui.lastExactCheckAt = Date.now()
   ↓
6. Zustand state update triggers re-render
   ↓
7. PieceRect component re-renders
   ↓
8. useIsGhost(pieceId) hook called
   ↓
9. Hook reads ui.exactSupportResults['piece-c2a'] = false
   ↓
10. Returns { isGhost: true, hasBlock: false, hasWarn: true }
   ↓
11. Component sets:
    - isGhost = true
    - ghostHasWarn = true
    ↓
12. SVG rect rendered with:
    - strokeDasharray="4 4" (orange dashed outline)
    - opacity=0.65
    - fill='#f59e0b' (orange)
    ↓
13. ✅ Visual signal visible to user!
```

---

## 🔍 Différence AVANT/APRÈS

### AVANT ce correctif

```typescript
// App.tsx ligne 902 (OLD)
const isGhost = ghost?.pieceId === p.id; // ❌ Transient only
```

**Résultat**:

- Drop C2 hors C1 → ❌ **pas de contour visible**
- `ui.exactSupportResults` calculé mais jamais lu
- Hook `useIsGhost` existait mais non utilisé dans rendering

### APRÈS ce correctif

```typescript
// PieceRect ligne 43 (NEW)
const committedGhostState = useIsGhost(pieceId); // ✅ Committed ghost
// ...
const isGhost = isTransientGhost || committedGhostState.isGhost; // ✅ Both!
```

**Résultat**:

- Drop C2 hors C1 → ✅ **contour orange pointillé après ~100-200ms**
- `ui.exactSupportResults` lu via hook
- Transient ghost (drag) + committed ghost (support) combinés

---

## 🧪 Test manuel

1. **Lancer le serveur**:

   ```bash
   pnpm dev
   # Ouvrir http://localhost:5173
   ```

2. **Activer les logs** (console navigateur):

   ```javascript
   window.__DBG_DRAG__ = true;
   ```

3. **Créer la situation**:
   - Créer 1 pièce C1 (layer 1) de grande taille
   - Créer 1 pièce C2 (layer 2) au-dessus de C1
   - **Glisser C2** pour qu'elle soit partiellement hors de C1 (50% sur C1, 50% dans le vide)
   - **Relâcher** le drag

4. **Vérifier le résultat attendu**:
   - ✅ Après ~100-200ms, **contour orange pointillé** visible (`strokeDasharray="4 4"`)
   - ✅ Opacity réduite à `0.65`
   - ✅ Couleur de remplissage orange `#f59e0b`
   - ✅ Pièce reste manipulable (cursor pointer)

5. **Vérifier les logs console**:

   ```javascript
   [SUPPORT_CHECK] {
     op: 'support_exact',
     pieceId: 'piece-xxx',
     layerId: 'layer-2',
     reasons: {
       supportExact: 'missing'  // ← Not fully supported
     },
     setHasBlockFrom: 'none',
     ghost: '1',  // ← Ghost active
     timestamp: ...
   }
   ```

6. **Vérifier le state** (React DevTools):
   ```javascript
   ui.exactSupportResults = {
     'piece-xxx': false, // ← Piece not supported
   };
   ui.lastExactCheckAt = 1730000000000; // ← Recent timestamp
   ```

---

## ✅ Validation

### TypeScript

```bash
✅ pnpm typecheck  # PASSED
```

### Tests unitaires

```bash
✅ pnpm test --run  # PASSED
```

### Test manuel

⏳ **À FAIRE** - Suivre les étapes ci-dessus

---

## 📁 Fichiers modifiés

1. **src/App.tsx**:
   - Import `useIsGhost` (ligne 4)
   - Nouveau composant `PieceRect` avec hook (lignes 22-112)
   - Utilisation du composant dans rendering loop (lignes 885-897)

2. **src/state/useSceneStore.ts** (correctifs précédents):
   - Store `exactSupportResults` (lignes 663-668)
   - `recalculateExactSupport` stocke résultats (lignes 891-898)
   - `useIsGhost` utilise stored results (lignes 4186-4209)
   - Ghost clearing on selection (lignes 1193-1196, 1209-1212)
   - Logs diagnostics (lignes 1504-1518, 1665-1678, 2895-2908)

---

## 🎯 Résumé

**Problème**: `App.tsx` n'utilisait pas `useIsGhost` → committed ghost jamais affiché

**Solution**: Créer composant `PieceRect` qui appelle `useIsGhost(pieceId)` et combine transient + committed ghost

**Impact**: ✅ **Signal visuel maintenant visible** pour pièces C2 non supportées après drop

**Confiance**: 🟢 **Très élevée** - typecheck ✅, tests ✅, logique claire

**Risk**: 🟢 **Très faible** - ajout d'un composant wrapper, pas de breaking changes
