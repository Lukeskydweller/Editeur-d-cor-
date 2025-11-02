# Dev anti-drop (WSL/VS Code)

## Commandes utiles

- `pnpm doctor` : vérifie env + lance un preview + curl, puis stop.
- `pnpm doctor:quick` : version rapide sans lancer preview.
- `pnpm e2e:preview:start` / `pnpm e2e:preview:stop` : gérer manuellement le preview.

## Astuces

- Ouvrir le repo via WSL et `code .` (pas \\wsl$).
- Si crash « WebSocket 1006 » : `wsl --shutdown`, purge `~/.vscode-server`, relancer.
- Garder l'extension « Remote - WSL » à jour.
