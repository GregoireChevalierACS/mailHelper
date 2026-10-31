# Bonnes pratiques appliquées

Ce document recense les pratiques de conception, de test et d'outillage du projet, avec l'endroit où chacune s'applique et l'outil qui la fait respecter. Les décisions détaillées sont dans les [ADR](adr/). Il reprend celui du projet `slideshowBuilder`, adapté à une application de bureau qui s'appuie sur un modèle de langage.

## Principes

- **Le métier d'abord.** Qui reçoit la réponse, quand une réponse est attendue, dans quel ordre lire ses courriels : ces décisions viennent d'un domaine pur, sans framework ni entrée-sortie, testé à 100 % et par mutation.
- **Une règle n'existe que si un outil la vérifie.** Chaque règle de ce document est tenue par le compilateur, ESLint, dependency-cruiser, un hook Git ou la CI. Une règle seulement écrite finit par être contournée.
- **Chaque motif de conception répond à un besoin réel.** Pas de framework d'injection, d'ORM, de base de données ni de bus de messages pour une application locale mono-utilisateur qui ne stocke aucun courriel.
- **Échouer tôt et bruyamment.** Configuration validée au démarrage, réponse du modèle revalidée, messages entre processus validés des deux côtés.
- **Tracer les décisions.** ADR, feuille de route avec critères de fin, commentaires qui expliquent le _pourquoi_ plutôt que le _quoi_.
- **Le modèle propose, le domaine décide** ([ADR 0002](adr/0002-llm-encadre-par-le-domaine.md)). Le LLM résume et rédige ; il ne choisit jamais le destinataire, ne peut pas imposer une réponse à un robot, et n'envoie rien.

## Architecture

### Hexagonale, en monorepo pnpm

[ADR 0001](adr/0001-application-de-bureau-hexagonale.md)

| Paquet                                             | Rôle                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`packages/domain`](../packages/domain/)           | Courriel, attente de réponse, consolidation de l'analyse, brouillon de réponse, priorité. Aucune dépendance. |
| [`packages/application`](../packages/application/) | Cas d'usage `synthetiser` et `repondre`, ports, contrats zod (sortie du LLM, échanges avec la fenêtre).      |
| [`apps/desktop`](../apps/desktop/)                 | Adapters : Gmail, Microsoft Graph, Claude, OAuth, ouverture des réponses ; IPC ; fenêtre React.              |

### Règles de dépendance vérifiées à deux niveaux

- **Dans l'éditeur et au commit**, ESLint (`no-restricted-imports`) interdit au domaine d'importer un framework, Node ou une autre couche, et à la fenêtre d'importer Electron, Node ou le processus principal.
- **En CI**, [dependency-cruiser](../.dependency-cruiser.mjs) vérifie le graphe complet :

  | Règle                               | Ce qu'elle garantit                                                                                 |
  | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
  | `domaine-pur`                       | Le domaine ne dépend de rien                                                                        |
  | `application-sans-infrastructure`   | La couche application ne connaît que le domaine et zod                                              |
  | `api-publique-seulement`            | Chaque paquet n'est importé que par son `index.ts`                                                  |
  | `llm-confine`                       | Seul l'adapter `llm` parle au modèle de langage                                                     |
  | `electron-confine`                  | Seuls les _composition roots_ importent Electron                                                    |
  | `fenetre-isolee`                    | La fenêtre n'importe ni le processus principal, ni le preload, ni Node                              |
  | `pas-de-cycle`                      | Aucun cycle entre modules                                                                           |
  | `production-independante-des-tests` | Le code livré n'importe ni test ni doublure                                                         |
  | `production-sans-dependance-de-dev` | Le code livré n'utilise pas de dépendance de développement (sauf Electron, fourni par l'installeur) |
  | `pas-de-fourre-tout`                | Pas de `utils`, `helpers`, `common`…                                                                |
  | `pas-d-orphelin`                    | Pas de module que personne n'importe (code mort)                                                    |

### Composition

- **Ports déclarés là où ils servent**, dans la couche application ([`ports.ts`](../packages/application/src/ports.ts)) : `BoiteDeReception`, `Analyseur`, `OuvreurDeReponse`, `PressePapiers`, `Horloge`.
- **Composition manuelle**, sans framework d'injection : `creerLesCasDUsage({ boite, analyseur, ouvreur, pressePapiers, horloge })`. Un _composition root_ par processus : [`main/main.ts`](../apps/desktop/src/main/main.ts) et [`renderer/main.tsx`](../apps/desktop/src/renderer/main.tsx).
- **Electron injecté, jamais importé par les adapters** : `safeStorage`, `shell.openExternal`, `clipboard` arrivent en paramètres, si bien que chaque adapter se teste en Node pur.
- **Paquets compilés en bibliothèques** (tsdown, ESM). Les tests lisent les sources par la condition d'export `source`, jamais livrée ; les doublures partagées sont exposées sous `@mailhelper/application/testing`.

## Modélisation du domaine

- **Langage métier, en français** : `Courriel`, `AttenteDeReponse`, `PropositionDeReponse`, `BrouillonDeReponse`. Pas de `Data`, `Manager` ou `Helper`.
- **Value Objects immuables, validés à la création** : `AdresseCourriel`, `Correspondant`, `Instant`, `Courriel`. Un objet invalide ne peut pas exister.
- **Invariants portés par les types** :
  - types marqués (`AdresseCourriel`, `IdDeCourriel`, `Instant`), validés à l'entrée par des gardes de type, sans transtypage ;
  - unions discriminées (`kind`) pour l'attente de réponse et les erreurs ;
  - vérification d'exhaustivité des `switch` par ESLint.

  Les choix fermés des schémas zod listent exactement ceux du domaine (`z.enum(URGENCES)`, `satisfies z.ZodType<AnalyseProposee>`), sinon la compilation échoue.

- **Erreurs métier en `Result<T, E>`** ([`Result.ts`](../packages/domain/src/Result.ts)), jamais en exceptions. Les exceptions sont réservées aux pannes : réponse hors contrat, bug.
- **Fonctions pures et déterministes.** ESLint interdit `new Date()`, `Date.now()` et `Math.random()` dans le domaine : le temps passe par le port `Horloge`.
- **Règles qui l'emportent sur le modèle** : une adresse sans lecteur ou un envoi en nombre n'attend jamais de réponse ([`EnvoiAutomatique.ts`](../packages/domain/src/EnvoiAutomatique.ts)), et le destinataire de la réponse est toujours relu dans le courriel ([`BrouillonDeReponse.ts`](../packages/domain/src/BrouillonDeReponse.ts)).

## Tests

### Pyramide

| Niveau      | Outil                                | Exemples                                                                                  |
| ----------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Unitaire    | Vitest                               | Value Objects, objet « RE: », règles de non-réponse, consolidation de l'analyse           |
| Propriétés  | fast-check                           | Objet de réponse idempotent, tri par priorité qui conserve les éléments                   |
| Contrat     | Vitest                               | Le même comportement exigé de la boîte en mémoire, de Gmail et d'Outlook                  |
| Intégration | Vitest + fausses API + serveur local | OAuth complet (PKCE, état, refus, délai) sur un vrai serveur 127.0.0.1 ; IPC              |
| Composants  | Testing Library                      | Connexion, synthèse, dialogue de confirmation, interrogés par rôle et libellé             |
| Lancement   | Electron, sur le livrable empaqueté  | `MailHelper.exe` démarre et affiche la fenêtre (voir la feuille de route : à automatiser) |
| Mutation    | Stryker, sur le domaine              | Seuil bloquant à 80 %, score actuel de 100 %                                              |

### Règles

- **100 % de couverture** (lignes, branches, fonctions) sur tout le code source, imposée par [vitest.config.ts](../vitest.config.ts). Seuls les _composition roots_ (`main.ts`, `preload.ts`, `main.tsx`), les `index.ts` et les doublures en sont exclus. Une branche inatteignable se supprime au lieu d'être ignorée.
- **Fakes plutôt que mocks** : un mock vérifie des appels, un Fake tenu par un contrat vérifie un comportement ([`contratDeLaBoiteDeReception.ts`](../packages/application/src/testing/contratDeLaBoiteDeReception.ts)). Les adapters Gmail et Outlook passent le même contrat que la doublure, contre de fausses API qui ne filtrent ni ne trient : le contrat est tenu par l'adapter, pas par la chance.
- **Le modèle de langage n'est jamais appelé en test** : l'analyseur reçoit une fonction d'envoi injectée, et les réponses mal formées du modèle (texte libre, champ inventé, refus, réponse tronquée) sont des cas de test.
- **Un mutant équivalent ne s'ignore qu'avec une justification écrite**, à côté du code (`// Stryker disable next-line … : raison`).
- **Fixtures paresseuses** : des fonctions (`unCourriel()`, `uneReponseDuModele()`), jamais des objets construits au chargement d'un fichier.
- **Concurrence testée** : nombre maximal d'analyses simultanées, connexion OAuth partagée entre demandes simultanées, synthèse périmée ignorée par la fenêtre.

## Typage et style

- **TypeScript au plus strict** ([tsconfig.base.json](../tsconfig.base.json)) :
  - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` ;
  - `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns` ;
  - `verbatimModuleSyntax`, `useUnknownInCatchVariables`.
- **ESLint `strictTypeChecked` et `stylisticTypeChecked`** ([eslint.config.mjs](../eslint.config.mjs)) :
  - pas de `any` ;
  - **aucune assertion de type `as`** (`assertionStyle: 'never'`) ;
  - imports de types explicites, `switch` exhaustifs, `eqeqeq` ;
  - règles des hooks React (dont `set-state-in-effect`) ;
  - toute désactivation d'une règle doit porter une justification (`eslint-comments/require-description`), et une désactivation devenue inutile est une erreur ;
  - zéro avertissement toléré.
- **Les données externes sont validées par zod, jamais transtypées** : réponse du modèle, réponses de Gmail et de Graph, jetons OAuth relus sur disque, messages entre la fenêtre et le processus principal, configuration.
- **Prettier et `.editorconfig`**, appliqués à chaque commit par lint-staged. Fins de ligne LF imposées par `.gitattributes`, même sous Windows.
- **Code, commentaires et documentation en français**, comme le métier.

## Échanges et persistance

[ADR 0004](adr/0004-contrats-d-echange-zod.md)

- **Validation à trois niveaux** :

  | Niveau       | Outil       | Problème renvoyé à la fenêtre                             |
  | ------------ | ----------- | --------------------------------------------------------- |
  | Structure    | zod         | `demande-invalide` (champ en trop, période hors limites…) |
  | Règle métier | domaine     | `texte-vide`, `destinataire-sans-lecteur`                 |
  | État         | cas d'usage | `non-connecte`, `courriel-inconnu`, `boite-injoignable`…  |

- **Un catalogue de messages** ([`messages.ts`](../apps/desktop/src/renderer/messages.ts)) : chaque problème a un message qui dit quoi faire, et un `switch` exhaustif oblige à écrire celui de tout nouveau problème. Une erreur interne n'expose jamais son détail (statut HTTP seulement, jamais le corps).
- **Un seul contrat d'échange** : les schémas zod de la couche application servent au processus principal (demandes) et à la fenêtre (réponses).
- **Rien n'est stocké hormis les jetons OAuth**, chiffrés par Windows ; un fichier de jetons illisible vaut « non connecté » au lieu d'être cru.
- **Configuration validée au démarrage**, sans jamais afficher la valeur reçue (elle pourrait être un secret). Un modèle [`.env.example`](../apps/desktop/.env.example) est versionné.

## Sécurité

[ADR 0005](adr/0005-acces-aux-messageries.md), [ADR 0006](adr/0006-securite-de-la-fenetre.md)

- **Permissions minimales** : `gmail.readonly` et `Mail.Read`. MailHelper ne peut ni envoyer, ni modifier, ni supprimer un courriel.
- **OAuth d'application native** : PKCE, `state`, redirection sur `127.0.0.1` uniquement, jamais de mot de passe.
- **Fenêtre isolée** : `contextIsolation`, `sandbox`, CSP sans réseau, navigation et nouvelles fenêtres bloquées, expéditeur des messages IPC vérifié.
- **Injection de consignes contenue** : le courriel est une donnée encadrée de balises qu'il ne peut pas fermer, et le pire résultat possible est une proposition que l'utilisateur voit avant tout envoi.
- **Moindre privilège en CI** : `permissions: contents: read` par défaut.
- **Dépendances surveillées** :
  - `pnpm audit --audit-level high` bloquant en CI ;
  - analyse CodeQL (`security-and-quality`) à chaque PR et chaque semaine ;
  - Dependabot pour les paquets et les actions GitHub.
- **Quarantaine des versions** : `minimumReleaseAge` de 3 jours, et scripts d'installation bloqués sauf Electron et esbuild.
- **Versions exactes** (`save-exact`), lockfile figé en CI (`--frozen-lockfile`), Node et pnpm épinglés (`.node-version`, `packageManager`, `engine-strict`).

## Interface

- **Rien ne part sans confirmation** : un clic sur une proposition ouvre un dialogue qui montre le destinataire et l'objet, et où le texte se relit et se modifie. La confirmation copie le texte et ouvre la messagerie ; l'envoi reste à l'utilisateur.
- **Accessibilité** : rôles ARIA (`dialog`, `status`, `alert`, `group`), libellés associés aux champs, niveau d'attente écrit en toutes lettres et pas seulement en couleur. Les tests interrogent l'interface comme un lecteur d'écran.
- **Utilisable au clavier** : Échap ferme le dialogue, le texte reçoit le focus à l'ouverture.
- **Dégradation propre** : un courriel non analysé reste listé avec son aperçu, une boîte injoignable donne un message qui dit quoi faire, une synthèse périmée n'écrase jamais la plus récente.

## Git et intégration continue

- **Format de commit vérifié** : `aaaa-mm-jj # N : (type) message`, contrôlé par commitlint au commit et en CI, date comprise. Le seul cas exempté est Dependabot, reconnu par l'auteur de la PR et non par le message, qui serait falsifiable.
- **`main` n'évolue que par pull request**, même en solo : branche protégée, et hook _pre-commit_ qui refuse un commit direct sur `main`.
- **Branches courtes** (`feat/…`, `docs/…`), petits commits atomiques.
- **Husky et lint-staged** : ESLint et Prettier sur les fichiers modifiés à chaque commit.
- **CI en deux temps** ([ci.yml](../.github/workflows/ci.yml)) :
  - vérification sous Linux : audit → format des commits → lint → architecture → formatage → types → tests et couverture → build → mutation ;
  - puis installeur Windows (`windows-latest`), publié en artefact ;
  - une exécution obsolète est annulée (`concurrency`), et chaque job a une durée maximale (`timeout-minutes`).

## Documentation

- **ADR** pour chaque décision structurante : contexte, décision, alternatives écartées, conséquences positives et négatives ([docs/adr](adr/)).
- **[Feuille de route](../ROADMAP.md)** : un critère vérifiable « terminé quand… » par phase, et les pièges rencontrés notés au fil de l'eau.
- **[README](../README.md) exécutable** : installation, configuration des messageries, commandes de vérification, problèmes courants.
- **Chaque exception est justifiée à côté de la règle** qu'elle contourne : Electron en dépendance de développement, `Object.keys` transtypé dans `main.ts`, versions d'outils retenues ([ADR 0003](adr/0003-versions-de-l-outillage.md)).

## Écarté délibérément

Ces pratiques sont valables ailleurs, mais disproportionnées pour une application locale mono-utilisateur :

- base de données, historique des synthèses : rien n'est stocké, rien ne fuit ;
- outbox, bus de messages, framework d'injection de dépendances, ORM ;
- envoi automatique des réponses : l'utilisateur reste l'expéditeur, toujours ;
- comparaison de captures d'écran : trop fragile d'une machine à l'autre, l'interface est testée par ses rôles.
