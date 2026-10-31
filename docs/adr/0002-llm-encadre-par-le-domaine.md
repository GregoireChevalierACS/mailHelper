# 0002 — Un modèle de langage encadré par le domaine

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

Résumer un courriel et rédiger une réponse demandent un modèle de langage. Mais ses sorties ne sont ni déterministes ni sûres : il peut se tromper de format, se laisser manipuler par le contenu d'un courriel (injection de consignes), ou proposer de répondre à un robot. Le projet dont ces pratiques sont issues avait écarté tout LLM ; ici, il est le cœur du service, et il faut donc le contenir.

## Décision

- **Le modèle propose, le domaine décide.** `consoliderLAnalyse` confronte la proposition aux règles du domaine :
  - une adresse que personne ne lit (`noreply`, `mailer-daemon`, `notifications`…) ou un envoi en nombre (`List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`) n'attend **jamais** de réponse, quoi qu'en dise le modèle ;
  - les propositions sont nettoyées (espaces, doublons, textes vides) et limitées à quatre ;
  - un résumé vide ou une réponse attendue sans proposition est refusé.
- **Le destinataire et l'objet ne viennent jamais du modèle ni de la fenêtre** : ils sont relus dans le courriel d'origine (`preparerLeBrouillon`). Le modèle ne fournit que du texte, que l'utilisateur relit et confirme.
- **Sortie contrainte puis revalidée** : le schéma zod de la couche application est imposé au modèle (sorties structurées), puis la réponse est revalidée à la réception. Un champ inconnu ou une urgence inventée sont refusés.
- **Le courriel est une donnée, pas une consigne** : il est encadré par des balises que son contenu ne peut pas fermer (`messageDAnalyse`), et la consigne système le dit explicitement.
- **Modèle et effort** : `claude-opus-5-5`, effort `low` par défaut (configurable). Résumer et rédiger une réponse courte ne demande pas de longue réflexion ; « low » garde une boîte de vingt courriels sous la minute, avec quatre analyses en parallèle.
- **Repli en cas de refus** : `fallbacks: "default"`. Si le modèle décline pour une raison de politique d'usage, l'API relance la demande sur le modèle de repli prévu par Anthropic.
- **Pas de cache de prompt** : la consigne système fait moins que le préfixe minimal mis en cache ; un `cache_control` n'aurait aucun effet.
- **Corps tronqué à 20 000 caractères, et signalé** au modèle : un long fil cité ne change pas le résumé, mais coûte et ralentit.

## Alternatives écartées

- **Classer l'attente de réponse par règles seules** : les règles reconnaissent bien les robots, mais pas une question posée au détour d'un paragraphe.
- **Laisser le modèle envoyer la réponse** (outil « envoyer ») : une seule injection réussie suffirait à écrire au nom de l'utilisateur. MailHelper n'a d'ailleurs aucune permission d'envoi (ADR 0005).

## Conséquences

- ✅ Le pire qu'un courriel piégé puisse obtenir est un mauvais résumé ou une proposition absurde, que l'utilisateur voit avant tout envoi.
- ✅ Les règles du domaine sont testées à 100 % et par mutation, indépendamment du modèle.
- ❌ Le contenu des courriels est transmis à Anthropic. Un déploiement en entreprise doit le valider (conditions commerciales, rétention des données) ; l'écran de connexion l'annonce.
- ❌ Un coût par courriel analysé, et une qualité de résumé qui ne se vérifie qu'à l'usage (voir la feuille de route : jeu d'évaluation).
