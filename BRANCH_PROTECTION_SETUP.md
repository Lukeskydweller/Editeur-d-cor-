# 🔒 Configuration Branch Protection - Guide Pas-à-Pas

Ce document fournit les étapes **exactes** pour configurer la protection de branche `main` sur GitHub.

## 📍 Accès

1. Aller sur : `https://github.com/<OWNER>/<REPO>/settings/branches`
2. Section : "Branch protection rules"
3. Cliquer : "Add branch protection rule" ou éditer règle existante pour `main`

---

## ✅ Configuration Complète (Copier/Coller)

### 1️⃣ Branch name pattern

```
main
```

### 2️⃣ Protect matching branches

#### ☑️ Require a pull request before merging

- **Required approvals**: `1`
- ☑️ **Dismiss stale pull request approvals when new commits are pushed**
- ☑️ **Require review from Code Owners**

#### ☑️ Require status checks to pass before merging

- ☑️ **Require branches to be up to date before merging**

**Status checks requis** (cocher dans la liste après premier run CI) :

| Check Name  | Description                              | Bloquant |
| ----------- | ---------------------------------------- | -------- |
| `typecheck` | TypeScript compilation (0 errors)        | ✅ OUI   |
| `unit`      | Tests unitaires + coverage ≥80% per-file | ✅ OUI   |
| `e2e-smoke` | Tests E2E smoke (chemin critique)        | ✅ OUI   |
| `build`     | Build production réussi                  | ✅ OUI   |

**⚠️ Ne PAS cocher `lint`** : Ce job est informatif (`continue-on-error: true`), il ne doit pas bloquer les PRs.

> ⚠️ **Important** : Ces checks n'apparaissent dans la liste qu'après le premier run CI réussi. Si non visibles :
>
> 1. Pusher un commit sur une PR
> 2. Attendre fin du run CI
> 3. Retourner dans Branch protection → les checks apparaissent maintenant
> 4. Cocher les 4 checks ci-dessus (typecheck, unit, e2e-smoke, build)

#### ☑️ Require conversation resolution before merging

Tous les commentaires de review doivent être résolus.

#### ☑️ Require linear history

(Optionnel selon workflow équipe - force rebase/squash merge)

#### ☑️ Do not allow bypassing the above settings

**Cocher cette option** pour que les admins aussi respectent les règles.

---

## 🎯 Résultat Attendu

Après configuration, tenter de merger une PR doit :

- ❌ **BLOQUER** si au moins 1 check bloquant est rouge (typecheck/unit/e2e-smoke/build)
- ⚠️ **SIGNALER** si lint a des warnings (non-bloquant, continue-on-error)
- ❌ **BLOQUER** si branche pas à jour avec `main`
- ❌ **BLOQUER** si pas d'approval (ou CODEOWNER approval manquant)
- ❌ **BLOQUER** si conversations non résolues
- ✅ **AUTORISER** uniquement si tout est vert + approuvé

---

## 🧪 Test de Validation

### Créer une PR de test

```bash
# Créer branche test
git checkout -b test/branch-protection

# Ajouter erreur TypeScript volontaire
echo "const x: number = 'invalid';" >> src/test-validation.ts
git add .
git commit -m "test: validate branch protection"
git push origin test/branch-protection
```

### Ouvrir PR sur GitHub

1. Vérifier que CI run démarre automatiquement
2. Attendre que `typecheck` échoue (erreur TS volontaire)
3. Vérifier que bouton "Merge" est **DISABLED** avec message :
   ```
   Merging is blocked
   Required status check "typecheck" has not succeeded
   ```
4. Corriger l'erreur :
   ```bash
   git rm src/test-validation.ts
   git commit -m "fix: remove test error"
   git push
   ```
5. Attendre checks verts → bouton "Merge" devient vert
6. Fermer/supprimer la PR de test

---

## 📋 Checklist de Vérification Post-Config

| Item                                      | Vérifié | Comment vérifier                                                      |
| ----------------------------------------- | ------- | --------------------------------------------------------------------- |
| 5 checks requis cochés                    | ☐       | Settings → Branches → voir liste checks                               |
| "Require branches to be up to date" actif | ☐       | Règle visible dans protection                                         |
| CODEOWNERS review requis                  | ☐       | Modifier `src/state/useSceneStore.ts` dans PR → demande review @romua |
| Merge bloqué si checks rouges             | ☐       | Test avec erreur TypeScript volontaire                                |
| Merge bloqué si branche pas à jour        | ☐       | Pusher sur main, puis tenter merge PR ancienne                        |
| Conversations requis                      | ☐       | Commenter PR sans résoudre → merge bloqué                             |
| Admins aussi soumis aux règles            | ☐       | Option "Do not allow bypassing" cochée                                |

---

## 🔍 Dépannage

### Problème : Checks n'apparaissent pas dans la liste

**Cause** : GitHub ne connaît pas encore ces checks (premier run pas encore fait)

**Solution** :

1. Vérifier que `.github/workflows/ci.yml` existe et est sur `main`
2. Créer une PR temporaire (n'importe quel changement)
3. Attendre que CI run se termine
4. Retourner dans Branch protection → checks maintenant visibles
5. Cocher les 5 checks

### Problème : Check "e2e" toujours rouge

**Cause** : Le workflow `.github/workflows/ci.yml` ligne 37 a `|| true` (non-bloquant)

**Solution** :

```yaml
# Remplacer :
- run: pnpm -s test:e2e:ci || pnpm -s test:e2e || true

# Par :
- run: pnpm -s test:e2e:ci || pnpm -s test:e2e
```

(Le `|| true` était pour dev initial, retirer pour production)

### Problème : CODEOWNERS review non demandé

**Cause** : Fichier `.github/CODEOWNERS` non sur `main` ou mal formaté

**Solution** :

1. Vérifier que `.github/CODEOWNERS` existe sur `main`
2. Format : `<pattern> <@username>` (1 espace, pas tabs)
3. Username doit être collaborateur du repo
4. Pusher fix sur `main` si nécessaire

---

## 📸 Captures de Référence (Attendu)

### Vue "Merge Pull Request" avec checks

```
✅ typecheck — Passed (1m 23s)
✅ lint — Passed (45s)
✅ unit — Passed (2m 15s)
✅ e2e — Passed (5m 42s)
✅ build — Passed (1m 08s)

✅ All checks have passed
✅ This branch has no conflicts with the base branch
✅ Conversations resolved
✅ Approved by @romua (CODEOWNER)

[Merge pull request ▼]  ← Bouton VERT et actif
```

### Vue "Merge Blocked" (si échec)

```
❌ typecheck — Failed (1m 12s)
✅ lint — Passed (45s)
...

⚠️ Merging is blocked
Required status check "typecheck" has not succeeded

[Merge pull request]  ← Bouton GRIS et disabled
```

---

## 🚀 Activation Finale

Une fois configuration validée :

1. ✅ Tous les checks cochés
2. ✅ Test PR réussi (merge bloqué puis autorisé)
3. ✅ CODEOWNERS review demandé sur fichiers critiques
4. ✅ Checklist de vérification complète

**Protection active** : Aucune régression ne peut entrer sur `main` sans validation complète.

---

## 📞 Ressources

- [GitHub Docs - Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [CODEOWNERS Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)

---

**Note** : Cette configuration est **essentielle** pour maintenir la qualité du code. Ne pas désactiver sans consensus équipe.
