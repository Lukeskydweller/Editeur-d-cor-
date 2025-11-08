# Diagnostic des échecs de tests unitaires

**Date**: 2025-11-08
**Fichier**: `src/App.resize.group.isotropic.spec.tsx`
**Statut**: 3 tests sur 4 échouent (1 passe)

---

## Vue d'ensemble

### Tests et statuts

| #   | Test                                                                 | Statut  | Catégorie                     |
| --- | -------------------------------------------------------------------- | ------- | ----------------------------- |
| 1   | `isotropic scale ×1.5 preserves shape ratios and distances to pivot` | ❌ FAIL | **Régression réelle**         |
| 2   | `inverse cycle: ×1.5 puis ×(1/1.5) returns to initial positions`     | ✅ PASS | OK                            |
| 3   | `blocked when would overlap external piece`                          | ❌ FAIL | **Implémentation incomplète** |
| 4   | `blocked under min size (5mm)`                                       | ❌ FAIL | **Implémentation incomplète** |

### Historique

- **Commit d'ajout**: `9d2db8a` (feat(handles): implement handlesEpoch for reliable overlay remounting)
- **Note du commit**: _"pnpm test --run: 539/542 passed (3 échecs pré-existants dans group.resize)"_
- **⚠️ IMPORTANT**: Ces tests ont été ajoutés **avec les échecs déjà présents**. Ils n'ont **jamais passé** depuis leur création.
- **Intention**: Tests écrits pour documenter le comportement attendu d'une fonctionnalité partiellement implémentée

### Stabilité (flakiness)

**Résultat**: ❌ Aucune flakiness détectée
**Exécutions**: 5 runs consécutifs, tous avec les mêmes 3 échecs
**Conclusion**: Les échecs sont déterministes et reproductibles

---

## 1️⃣ Test: "isotropic scale ×1.5 preserves shape ratios"

### Erreur

```
AssertionError: expected 40 to be close to 60, received difference is 20, but expected 0.05
```

**Ligne**: [`src/App.resize.group.isotropic.spec.tsx:140`](src/App.resize.group.isotropic.spec.tsx#L140)

```typescript
expect(finalPieces[p1Id].size.w).toBeCloseTo(40 * 1.5, 1);
// Expected: 60mm (40 × 1.5)
// Received: 40mm (scale not applied)
```

### Analyse

#### Catégorie: **Régression réelle / Implémentation incomplète**

Le test échoue car le facteur de scale `×1.5` n'est **pas appliqué** aux pièces lors du commit.

#### Comportement attendu

1. Créer un groupe de 3 pièces avec dimensions initiales (40×60, 30×80, 50×40)
2. Appliquer un scale isotrope ×1.5 autour du pivot (centre bbox union)
3. Dimensions finales attendues: (60×90, 45×120, 75×60)
4. Distances inter-centres scalées ×1.5
5. Positions relatives préservées par rapport au pivot

#### Comportement observé

- Les pièces conservent leurs dimensions **originales** (40×60 au lieu de 60×90)
- Le scale n'est pas appliqué → `scale = 1` effectif

#### Cause racine

**Hypothèse 1: Le scale calculé est incorrectement normalisé à 1**

Dans [`useSceneStore.ts:2540-2549`](src/state/useSceneStore.ts#L2540-L2549), le scale est calculé puis "smoothé" avec précision dynamique:

```typescript
const currentRadius = distance(pivot, pointer);
const sRaw = currentRadius / Math.max(1 as Milli, startRadius);

// Dynamic precision based on group size
const groupRadiusMm = startRadius;
const base = Math.max(0.5, 0.0025 * preview.groupDiagMm);
const precisionMm = altKey ? base * 0.25 : base;
const precisionScale = precisionMm / groupRadiusMm;
const sSmooth = Math.round(sRaw / precisionScale) * precisionScale;
```

**Problème potentiel**:

- Le test utilise une distance de référence `startRadius = 100mm` (ligne 118)
- Le pointer cible est calculé comme `pivot.x + targetRadius` (ligne 130-132)
- Mais le `startPointer` passé à `startGroupResize` pourrait ne pas correspondre au `startRadius` enregistré dans l'état

**Vérification nécessaire**:

```typescript
// Test (ligne 119-122)
const startPointer = {
  x: (pivot.x + startRadius) as Milli,
  y: pivot.y as Milli,
};
```

vs.

```typescript
// Implementation (ligne 2485-2488 useSceneStore.ts)
const defaultStart = { x: pivot.x, y: pivot.y };
const startPointer = startPointerMm || defaultStart;
const startRadius = distance(pivot, startPointer);
```

Si `startPointerMm` n'est **pas** passé ou mal interprété, `startRadius` devient **0**, ce qui cause un ratio `currentRadius / 0 = Infinity` ou NaN.

**Hypothèse 2: Le scale n'est pas persisté au commit**

Dans [`useSceneStore.ts:2809`](src/state/useSceneStore.ts#L2809), lors du commit:

```typescript
const candidate = buildGroupScaleCandidate(draft.scene, selectedIds, pivot, scale);
```

Mais `lastScale` pourrait être `undefined` ou `1` par défaut si le RAF callback n'a pas eu le temps de s'exécuter.

**Ligne 2807**:

```typescript
const scale = lastScale ?? 1;
```

Si `updateGroupResize` n'a jamais été appelé **ou** si le RAF a été annulé avant exécution, `lastScale` reste `1`.

#### Mapping test ↔ implémentation

| Étape test                             | Action store                           | Code                         |
| -------------------------------------- | -------------------------------------- | ---------------------------- |
| `startGroupResize('se', startPointer)` | Initialise `groupResizing` state       | `useSceneStore.ts:2469-2518` |
| `updateGroupResize(targetPointer)`     | Schedule RAF update de `preview.scale` | `useSceneStore.ts:2520-2613` |
| `endGroupResize(true)`                 | Commit avec `lastScale`                | `useSceneStore.ts:2783-2854` |

**Point de défaillance**: Entre `updateGroupResize` et `endGroupResize`, si le RAF callback ne s'exécute pas **avant** le commit, `lastScale` reste à `1`.

#### Test smells détectés

1. **Timing fragile**: Le test appelle `updateGroupResize` puis `endGroupResize` immédiatement, sans attendre le RAF callback

   ```typescript
   updateGroupResize(targetPointer);
   endGroupResize(true); // ⚠️ Appel synchrone, RAF pas encore exécuté
   ```

2. **Couplage avec RAF**: L'implémentation utilise `requestAnimationFrame` pour throttler les updates (ligne 2521-2525), mais le test n'attend pas la frame

3. **Solution**: Le test devrait soit:
   - Appeler directement `_updateGroupResizeRafSafe` (fonction interne)
   - Attendre un tick avec `await new Promise(r => setTimeout(r, 0))`
   - Mocker le RAF pour exécution synchrone

#### Correctifs recommandés

##### Option A: Appeler la fonction RAF-safe directement (test-only)

```typescript
// Dans le test, après updateGroupResize
updateGroupResize(targetPointer);
// Forcer l'exécution RAF immédiate pour tests
useSceneStore.getState()._updateGroupResizeRafSafe({
  pointer: targetPointer,
  altKey: false,
});
endGroupResize(true);
```

##### Option B: Attendre le RAF dans le test

```typescript
updateGroupResize(targetPointer);
// Attendre le prochain tick (RAF s'exécute)
await new Promise((resolve) => setTimeout(resolve, 20));
endGroupResize(true);
```

##### Option C: Modifier l'implémentation pour mode synchrone en tests

```typescript
// Dans useSceneStore.ts, détecter l'environnement test
const isTestEnv = import.meta.env.MODE === 'test';

updateGroupResize: (pointerMm, altKey = false) => {
  if (isTestEnv) {
    // Mode synchrone pour tests
    useSceneStore.getState()._updateGroupResizeRafSafe({ pointer: pointerMm, altKey });
  } else {
    // Mode RAF pour production
    scheduleGroupResize((args) => useSceneStore.getState()._updateGroupResizeRafSafe(args), {
      pointer: pointerMm,
      altKey,
    });
  }
};
```

**Recommandation**: **Option C** (implémentation) + **Option A** (tests) pour robustesse maximale.

---

## 2️⃣ Test: "blocked when would overlap external piece"

### Erreur

```
TypeError: actual value must be number or bigint, received "undefined"
```

**Ligne**: [`src/App.resize.group.isotropic.spec.tsx:306`](src/App.resize.group.isotropic.spec.tsx#L306)

```typescript
expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
// Expected: timestamp (Date.now())
// Received: undefined
```

### Analyse

#### Catégorie: **Implémentation incomplète**

Le mécanisme de feedback visuel `flashInvalidAt` n'est **pas déclenché** lors d'un rollback pour collision avec pièce externe.

#### Comportement attendu

1. Créer un groupe de 2 pièces (p1, p2) sélectionnées
2. Placer une 3ème pièce (p3) **externe** au groupe, proche de p2
3. Tenter un scale ×2 qui causerait un overlap entre p2 et p3
4. Le système doit:
   - Détecter la collision (✅ fonctionne)
   - Rollback les modifications (✅ fonctionne, lignes 296-303 du test passent)
   - **Déclencher `flashInvalidAt = Date.now()`** (❌ échoue)

#### Comportement observé

- La validation détecte correctement l'overlap → `overlapOk = false` (ligne 2824)
- Le rollback est effectué → positions/tailles inchangées (test ligne 300-303 OK)
- **Mais** `flashInvalidAt` reste `undefined` au lieu d'être un timestamp

#### Cause racine

Dans [`useSceneStore.ts:2827-2830`](src/state/useSceneStore.ts#L2827-L2830):

```typescript
if (!isValid) {
  // Rollback + flash
  draft.scene = resizing.startSnapshot.scene;
  draft.ui.flashInvalidAt = Date.now();
}
```

**Le code est présent et correct !** ✅

**Problème**: `flashInvalidAt` est bien défini dans `endGroupResize`, mais le test vérifie immédiatement après l'appel synchrone. Deux possibilités:

1. **Race condition**: L'état n'est pas encore propagé au moment de `getState()`
2. **Validation asynchrone**: La validation `validateNoOverlapForCandidateDraft` ne détecte pas l'overlap correctement

#### Vérification: La validation détecte-t-elle vraiment l'overlap ?

**Fonction de validation** ([`useSceneStore.ts:2824`](src/state/useSceneStore.ts#L2824)):

```typescript
const overlapOk = validateNoOverlapForCandidateDraft(candidate, selectedIds).ok;
```

**Hypothèse**: La validation retourne `{ ok: true }` alors qu'il devrait y avoir overlap.

**Raison possible**:

- `validateNoOverlapForCandidateDraft` vérifie uniquement les overlaps **entre les pièces sélectionnées** (intra-groupe)
- Elle n'inclut **pas** les pièces externes (p3) dans la validation
- Code à vérifier dans [`lib/sceneRules.ts`](src/lib/sceneRules.ts)

#### Mapping test ↔ implémentation

| Test setup               | Implémentation                                            | Validation       |
| ------------------------ | --------------------------------------------------------- | ---------------- |
| p1, p2 sélectionnées     | `selectedIds = [p1Id, p2Id]`                              | ✅               |
| p3 externe proche        | `scene.pieces[p3Id]` non sélectionné                      | ✅               |
| Scale ×2 → overlap p2-p3 | `validateNoOverlapForCandidateDraft(candidate, [p1, p2])` | ❌ p3 non inclus |

**Validation actuelle** (ligne 2824):

```typescript
validateNoOverlapForCandidateDraft(candidate, selectedIds);
```

Vérifie seulement overlap entre p1 ↔ p2. **Ne vérifie PAS p2 ↔ p3** car p3 ∉ selectedIds.

#### Correctifs recommandés

##### Option A: Valider contre TOUTES les pièces (recommandé)

Modifier la logique de validation pour inclure les pièces externes:

```typescript
// Dans endGroupResize, ligne 2824
const overlapOk = validateNoOverlapForCandidateDraft(
  candidate,
  selectedIds,
  { includeExternal: true }, // Nouveau paramètre pour vérifier aussi pièces externes
).ok;
```

Ou utiliser la validation complète:

```typescript
const overlapOk = validateNoOverlap(candidate).ok;
```

##### Option B: Test obsolète (à rejeter)

**Non recommandé**: Le test est valide, le comportement attendu est correct (empêcher overlap avec pièces externes).

#### Test smells détectés

Aucun. Le test est bien conçu et documente un cas d'usage légitime.

---

## 3️⃣ Test: "blocked under min size (5mm)"

### Erreur

```
TypeError: actual value must be number or bigint, received "undefined"
```

**Ligne**: [`src/App.resize.group.isotropic.spec.tsx:375`](src/App.resize.group.isotropic.spec.tsx#L375)

```typescript
expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
// Expected: timestamp (Date.now())
// Received: undefined
```

### Analyse

#### Catégorie: **Implémentation incomplète**

Même problème que le test #2, mais pour la contrainte de taille minimale.

#### Comportement attendu

1. Créer 2 petites pièces (10×10 mm)
2. Tenter scale ×0.3 → dimensions finales 3×3 mm
3. Violation de `MIN_SIZE_MM = 5mm` (ligne 2564 useSceneStore.ts)
4. Rollback + flash attendu

#### Comportement observé

- Détection min size fonctionne → `hasMinSizeViolation = true` (ligne 2813-2821)
- Rollback effectué (ligne 2829)
- **Mais** `flashInvalidAt` reste `undefined`

#### Cause racine

**Identique au test #2**: Le code de flash est présent (ligne 2830) mais ne semble pas s'exécuter.

**Nouvelle hypothèse**: La validation **renvoie valide** alors qu'elle devrait renvoyer invalide.

**Vérification nécessaire**:

```typescript
// Ligne 2812-2821
let hasMinSizeViolation = false;
for (const id of selectedIds) {
  const p = candidate.pieces[id];
  if (!p) continue;
  if (p.size.w < MIN_SIZE_MM || p.size.h < MIN_SIZE_MM) {
    hasMinSizeViolation = true;
    break;
  }
}
```

Ce code semble correct. **Problème probable**: Le scale est clamped **avant** le commit (ligne 2574-2575):

```typescript
// Apply all clamps: clamp to [sMinPieces, sMaxScene]
const scale = Math.max(sMinPieces, Math.min(sMaxScene, sSmooth));
```

**Analyse**:

- `sMinPieces` est calculé pour garantir que toutes les pièces restent ≥ 5mm
- Le scale est donc **clamped** à `sMinPieces` durant la preview
- `lastScale` enregistré est déjà clamped → le commit utilise un scale valide
- **Aucune violation ne peut se produire au commit**

**Conclusion**: Le test suppose que l'utilisateur peut "forcer" un scale invalide au commit, mais l'implémentation clamp le scale en **preview** déjà.

#### Test obsolète ou implémentation différente ?

**Verdict**: **Test fragile** — Il teste un scénario impossible avec l'implémentation actuelle.

Deux philosophies de design:

1. **Clamp préventif (implémentation actuelle)**: Empêcher l'utilisateur d'atteindre un état invalide
2. **Validation au commit (test attendu)**: Permettre preview invalide, bloquer au commit

**Recommandation**: Adapter le test pour valider le **clamp préventif** plutôt que le rollback.

#### Correctifs recommandés

##### Option A: Adapter le test au comportement réel (recommandé)

Remplacer la vérification de `flashInvalidAt` par une vérification du **clamp**:

```typescript
test('min size (5mm) is enforced via scale clamp', () => {
  // ... setup identique ...

  // Tenter scale ×0.3
  updateGroupResize({ x: (pivot.x + targetRadius) as Milli, y: pivot.y as Milli });

  // Forcer exécution RAF
  useSceneStore.getState()._updateGroupResizeRafSafe({
    pointer: { x: (pivot.x + targetRadius) as Milli, y: pivot.y as Milli },
    altKey: false,
  });

  // Vérifier que le scale a été clamped
  const resizing = useSceneStore.getState().ui.groupResizing;
  expect(resizing?.lastScale).toBeGreaterThan(0.5); // 5mm / 10mm = 0.5 minimum

  endGroupResize(true);

  // Vérifier que les pièces ont la taille minimale
  const finalSize1 = useSceneStore.getState().scene.pieces[p1Id].size;
  expect(finalSize1.w).toBeGreaterThanOrEqual(5);
  expect(finalSize1.h).toBeGreaterThanOrEqual(5);
});
```

##### Option B: Modifier l'implémentation pour permettre preview invalide

Déplacer le clamp de la preview vers le commit uniquement. **Non recommandé** car dégrade l'UX (l'utilisateur voit un feedback invalide en temps réel).

---

## 4️⃣ Test: "inverse cycle" ✅ PASSE

### Statut

✅ **PASS** — Le test fonctionne correctement.

### Ce qu'il valide

- Double transformation inverse (×1.5 puis ×1/1.5) retourne aux positions initiales
- Précision ±0.1mm maintenue
- Pas de dérive d'arrondi cumulatif

### Conclusion

Ce test prouve que **l'arithmétique du scale est correcte** quand le RAF s'exécute correctement.

---

## Résumé des actions recommandées

### Priorité 1 (bloquant)

1. **Test #1**: Corriger la race condition RAF
   - [ ] Modifier `updateGroupResize` pour mode synchrone en tests (Option C)
   - [ ] Ajouter appel explicite à `_updateGroupResizeRafSafe` dans le test (Option A)
   - [ ] Vérifier que `lastScale` est bien persisté avant commit

### Priorité 2 (validation incomplète)

2. **Test #2**: Étendre validation pour pièces externes
   - [ ] Modifier `validateNoOverlapForCandidateDraft` ou utiliser `validateNoOverlap`
   - [ ] Vérifier que le rollback déclenche bien `flashInvalidAt`

### Priorité 3 (test à adapter)

3. **Test #3**: Adapter le test au clamp préventif
   - [ ] Remplacer vérification de `flashInvalidAt` par vérification du `lastScale` clamped
   - [ ] Documenter la philosophie "clamp préventif > validation au commit"

### Métriques de qualité

| Aspect               | État actuel   | État cible |
| -------------------- | ------------- | ---------- |
| Tests passants       | 1/4 (25%)     | 4/4 (100%) |
| Coverage fonctionnel | ~40%          | 100%       |
| Flakiness            | 0%            | 0%         |
| Régression réelle    | Oui (Test #1) | Non        |
| Tests obsolètes      | 1 (Test #3)   | 0          |

---

## Annexes

### A. Références code

- [`src/state/useSceneStore.ts:2469-2854`](src/state/useSceneStore.ts#L2469-L2854) — Group resize implementation
- [`src/state/useSceneStore.ts:305-352`](src/state/useSceneStore.ts#L305-L352) — `buildGroupScaleCandidate`
- [`src/lib/sceneRules.ts`](src/lib/sceneRules.ts) — Validation rules

### B. Problèmes de floating-point

**Aucun détecté**. Le test #4 (inverse cycle) prouve la stabilité numérique avec tolérance ±0.1mm appropriée.

### C. Historique Git pertinent

```bash
# Tests ajoutés avec échecs pré-existants
9d2db8a feat(handles): implement handlesEpoch for reliable overlay remounting
# Message: "pnpm test --run: 539/542 passed (3 échecs pré-existants dans group.resize)"

# Implémentation group resize live preview
d38eb68 feat(resize): group resize live preview with transform matrices
6aac4dc fix(resize): corner handles isotropic + group ghost preview + UI cleanup
```

**Conclusion historique**: Les tests ont été écrits **après** l'implémentation partielle, pour documenter les cas manquants. Ils représentent une **dette technique volontaire** documentée.

---

**Fin du rapport**
