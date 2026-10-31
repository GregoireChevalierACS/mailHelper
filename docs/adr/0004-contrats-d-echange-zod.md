# 0004 — Contrats d'échange décrits par zod dans la couche application

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

Trois frontières font entrer des données non fiables : la réponse du modèle de langage, les réponses des API de messagerie, et les messages entre la fenêtre et le processus principal (la fenêtre affiche des courriels venus de l'extérieur).

## Décision

- **zod est la seule bibliothèque autorisée dans la couche application** (règle `application-sans-infrastructure`). Elle y décrit :
  - `schemaDAnalyseProposee`, imposé au modèle puis revalidé ;
  - les demandes de la fenêtre (`schemaDeDemandeDeSynthese`, `schemaDeDemandeDeReponse`…), validées à leur arrivée dans le processus principal ;
  - les réponses envoyées à la fenêtre (`schemaDeResultatDeSynthese`…), validées à leur arrivée dans la fenêtre.
- **Objets stricts** : un champ en trop est refusé. Une demande de réponse ne peut donc pas imposer un destinataire.
- **Choix fermés tenus par le compilateur** : `z.enum(URGENCES)` vient du domaine, et `satisfies z.ZodType<AnalyseProposee>` fait échouer la compilation si les deux divergent.
- **Les réponses des API de messagerie** sont validées par des schémas propres à chaque adapter (Gmail, Graph) : ce sont des détails d'infrastructure.

## Conséquences

- ✅ Aucun transtypage de données externes dans le code (`as` interdit par ESLint).
- ✅ Un aller-retour par le contrat est testé : ce que le processus principal produit, la fenêtre l'accepte.
- ❌ Le contrat de la fenêtre double en partie les types du domaine ; c'est le prix d'une frontière vérifiée.
