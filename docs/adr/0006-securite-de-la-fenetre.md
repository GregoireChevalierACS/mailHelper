# 0006 — Une fenêtre isolée, qui ne croit pas ce qu'elle affiche

- **Date :** 2026-10-31
- **Statut :** acceptée

## Contexte

La fenêtre affiche des résumés et des extraits de courriels venus de n'importe qui. Electron donne par défaut beaucoup de pouvoir à une page ; une faille d'affichage ne doit pas devenir un accès au système, au réseau ou aux jetons.

## Décision

- **Fenêtre en bac à sable** : `contextIsolation`, `sandbox`, `nodeIntegration: false`. Le preload n'expose que trois appels (`connecter`, `synthetiser`, `repondre`), sans aucune API d'Electron ni de Node.
- **Content-Security-Policy stricte** : scripts et styles du paquet uniquement, aucun réseau (`connect-src 'none'`).
- **Aucune navigation** : nouvelles fenêtres refusées, navigation bloquée. Un lien piégé reste inerte.
- **Messages IPC vérifiés** : l'expéditeur doit être notre page (`senderFrame.url`), et chaque charge est validée par zod (ADR 0004).
- **La fenêtre ne désigne un courriel que par son identifiant** ; destinataire et objet sont relus côté processus principal (ADR 0002).
- **Règles d'architecture** : la fenêtre n'importe ni le processus principal, ni le preload, ni Node (`fenetre-isolee`) ; seuls les _composition roots_ importent Electron (`electron-confine`) ; seul l'adapter `llm` importe le SDK Anthropic (`llm-confine`).

## Conséquences

- ✅ La clé d'API, les jetons et le réseau restent dans le processus principal.
- ✅ Les adapters reçoivent Electron par injection : ils se testent en Node pur.
- ❌ `main.ts` et `preload.ts` ne sont pas couverts par les tests unitaires : ils ne font que brancher des modules testés, et sont vérifiés au lancement.
