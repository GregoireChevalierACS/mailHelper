import type { Courriel } from './Courriel.js';
import { motifDeNonReponse } from './EnvoiAutomatique.js';
import { err, ok, type Result } from './Result.js';

export const URGENCES = ['haute', 'normale', 'basse'] as const;
export type Urgence = (typeof URGENCES)[number];

export type AttenteDeReponse =
  | { readonly kind: 'attendue'; readonly urgence: Urgence; readonly motif: string }
  | { readonly kind: 'aucune'; readonly motif: string };

/** Une réponse préparée : une intention courte (« Accepter », « Demander un délai ») et le texte. */
export interface PropositionDeReponse {
  readonly intention: string;
  readonly texte: string;
}

/** Ce que l'application montre pour un courriel, une fois les règles du domaine appliquées. */
export interface Analyse {
  readonly resume: string;
  readonly attente: AttenteDeReponse;
  readonly propositions: readonly PropositionDeReponse[];
}

/** Ce que propose le modèle de langage, déjà validé structurellement, pas encore cru. */
export interface AnalyseProposee {
  readonly resume: string;
  readonly reponseAttendue: boolean;
  readonly urgence: Urgence;
  readonly motif: string;
  readonly propositions: readonly PropositionDeReponse[];
}

export type ErreurDAnalyse =
  { readonly kind: 'resume-vide' } | { readonly kind: 'propositions-manquantes' };

/** Au-delà, l'utilisateur ne lit plus les propositions : il en choisit une parmi les premières. */
export const NOMBRE_MAXIMAL_DE_PROPOSITIONS = 4;

function propositionsUtilisables(
  propositions: readonly PropositionDeReponse[],
): readonly PropositionDeReponse[] {
  const dejaVus = new Set<string>();
  const retenues: PropositionDeReponse[] = [];
  for (const proposition of propositions) {
    const texte = proposition.texte.trim();
    if (texte === '' || dejaVus.has(texte)) continue;
    dejaVus.add(texte);
    const intention = proposition.intention.trim();
    retenues.push({ intention: intention === '' ? 'Réponse' : intention, texte });
  }
  return retenues.slice(0, NOMBRE_MAXIMAL_DE_PROPOSITIONS);
}

/**
 * Confronte la proposition du modèle aux règles du domaine. Le modèle résume et rédige ; c'est le
 * domaine qui a le dernier mot sur l'attente d'une réponse et sur ce qui est montré.
 */
export function consoliderLAnalyse(
  courriel: Courriel,
  proposee: AnalyseProposee,
): Result<Analyse, ErreurDAnalyse> {
  const resume = proposee.resume.trim();
  if (resume === '') return err({ kind: 'resume-vide' });

  const motifImpose = motifDeNonReponse(courriel);
  if (motifImpose !== null) {
    return ok({ resume, attente: { kind: 'aucune', motif: motifImpose }, propositions: [] });
  }

  const motif = proposee.motif.trim();
  if (!proposee.reponseAttendue) {
    return ok({ resume, attente: { kind: 'aucune', motif }, propositions: [] });
  }

  const propositions = propositionsUtilisables(proposee.propositions);
  if (propositions.length === 0) return err({ kind: 'propositions-manquantes' });

  return ok({
    resume,
    attente: { kind: 'attendue', urgence: proposee.urgence, motif },
    propositions,
  });
}
