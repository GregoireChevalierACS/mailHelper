# 0003 — Versions de l'outillage

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

L'outillage reprend celui du projet `slideshowBuilder`, déjà éprouvé : mêmes contraintes de compatibilité entre TypeScript, typescript-eslint, Vitest et Stryker.

## Décision

- **Node 24 LTS**, épinglé dans `.node-version` (lu par la CI) et exigé par `engines` avec `engine-strict=true`.
- **TypeScript 6.0.x** : typescript-eslint 8.72 n'accepte pas TypeScript 7. Dependabot ignore `typescript >=6.1.0`.
- **Vitest 4.1 et Stryker 10.0** : Stryker 10.0 n'active pas les mutants sous Vitest 5 (tous survivent en silence). Les deux montent ensemble.
- **Electron 45**, **SDK Anthropic 1.3** : dernières versions sorties de quarantaine au démarrage.
- **Quarantaine de 3 jours** (`minimumReleaseAge: 4320`) : une version publiée depuis moins de 3 jours n'est pas installée.
- **Scripts d'installation bloqués** sauf ceux d'Electron et d'esbuild (`onlyBuiltDependencies`).
- pnpm épinglé (`packageManager`), versions exactes (`save-exact=true`), lockfile figé en CI.

## Conséquences

- ✅ Lint typé complet, test de mutation fonctionnel.
- ❌ À réviser ensemble : TypeScript 7 (dès que typescript-eslint le supporte), Vitest 5 avec Stryker ≥ 10.1.
