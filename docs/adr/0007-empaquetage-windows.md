# 0007 — Empaquetage Windows sans node_modules

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

electron-builder copie d'ordinaire les dépendances de production dans l'archive de l'application. Avec un monorepo pnpm (liens symboliques, paquets du dépôt), c'est une source connue d'archives incomplètes ou gonflées.

## Décision

- **Tout est embarqué au build** : tsdown regroupe le processus principal (ESM) et le preload (CommonJS, exigé par le bac à sable), Vite regroupe la fenêtre. Seul Electron reste externe.
- **electron-builder n'empaquette que `dist/`** (`directories.app`), avec un `dist/package.json` écrit au build, sans dépendance ; `node_modules` est exclu explicitement.
- **Deux livrables** : installeur NSIS par utilisateur (sans droits d'administrateur) et exécutable portable.
- **Construits en CI** sur `windows-latest`, publiés comme artefacts de chaque exécution.

## Conséquences

- ✅ L'archive ne contient que `main/`, `preload/`, `renderer/` et le manifeste : vérifiable d'un coup d'œil (`npx @electron/asar list`).
- ❌ **Exécutables non signés** : Windows SmartScreen avertira au premier lancement. La signature (certificat de l'entreprise) est notée dans la feuille de route.
- ❌ Icône par défaut d'Electron, en attendant une identité visuelle.
