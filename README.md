# MailHelper

Application de bureau Windows qui lit vos courriels récents, les résume, repère ceux qui attendent une réponse et vous propose des réponses prêtes à l'emploi. Après votre confirmation, elle ouvre une réponse au bon destinataire, avec le bon objet, dans votre messagerie, et copie le texte dans le presse-papiers. **Rien n'est jamais envoyé sans vous.**

- Messageries : **Gmail** (rédaction dans le navigateur) et **Outlook / Microsoft 365** (messagerie par défaut de Windows).
- Analyse : **Claude** (API Anthropic), encadré par des règles déterministes ([ADR 0002](docs/adr/0002-llm-encadre-par-le-domaine.md)).
- Accès en **lecture seule** : MailHelper ne peut ni envoyer, ni modifier, ni supprimer un courriel.

> Le contenu des courriels analysés est transmis à l'API d'Anthropic. Vérifiez que c'est compatible avec la politique de votre entreprise avant tout déploiement.

## Démarrage

Prérequis : Windows 10 ou 11, [Node 24](https://nodejs.org/) (voir `.node-version`), pnpm 10 (`corepack enable`).

```powershell
pnpm install
pnpm dev          # compile puis lance l'application
```

Livrables Windows (installeur NSIS et exécutable portable, dans `apps/desktop/release/`) :

```powershell
pnpm package:windows
```

La CI les construit aussi à chaque exécution (artefact `mailhelper-windows`).

## Configuration

MailHelper lit `%APPDATA%\MailHelper\mailhelper.env`, puis les variables d'environnement. Copiez [`apps/desktop/.env.example`](apps/desktop/.env.example) à cet endroit et renseignez au moins la clé d'API et une messagerie. Une configuration incomplète est signalée au démarrage, avec le nom des variables en cause (jamais leur valeur).

### Clé d'API Claude

Créez une clé sur [platform.claude.com](https://platform.claude.com/) et renseignez `ANTHROPIC_API_KEY`. Modèle par défaut : `claude-opus-5-5`, effort `low` (`MAILHELPER_MODELE`, `MAILHELPER_EFFORT`).

### Gmail

1. [Google Cloud Console](https://console.cloud.google.com/) → nouveau projet → **API et services** → activer l'**API Gmail**.
2. **Écran de consentement OAuth** : type _Interne_ pour un domaine Google Workspace (sinon _Externe_ et utilisateurs de test), portée `https://www.googleapis.com/auth/gmail.readonly`.
3. **Identifiants** → _Créer un ID client OAuth_ → type **Application de bureau**.
4. Renseignez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (pour une application de bureau, ce « secret » n'en est pas un : Google l'exige, mais il est distribué avec l'application).

### Outlook / Microsoft 365

1. [Microsoft Entra ID](https://entra.microsoft.com/) → **Inscriptions d'applications** → _Nouvelle inscription_.
2. **Authentification** → _Ajouter une plateforme_ → **Applications mobiles et de bureau** → URI de redirection `http://127.0.0.1` (le port, choisi au hasard à chaque connexion, est ignoré par Microsoft).
3. **Autorisations de l'API** → Microsoft Graph → autorisations déléguées `Mail.Read` et `offline_access` ; consentement administrateur si votre tenant l'exige.
4. Renseignez `MICROSOFT_CLIENT_ID`, et `MICROSOFT_TENANT` si vous voulez restreindre la connexion à votre annuaire (par défaut : `organizations`, tout compte professionnel).

## Utilisation

1. Choisissez votre messagerie et terminez la connexion dans le navigateur qui s'ouvre.
2. MailHelper résume les courriels des dernières 24 heures (période modifiable), du plus urgent au moins urgent.
3. Cliquez une réponse proposée (ou « Rédiger ma propre réponse »), relisez le destinataire, l'objet et le texte, puis **Copier et ouvrir la réponse**.
4. Relisez dans votre messagerie, et envoyez vous-même.

## Vérifications

| Commande                 | Vérifie                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm lint`              | ESLint typé strict, zéro avertissement                            |
| `pnpm lint:architecture` | Règles de dépendance (dependency-cruiser)                         |
| `pnpm format:check`      | Formatage Prettier                                                |
| `pnpm typecheck`         | TypeScript strict, tous les paquets                               |
| `pnpm test`              | Tous les tests                                                    |
| `pnpm test:coverage`     | Tests et seuil de 100 % de couverture                             |
| `pnpm test:mutation`     | Test de mutation du domaine (Stryker, seuil 80 %)                 |
| `pnpm build`             | Build de production (bibliothèques, processus principal, fenêtre) |

## Organisation

```
packages/domain        règles métier pures (aucune dépendance)
packages/application   cas d'usage, ports, contrats zod
apps/desktop
  src/main             processus principal : adapters Gmail, Graph, Claude, OAuth, IPC
  src/preload          pont minimal vers la fenêtre
  src/renderer         fenêtre React
docs/adr               décisions d'architecture
docs/bonnes-pratiques.md
```

Pratiques et outils qui les font respecter : [docs/bonnes-pratiques.md](docs/bonnes-pratiques.md). Suite prévue : [ROADMAP.md](ROADMAP.md).

## Contribuer

- `main` n'évolue que par pull request : le hook _pre-commit_ refuse un commit direct dessus.
- Format des commits, vérifié au commit et en CI : `aaaa-mm-jj # N : (type) message`, par exemple `2026-10-31 # 1 : (feat) synthèse des courriels`. Types : `feat`, `fix`, `test`, `refactor`, `build`, `ci`, `docs`, `chore`, `perf`, `revert`.

## Problèmes courants

- **`The requested module 'electron' does not provide an export named …`** : la variable `ELECTRON_RUN_AS_NODE` est définie (c'est le cas dans le terminal intégré de VS Code). Lancez depuis un autre terminal, ou retirez-la : `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell).
- **`Electron failed to install correctly`** : le binaire n'a pas été téléchargé. Dans `apps/desktop` : `node node_modules/electron/install.js`.
- **« Cette messagerie n'est pas configurée sur ce poste »** : l'identifiant client correspondant manque dans `mailhelper.env`.
- **« La connexion n'a pas abouti »** : fenêtre du navigateur fermée, accès refusé, ou plus de 5 minutes écoulées. Pour Microsoft, vérifiez l'URI de redirection `http://127.0.0.1` et le consentement à `Mail.Read`.
- **Alerte SmartScreen à l'installation** : les exécutables ne sont pas encore signés ([ADR 0007](docs/adr/0007-empaquetage-windows.md)).
