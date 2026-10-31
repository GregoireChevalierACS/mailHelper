# 0001 — Application de bureau Windows, architecture hexagonale

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

MailHelper lit les courriels récents d'un salarié, les résume, repère ceux qui attendent une réponse et propose des réponses préparées. Il doit se présenter comme un exécutable Windows, fonctionner avec les messageries les plus répandues en entreprise (Gmail, Outlook / Microsoft 365) et appeler un modèle de langage distant.

## Décision

- **Electron**, empaqueté en installeur NSIS et en exécutable portable (ADR 0007). Une seule pile TypeScript du domaine à la fenêtre, et les mêmes outils de qualité partout.
- **Architecture hexagonale en monorepo pnpm** :

  | Paquet                 | Rôle                                                                                    |
  | ---------------------- | --------------------------------------------------------------------------------------- |
  | `packages/domain`      | Courriel, attente de réponse, propositions, brouillon, priorité. Aucune dépendance.     |
  | `packages/application` | Cas d'usage `synthetiser` et `repondre`, ports, contrats zod (LLM et fenêtre).          |
  | `apps/desktop`         | Adapters : Gmail, Microsoft Graph, Claude, OAuth, ouverture des réponses ; IPC ; React. |

- **Ports déclarés par la couche application** : `BoiteDeReception`, `Analyseur`, `OuvreurDeReponse`, `PressePapiers`, `Horloge`. Composition manuelle dans deux _composition roots_ : `main/main.ts` (processus principal) et `renderer/main.tsx` (fenêtre).
- **Aucune persistance des courriels.** Seuls les jetons OAuth sont gardés, chiffrés par Windows (ADR 0005).

## Alternatives écartées

- **Complément Outlook ou extension Chrome** : deux produits à maintenir, et chacun limité à sa messagerie.
- **Application .NET (WPF, WinUI)** : deux langages dans le dépôt, et perte des outils déjà éprouvés (Vitest, Stryker, dependency-cruiser).
- **Tauri** : exécutable plus léger, mais le processus principal en Rust sortirait du TypeScript strict et des tests partagés.

## Conséquences

- ✅ Le domaine et la couche application se testent sans Electron, sans réseau et sans modèle de langage.
- ✅ Ajouter une messagerie revient à écrire un adapter tenu par le contrat de la boîte de réception.
- ❌ Un installeur d'environ 120 Mo, poids habituel d'Electron.
