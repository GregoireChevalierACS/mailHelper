import type { BrouillonDeReponse, Courriel, Instant } from '@mailhelper/domain';

export interface CritereDeRecherche {
  readonly depuis: Instant;
  readonly limite: number;
}

export interface LotDeCourriels {
  readonly courriels: readonly Courriel[];
  /** Courriels reçus mais inexploitables (expéditeur illisible…) : comptés, jamais cachés. */
  readonly illisibles: number;
}

/**
 * Boîte de réception de l'utilisateur (Gmail, Outlook…). Contrat vérifié par
 * `verifierLeContratDeLaBoiteDeReception` : rien d'antérieur à `depuis`, au plus `limite`
 * courriels, du plus récent au plus ancien.
 */
export interface BoiteDeReception {
  listerLesRecents(critere: CritereDeRecherche): Promise<LotDeCourriels>;
}

/**
 * Modèle de langage qui résume un courriel et propose des réponses. Sa réponse est une donnée
 * externe : elle est renvoyée telle quelle (`unknown`) et validée par la couche application.
 */
export interface Analyseur {
  analyser(courriel: Courriel): Promise<unknown>;
}

/** Ouvre une fenêtre de rédaction dans la messagerie de l'utilisateur, sans jamais envoyer. */
export interface OuvreurDeReponse {
  ouvrir(brouillon: BrouillonDeReponse): Promise<void>;
}

export interface PressePapiers {
  copier(texte: string): Promise<void>;
}

export interface Horloge {
  maintenant(): Instant;
}
