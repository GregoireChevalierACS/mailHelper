# 0008 — Boîte IMAP et dépôt de brouillons, pour les autres applications

- **Date :** 2026-11-25
- **Statut :** acceptée. Précise l'ADR 0005 sans la remplacer.

## Contexte

[relaisMetier](https://github.com/GregoireChevalierACS/relaisMetier) réutilise le domaine et le contrat de boîte de réception de mailHelper pour une petite entreprise dont les boîtes partagées sont chez un hébergeur IMAP standard, sans API. Ce service doit lire la boîte de réception et le dossier des messages envoyés, puis **déposer des brouillons** (avec le devis PDF en pièce jointe) que l'utilisateur relit et envoie lui-même. n8n sait lire une boîte IMAP, mais pas y déposer de brouillon.

L'ADR 0005 écarte l'IMAP par mot de passe **pour l'application de bureau**, qui passe par les API de Gmail et de Graph avec OAuth. Ce choix reste valable pour elle.

## Décision

- **Deux nouveaux paquets**, consommés par leur API publique :
  - `@mailhelper/messagerie` : les utilitaires communs aux adapters (lecture des en-têtes, détection des envois en masse, application du contrat de la boîte aux réponses brutes), déplacés depuis `apps/desktop` sans changement de comportement ;
  - `@mailhelper/imap` : `creerLaBoiteImap` (réception ou envoyés) et `creerLeDepositaireImap`, avec imapflow, mailparser et nodemailer (même auteur, maintenus ensemble).
- **Nouveau port `DepositaireDeBrouillon`** dans la couche application, tenu par `verifierLeContratDuDepositaireDeBrouillon` : la doublure en mémoire et l'adapter IMAP passent le même contrat (destinataire, objet, corps, accents, pièces jointes octet pour octet, dépôts successifs).
- **L'adapter IMAP passe les deux contrats contre un vrai serveur** (GreenMail), en local comme en CI : aucune fausse API IMAP à maintenir.
- **Identifiant d'un message : `UIDVALIDITY:UID`**, stable tant que le serveur ne réinitialise pas le dossier, ce qui permet à l'application qui relève la boîte de ne traiter un message qu'une fois.
- **Pièces jointes reçues** (ajout, pour le devis PDF transféré et les envois de devis du dossier « Envoyés ») : le `Courriel` porte ses `piecesJointes`, octet pour octet. Les images intégrées au corps HTML (`related`) n'en sont pas. Le type `PieceJointe` passe au domaine, réexporté par l'application sous le même nom. Gmail et Outlook ne les lisent pas encore : le champ est facultatif à la saisie, et vaut une liste vide.
- **Lecture seule** : le dossier est ouvert en `EXAMINE`, un relevé ne marque aucun message comme lu.
- **Brouillon** : `APPEND` dans le dossier `\Drafts` (reconnu par l'attribut RFC 6154 ou par son nom : « Drafts », « Brouillons »…, créé s'il n'existe pas), drapeaux `\Draft` et `\Seen`. Aucun envoi n'est possible par ce chemin.
- **L'application de bureau n'utilise pas `@mailhelper/imap`**, ce que vérifie la règle dependency-cruiser `imap-confine` : son installeur n'embarque aucune de ces bibliothèques.

## Alternatives écartées

- **Adapter IMAP dans relaisMetier** : il aurait fallu y recopier la détection des envois en masse et l'application du contrat, et le code générique ne serait plus partagé.
- **Fausse API IMAP pour les tests**, comme pour Gmail et Graph : le protocole est trop riche (dates de recherche au jour près, UIDPLUS, attributs de dossiers) pour qu'une doublure maison soit fidèle. GreenMail est un vrai serveur IMAP, léger et déterministe.
- **Composer le MIME à la main** : les pièces jointes binaires, les noms de fichier accentués et le pliage des en-têtes sont exactement ce que nodemailer fait déjà bien.

## Conséquences

- ✅ Une messagerie de plus derrière le même contrat, sans toucher au domaine.
- ✅ Les tests d'IMAP vérifient le comportement d'un vrai serveur, y compris la recherche `SINCE` au jour près (on cherche un jour plus tôt, puis on filtre à la milliseconde).
- ❌ Les tests du paquet `imap` demandent GreenMail : `docker run -p 3143:3143 greenmail/standalone:2.1.15` en local, service Docker en CI.
- ❌ Le brouillon n'est pas rattaché au fil d'origine (pas d'en-tête `In-Reply-To`) : le `Courriel` du domaine ne porte pas le `Message-ID`. À ajouter si le regroupement par objet ne suffit pas.
