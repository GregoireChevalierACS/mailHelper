import type {
  DonneesDeFiche,
  Fournisseur,
  ResultatDeConnexion,
  ResultatDeReponse,
  ResultatDeSynthese,
} from '@mailhelper/application';

// Catalogue des messages montrés à l'utilisateur. Chaque problème dit quoi faire ; les switch
// exhaustifs (ESLint) obligent à écrire le message de tout nouveau problème.

type Probleme<R> = R extends { readonly ok: false; readonly probleme: infer P } ? P : never;
type ProblemeDAnalyse = Extract<DonneesDeFiche['analyse'], { ok: false }>['probleme'];

export const NOM_DE_LA_MESSAGERIE: Readonly<Record<Fournisseur, string>> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
};

export function messageDeConnexion(probleme: Probleme<ResultatDeConnexion>): string {
  switch (probleme) {
    case 'configuration-incomplete':
      return "Cette messagerie n'est pas configurée sur ce poste. Demandez à votre administrateur de renseigner son identifiant d'application (voir le README).";
    case 'connexion-refusee':
      return "La connexion n'a pas abouti : fenêtre fermée, accès refusé ou délai dépassé. Réessayez.";
    case 'demande-invalide':
      return 'Demande invalide. Redémarrez MailHelper.';
  }
}

export function messageDeSynthese(probleme: Probleme<ResultatDeSynthese>): string {
  switch (probleme) {
    case 'boite-injoignable':
      return 'Impossible de lire la boîte de réception. Vérifiez votre connexion internet, puis actualisez.';
    case 'non-connecte':
      return 'La session a expiré. Redémarrez MailHelper pour vous reconnecter.';
    case 'demande-invalide':
      return 'Demande invalide. Redémarrez MailHelper.';
  }
}

export function messageDeReponse(probleme: Probleme<ResultatDeReponse>): string {
  switch (probleme) {
    case 'texte-vide':
      return 'Le texte de la réponse est vide.';
    case 'destinataire-sans-lecteur':
      return "Cette adresse n'est lue par personne (envoi automatique) : une réponse n'arriverait à personne.";
    case 'presse-papiers-indisponible':
      return "Le presse-papiers est indisponible : rien n'a été ouvert. Réessayez.";
    case 'ouverture-impossible':
      return "La messagerie ne s'est pas ouverte. Le texte est dans le presse-papiers : collez-le dans une réponse.";
    case 'courriel-inconnu':
      return 'Ce courriel ne fait plus partie de la synthèse. Actualisez, puis réessayez.';
    case 'non-connecte':
      return 'La session a expiré. Redémarrez MailHelper pour vous reconnecter.';
    case 'demande-invalide':
      return 'Demande invalide (texte trop long ?).';
  }
}

export function messageDAnalyse(probleme: ProblemeDAnalyse): string {
  switch (probleme) {
    case 'analyseur-injoignable':
      return "Le résumé n'a pas pu être produit (service d'analyse injoignable). Lisez ce courriel vous-même.";
    case 'reponse-du-modele-invalide':
    case 'resume-vide':
    case 'propositions-manquantes':
      return 'Le résumé produit était inexploitable et a été écarté. Lisez ce courriel vous-même.';
  }
}

export function libelleDeLAttente(analyse: DonneesDeFiche['analyse']): string {
  if (!analyse.ok) return 'Non analysé';
  if (analyse.attente.kind === 'aucune') return 'Aucune réponse attendue';
  switch (analyse.attente.urgence) {
    case 'haute':
      return 'Réponse attendue · urgent';
    case 'normale':
      return 'Réponse attendue';
    case 'basse':
      return 'Réponse attendue · peu urgent';
  }
}

export const MESSAGE_DE_PANNE =
  "Erreur inattendue. Si elle se reproduit, redémarrez MailHelper et signalez-la à l'équipe.";
