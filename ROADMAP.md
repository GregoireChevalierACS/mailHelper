# Feuille de route

Chaque phase a un critère vérifiable : elle est terminée quand il est rempli, pas avant.

## Phase 1 — Socle ✅

**Terminée quand** : le domaine, la couche application, les adapters Gmail, Outlook, Claude et OAuth et la fenêtre passent la CI (100 % de couverture, mutation du domaine ≥ 80 %), et `MailHelper.exe` démarre.

- [x] Domaine : courriel, adresse sans lecteur, envoi en nombre, consolidation de l'analyse, brouillon, priorité.
- [x] Application : `synthetiser` (analyses en parallèle, bornées) et `repondre` (presse-papiers puis ouverture).
- [x] Adapters Gmail (REST) et Outlook (Graph), tenus par le contrat de la boîte de réception.
- [x] OAuth PKCE sur 127.0.0.1, jetons chiffrés par `safeStorage`.
- [x] Analyseur Claude : sorties structurées, repli en cas de refus, courriel encadré contre l'injection.
- [x] Fenêtre : connexion, synthèse par période, propositions, dialogue de confirmation.
- [x] Installeur NSIS et exécutable portable, sans `node_modules`.

## Phase 2 — Premier essai réel

**Terminée quand** : trois utilisateurs ont traité une semaine de courriels réels (un Gmail, deux Microsoft 365), et chaque défaut relevé est corrigé ou noté ici.

- [ ] Inscrire l'application chez Google (client « bureau ») et Microsoft Entra ID (client public), documenter les identifiants à déployer.
- [ ] Vérifier `internetMessageHeaders` dans la liste Graph sur un vrai tenant (repli : `inferenceClassification`).
- [ ] Mesurer le temps et le coût d'une synthèse de 30 courriels avec `effort: low`, puis `medium`.
- [ ] Jeu d'évaluation : 50 courriels anonymisés avec la réponse attendue (oui / non) et un résumé de référence, rejoué à chaque changement de consigne ou de modèle.

## Phase 3 — Confort d'usage

**Terminée quand** : un utilisateur configure, se connecte, se déconnecte et change de messagerie sans éditer de fichier.

- [ ] Écran de réglages : clé d'API et identifiants stockés par `safeStorage` (fin du fichier `.env` en clair).
- [ ] Déconnexion (suppression des jetons) et changement de messagerie.
- [ ] Réponse rattachée au fil : brouillon créé par l'API (`drafts.create` avec `threadId`, `createReply` de Graph), si le service informatique accepte les portées d'écriture (ADR 0005).
- [ ] Nom et signature de l'utilisateur dans la consigne, pour des propositions plus justes.

## Phase 4 — Déploiement en entreprise

**Terminée quand** : l'installeur signé est diffusé par l'outil de déploiement de l'entreprise, sans alerte SmartScreen.

- [ ] Signature de code (certificat de l'entreprise) dans la CI.
- [ ] Icône et identité visuelle.
- [ ] Test de lancement automatisé (Playwright pour Electron) sur l'exécutable empaqueté, en CI Windows.
- [ ] Mises à jour automatiques (electron-updater) ou par l'outil de déploiement.

## Pièges rencontrés

- **`ELECTRON_RUN_AS_NODE=1` hérité** (terminal intégré de VS Code) : Electron démarre alors comme Node, et `import { app } from 'electron'` échoue. Lancer avec la variable retirée (voir le README).
- **Binaire Electron absent après `pnpm install`** : relancer `node node_modules/electron/install.js` dans `apps/desktop`.
- **electron-builder et pnpm** : même avec `directories.app: dist`, electron-builder remonte au paquet du dépôt et y prend ses `node_modules` ; il faut les exclure dans `files` (ADR 0007).
- **`safeStorage.encryptString` est déprécié dans Electron 45** : utiliser les variantes `…Async`.
- **`clipboard.writeText` renvoie une promesse dans Electron 45** : l'attendre.
- **Une synthèse lancée depuis un effet React** déclenche `set-state-in-effect` : la fenêtre déduit le chargement de la demande en cours, ce qui ignore aussi les réponses périmées.
