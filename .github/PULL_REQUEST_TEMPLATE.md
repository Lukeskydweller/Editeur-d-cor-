## Description

<!-- Décrivez les changements apportés -->

## Type de changement

- [ ] Bug fix (non-breaking change qui corrige un problème)
- [ ] Nouvelle fonctionnalité (non-breaking change qui ajoute une fonctionnalité)
- [ ] Breaking change (fix ou feature qui casserait la compatibilité)
- [ ] Types only (changements de types uniquement, aucune logique modifiée)
- [ ] Documentation
- [ ] Refactoring

## Checklist

### Tests

- [ ] J'ai ajouté des tests couvrant mes changements
- [ ] Tous les tests passent localement (`pnpm test:unit`)
- [ ] Les tests E2E passent (`pnpm test:e2e`)
- [ ] La couverture de code respecte les seuils (≥80% lignes/fonctions/statements, ≥70% branches)

### Types & Qualité

- [ ] `pnpm typecheck` passe (0 erreur TypeScript)
- [ ] `pnpm lint` passe (ESLint sans erreurs)
- [ ] `pnpm build` réussit
- [ ] J'ai utilisé `type` imports pour les imports de types uniquement
- [ ] Les `any` ajoutés sont justifiés en commentaire (frontière lib/legacy)

### Domain Rules (Architecture)

- [ ] Si modification de `Piece` type: j'ai respecté le contrat V1 (conversion via `projectDraftToV1`)
- [ ] Si modification de `src/state/**` ou `src/core/**`: review approuvée par CODEOWNERS

### Documentation

- [ ] J'ai mis à jour la documentation si nécessaire
- [ ] Les traces Playwright sont disponibles en cas d'échec E2E
- [ ] Les commentaires de code sont clairs et nécessaires

### Sécurité

- [ ] Pas de secrets commités (.env, credentials, tokens)
- [ ] Pas de console.log sensibles en production
- [ ] Dépendances à jour (Dependabot/Renovate)

## Captures / Traces

<!-- Screenshots, traces Playwright, métriques de performance si applicable -->

## Contexte additionnel

<!-- Toute information pertinente pour les reviewers -->
