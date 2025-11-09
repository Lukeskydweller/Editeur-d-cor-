# Scénarios de tests manuels : Validation des correctifs ghost

**Date**: 2025-11-09
**Objectif**: Capturer les logs réels avec `window.__DBG_DRAG__=true` pour valider les 4 correctifs

---

## Prérequis

1. **Lancer le serveur dev**:

   ```bash
   pnpm dev
   ```

2. **Ouvrir la console navigateur** (F12)

3. **Activer les logs de débogage** dans la console:

   ```javascript
   window.__DBG_DRAG__ = true;
   ```

4. **Créer la scène de test**:
   - Ajouter 1 pièce C1 (layer 1) : position (50, 50), taille (200, 100)
   - Ajouter 2 pièces C2 (layer 2) :
     - C2-A : position (100, 200), taille (100, 100)
     - C2-B : position (300, 200), taille (100, 100)

---

## Scénario 1 : Signal visuel pour C2 non supporté

### Objectif

Vérifier que **Fix #1** (stockage exact results) et **Fix #3** (visual SVG) fonctionnent correctement.

### Étapes

1. **Créer la situation**:
   - Glisser C2-A pour qu'elle soit **partiellement hors de C1** (par ex. 50% sur C1, 50% dans le vide)
   - Relâcher le drag (commit)

2. **Vérifications visuelles attendues**:
   - ✅ Après ~100-200ms, C2-A doit afficher un **contour orange en pointillés** (`strokeDasharray="4 4"`)
   - ✅ L'opacité doit être réduite à `0.65`
   - ✅ La pièce reste **manipulable** (cursor: pointer, pas de blocage)

3. **Logs attendus dans la console**:

```javascript
// Après recalculateExactSupport (déclenché par commitDrag)
[layers.support] Exact mode: checking 1 pieces...
[layers.support] PathOps check for piece-c2a: false (unsupported)
[layers.support] Exact results: {piece-c2a: false}

// useIsGhost détecte l'état ghost via exactSupportResults
// (pas de log direct, mais visible via React DevTools)
```

4. **Vérification dans React DevTools**:
   - Ouvrir React DevTools → Components
   - Sélectionner le composant de C2-A
   - Vérifier props/state:
     - `isGhost: true`
     - `ghostHasWarn: true`
     - `ghostHasBlock: false`

### Critères de succès

- ✅ Visuel orange pointillé visible **immédiatement après drop**
- ✅ `exactSupportResults` stocké dans `ui` state avec `{piece-c2a: false}`
- ✅ `lastExactCheckAt` timestamp mis à jour (< 5s)
- ✅ Pièce reste draggable sans blocage

---

## Scénario 2 : Pas de blocage transverse (C2-ghost ne bloque pas autres C2)

### Objectif

Vérifier que **Fix #2** (clear ghost on select) empêche le leak de ghost state entre pièces.

### Étapes

1. **Situation initiale** (depuis Scénario 1):
   - C2-A est en état ghost (partiellement hors C1, contour orange pointillé)
   - C2-B est ailleurs, loin de C2-A et totalement supportée par C1

2. **Action**:
   - **Sélectionner C2-B** (clic)
   - **Glisser C2-B** vers une nouvelle position (toujours sur C1, sans collision avec C2-A)

3. **Logs attendus**:

```javascript
// Au moment du clic sur C2-B (selectPiece)
// Pas de log visible, mais en interne :
// - draft.ui.ghost cleared car ghost.pieceId !== piece-c2b

// Au début du drag de C2-B
[DRAG_START] {
  pieceId: 'piece-c2b',
  layerId: 'layer-2',
  selectedIds: ['piece-c2b'],
  currentGhost: null  // ← CRITICAL: doit être null (ghost cleared)
}

// Pendant le drag
[DRAG_VALIDATE_INPUT] {
  selectedIds: ['piece-c2b'],
  isGroupDrag: false,
  candidatePosition: { x: 320, y: 210 },
  currentGhost: null  // ← CRITICAL: toujours null
}

// Si validation détecte collision (ne devrait pas si loin de C2-A)
// Pas de log [drag] BLOCK si pas de collision

// Si pas de collision
// Aucun log BLOCK, drag fluide
```

4. **Vérifications**:
   - ✅ `currentGhost: null` dans tous les logs de C2-B
   - ✅ Pas de log `[drag] BLOCK detected` si C2-B ne touche pas C2-A
   - ✅ C2-B se déplace librement sans ralentissement ni blocage

### Critères de succès

- ✅ `currentGhost: null` confirmé dans logs
- ✅ Ghost de C2-A n'affecte **pas** le drag de C2-B
- ✅ Pas de faux positifs de collision

---

## Scénario 3 : Resize C2 au-dessus de C1 sans blocage (sauf collision C2↔C2)

### Objectif

Vérifier que la validation same-layer permet resize C2 au-dessus C1 sans blocage.

### Étapes

1. **Situation initiale**:
   - C2-B est sur C1, loin de C2-A (au moins 200mm de distance)
   - C2-A peut rester en ghost state ou être replacée complètement sur C1

2. **Action**:
   - **Sélectionner C2-B**
   - **Glisser une poignée de resize** (par ex. coin sud-est) pour **agrandir C2-B vers le bas**
   - Agrandir jusqu'à ce que C2-B **dépasse partiellement de C1** (déborde en bas)

3. **Logs attendus**:

```javascript
// Pendant le resize (throttled, tous les 5mm de mouvement)
[RESIZE_VALIDATE_INPUT] {
  pieceId: 'piece-c2b',
  candidateGeometry: { x: 300, y: 200, w: 100, h: 150, rotationDeg: 0 },
  handle: 'se',
  currentGhost: null  // ou {ghostPieceId: 'piece-c2a', affects: false}
}

// Validation interne (pas de log direct sauf si collision détectée)
// collisionsForCandidate appelé avec sceneV1, filtre same-layer
// Si C2-B ne touche pas C2-A : pas de collision détectée

// Si C2-B dépasse de C1 mais sans collision C2↔C2
// Pas de log BLOCK
// Resize fluide, même si C2-B sort partiellement de C1
```

4. **Vérifications**:
   - ✅ Resize **n'est PAS bloqué** si C2-B dépasse de C1 sans toucher C2-A
   - ✅ Pas de log `BLOCK` dans la console
   - ✅ Si on agrandit jusqu'à **toucher C2-A** → alors BLOCK détecté (normal)

5. **Test collision C2↔C2** (pour confirmer que validation fonctionne):
   - Continuer à agrandir C2-B jusqu'à ce qu'elle **chevauche C2-A**
   - **Log attendu**:
   ```javascript
   // Quand collision C2-B ↔ C2-A détectée
   [resize] Detected collision during resize: {
     pieceId: 'piece-c2b',
     neighbors: ['piece-c2a'],
     layerId: 'layer-2'
   }
   ```

   - ✅ Resize **bloqué** (candidate.valid = false)
   - ✅ Visuel ghost BLOCK (rouge) apparaît

### Critères de succès

- ✅ Resize C2 au-dessus C1 **sans blocage** (cross-layer)
- ✅ Resize C2 vers C2 **avec blocage** (same-layer collision)
- ✅ Logs confirment layer filtering correct

---

## Scénario 4 : Transition ghost→real après ajout support

### Objectif

Vérifier que l'ajout de support C1 supprime le ghost state.

### Étapes

1. **Situation initiale**:
   - C2-A en état ghost (partiellement hors C1, contour orange pointillé)

2. **Action**:
   - **Ajouter ou agrandir C1** pour que C2-A soit **totalement supportée**
   - Ou **déplacer C2-A** entièrement sur C1

3. **Logs attendus**:

```javascript
// Après commitDrag de C2-A (maintenant totalement sur C1)
[layers.support] Exact mode: checking 1 pieces...
[layers.support] PathOps check for piece-c2a: true (supported)
[layers.support] Exact results: {piece-c2a: true}

// useIsGhost détecte isSupported = true
// isGhost devient false
```

4. **Vérifications visuelles**:
   - ✅ Contour orange pointillé **disparaît**
   - ✅ Opacité revient à `1.0`
   - ✅ Couleur redevient bleue normale

### Critères de succès

- ✅ Ghost visuel **disparaît** après full support
- ✅ `exactSupportResults[piece-c2a]: true`
- ✅ Transition fluide ghost→real

---

## Logs supplémentaires à vérifier

### Freshness window (5s)

1. **Créer ghost** (C2-A partiellement off C1)
2. **Attendre 6 secondes** sans bouger
3. **Sélectionner et drag C2-A** à nouveau

**Log attendu**:

```javascript
// useIsGhost fallback to fast mode (results stale)
// Pas de log direct, mais en interne :
// resultsFresh = false (Date.now() - lastCheckAt > 5000)
// Utilise isPieceFullySupported(s, pieceId, 'fast')
```

### Group drag avec ghost

1. **C2-A en ghost**, **C2-B normal**
2. **Sélectionner les deux** (Shift+clic)
3. **Glisser le groupe**

**Log attendu**:

```javascript
[DRAG_START] {
  pieceId: 'piece-c2a',  // primary drag piece
  layerId: 'layer-2',
  selectedIds: ['piece-c2a', 'piece-c2b'],
  currentGhost: {
    ghostPieceId: 'piece-c2a',
    problems: 1,
    affectsThisDrag: true  // ← ghost fait partie du drag
  }
}
```

---

## Résumé des critères d'acceptance

| Critère                  | Scénario | Validation                             |
| ------------------------ | -------- | -------------------------------------- |
| Signal visuel ghost WARN | 1        | ✅ Orange pointillé visible après drop |
| Exact results stockés    | 1        | ✅ `exactSupportResults` dans state    |
| Freshness window 5s      | 1        | ✅ Re-validation si > 5s               |
| Pas de ghost leak        | 2        | ✅ `currentGhost: null` pour C2-B      |
| Resize C2 sur C1 libre   | 3        | ✅ Pas de BLOCK cross-layer            |
| Resize C2→C2 bloqué      | 3        | ✅ BLOCK same-layer collision          |
| Transition ghost→real    | 4        | ✅ Visuel disparaît après support      |

---

## Dépannage

### Logs ne s'affichent pas

Vérifier:

```javascript
// Dans la console
window.__DBG_DRAG__; // doit retourner true
import.meta.env.DEV; // doit retourner true (mode dev)
```

### Exact mode échoue (PathOps WASM)

Si logs montrent:

```
[layers.support] PathOps exact mode failed, falling back to AABB
```

**Cause**: WASM non chargé (rare en dev, fréquent en tests)
**Impact**: Utilise AABB fallback (peut avoir faux positifs)
**Solution**: Recharger la page

### Ghost n'apparaît pas après drop

Vérifier:

1. `recalculateExactSupport` appelé après `commitDrag` (ligne 1493)
2. `exactSupportResults` mis à jour dans state (React DevTools)
3. `useIsGhost` utilise stored results (ligne 4188)

---

**Fin des scénarios de test**
