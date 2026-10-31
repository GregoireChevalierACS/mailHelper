# 0005 — Accès aux messageries : lecture seule, réponse ouverte dans la messagerie

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

MailHelper doit lire les courriels récents, puis ouvrir une réponse « avec le bon destinataire et le bon objet » dans la messagerie de l'utilisateur, après sa confirmation. Les messageries visées : Gmail (navigateur) et Outlook (application, Microsoft 365).

## Décision

- **Lecture par les API officielles**, jamais par automatisation de l'interface ni par IMAP avec mot de passe :
  - Gmail : API REST, portée `gmail.readonly` ;
  - Outlook : Microsoft Graph, permission déléguée `Mail.Read`, annuaire `organizations` par défaut (comptes professionnels).
- **Connexion OAuth 2.0 d'application native** (RFC 8252) : code d'autorisation avec PKCE, redirection vers un serveur local éphémère sur `127.0.0.1`, paramètre `state` contre le CSRF. Aucun mot de passe ne transite par MailHelper.
- **Jetons chiffrés par Windows** (`safeStorage`, DPAPI) dans le profil de l'utilisateur, renouvelés automatiquement ; un fichier illisible vaut « non connecté ».
- **La réponse s'ouvre dans la messagerie, rien n'est envoyé** :
  - Gmail : fenêtre de rédaction web préremplie (`mail.google.com/mail/?view=cm&to=…&su=…&body=…`) ;
  - Outlook : lien `mailto:`, qui ouvre la messagerie par défaut de Windows (Outlook en général) ;
  - le texte est **toujours** copié dans le presse-papiers ; au-delà de 2 000 caractères d'URL, le corps est omis du lien (jamais coupé) et l'utilisateur le colle.
- **Le contrat de la boîte de réception** (rien d'antérieur à la date demandée, au plus N courriels, du plus récent au plus ancien) est appliqué par les adapters eux-mêmes, quoi que l'API renvoie, et vérifié par le même jeu de tests que la doublure en mémoire.

## Alternatives écartées

- **Créer un brouillon par l'API** (`drafts.create`, `createReply`) : la réponse serait rattachée au fil, mais il faudrait des permissions d'écriture (`gmail.compose`, `Mail.ReadWrite`), plus difficiles à faire accepter par un service informatique. Piste notée dans la feuille de route.
- **Automatisation COM d'Outlook classique** : propre à Windows et au « vieil » Outlook, absente du nouvel Outlook.

## Conséquences

- ✅ Permissions minimales : MailHelper ne peut ni envoyer, ni modifier, ni supprimer un courriel.
- ✅ L'utilisateur garde la main : il relit et envoie lui-même depuis sa messagerie habituelle.
- ❌ La réponse ouverte par lien n'est pas rattachée techniquement au fil d'origine (pas d'en-tête `In-Reply-To`) ; l'objet « RE: … » suffit au regroupement dans la plupart des messageries.
- ❌ Chaque entreprise doit inscrire l'application chez Google et/ou Microsoft (identifiant client), ce que le README décrit.
