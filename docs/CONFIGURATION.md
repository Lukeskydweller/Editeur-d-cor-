# Configuration des seuils UI et validation

Ce document explique où modifier les différents seuils de l'application pour les adapter à vos besoins.

## Seuils de collage et validation

### Variables d'environnement (.env)

Toutes les valeurs peuvent être surchargées via des variables d'environnement dans `.env` :

```bash
# Seuil de collage automatique bord-à-bord (défaut: 1.0mm)
VITE_UI_COLLAGE_MM=1.0

# Seuil de pré-collage smart nudge clavier (défaut: 5mm)
VITE_UI_PRECOLLAGE_MM=5

# Afficher la micro-tooltip de gap (défaut: true)
VITE_UI_SHOW_GAP_TOOLTIP=true

# Seuil maximal d'affichage du tooltip (défaut: 6mm)
VITE_UI_TOOLTIP_GAP_MAX_MM=6

# Durée d'affichage du tooltip en ms (défaut: 400ms)
VITE_UI_TOOLTIP_MS=400
```

### Constantes TypeScript

Si vous souhaitez modifier les valeurs par défaut en dur, éditez les fichiers suivants :

#### Validation et collage : `src/constants/validation.ts`

```typescript
// Seuil minimal d'espacement et de collage automatique (mm)
export const MIN_GAP_MM = 1.0;

// Seuil pour le collage automatique bord-à-bord (identique à MIN_GAP_MM)
export const SNAP_EDGE_THRESHOLD_MM = 1.0;

// Seuil de pré-collage : smart nudge clavier si gap dans (MIN_GAP_MM ; PRECOLLAGE_MM]
export const PRECOLLAGE_MM = 5.0;

// Seuil de warning pour espacement (mm) - WARN si MIN_GAP_MM <= distance < SPACING_WARN_MM
export const SPACING_WARN_MM = 1.5;

// Seuil d'affichage du tooltip de gap (mm)
export const TOOLTIP_GAP_MAX_MM = 6.0;
```

#### UI et tooltip : `src/constants/ui.ts`

```typescript
// Afficher le micro-tooltip de gap (par défaut: true)
export const SHOW_GAP_TOOLTIP = import.meta.env.VITE_UI_SHOW_GAP_TOOLTIP !== 'false';

// Seuil de collage (mm) - override via env
export const COLLAGE_MM = Number(import.meta.env.VITE_UI_COLLAGE_MM) || 1.0;

// Seuil de pré-collage (mm) - override via env
export const PRECOLLAGE_MM = Number(import.meta.env.VITE_UI_PRECOLLAGE_MM) || 5.0;

// Seuil maximal d'affichage du tooltip de gap (mm)
export const TOOLTIP_GAP_MAX_MM = Number(import.meta.env.VITE_UI_TOOLTIP_GAP_MAX_MM) || 6.0;

// Durée d'affichage du tooltip (ms)
export const TOOLTIP_DURATION_MS = Number(import.meta.env.VITE_UI_TOOLTIP_MS) || 400;
```

## Règles de validation

### Espacement entre pièces

- **BLOCK** si distance < 1.0mm (chevauchement ou trop proche)
- **WARN** si 1.0mm ≤ distance < 1.5mm (proche mais acceptable)
- **OK** si distance ≥ 1.5mm

Source : `src/core/geo/validateAll.ts`

### Collage automatique

- Souris : collage à 0 si gap < 1.0mm lors du commit
- Clavier : collage à 0 si le pas de déplacement conduit à gap < 1.0mm
- Pas de saut anticipé : le collage ne se déclenche que quand le gap devient effectivement < 1.0mm

Source : `src/lib/ui/snap.ts` (snapEdgeCollage, finalizeCollageGuard)

### Micro-tooltip de gap

- Affiche "X.YY mm" si gap ≤ 6mm
- Affiche "Collage" si gap < 1.0mm
- Auto-hide après 400ms
- Désactivable via `VITE_UI_SHOW_GAP_TOOLTIP=false`

Source : `src/ui/overlays/MicroGapTooltip.tsx`

## Où changer quoi ?

| Objectif | Fichier | Constante |
|----------|---------|-----------|
| Seuil de collage auto | `constants/validation.ts` | `MIN_GAP_MM` |
| Seuil pré-collage clavier | `constants/validation.ts` | `PRECOLLAGE_MM` |
| Seuil warning espacement | `constants/validation.ts` | `SPACING_WARN_MM` |
| Seuil max tooltip | `constants/validation.ts` | `TOOLTIP_GAP_MAX_MM` |
| Durée tooltip | `constants/ui.ts` | `TOOLTIP_DURATION_MS` |
| Activer/désactiver tooltip | `.env` | `VITE_UI_SHOW_GAP_TOOLTIP` |

## Tests

Après modification des constantes, exécutez les tests pour vérifier la non-régression :

```bash
# Typecheck
pnpm typecheck

# Tests unitaires
pnpm test

# Tests E2E (nécessite PWREADY=1)
PWREADY=1 pnpm exec playwright test
```

## Feature Flags

Pour désactiver complètement le collage automatique :

```bash
VITE_FEAT_GAP_COLLAGE=false
```

Note : cela désactive à la fois le collage souris et clavier.
