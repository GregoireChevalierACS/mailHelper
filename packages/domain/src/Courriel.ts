import {
  creerCorrespondant,
  type Correspondant,
  type SaisieDeCorrespondant,
} from './AdresseCourriel.js';
import { creerInstant, type Instant } from './Instant.js';
import { err, ok, type Result } from './Result.js';

declare const marque: unique symbol;

/** Identifiant attribué par la messagerie (Gmail, Graph) : opaque pour le domaine. */
export type IdDeCourriel = string & { readonly [marque]: 'IdDeCourriel' };

const estUnId = (texte: string): texte is IdDeCourriel => texte !== '';

/** Un courriel reçu, tel que le domaine en a besoin pour le résumer et y répondre. */
export interface Courriel {
  readonly id: IdDeCourriel;
  readonly expediteur: Correspondant;
  /** En-tête Reply-To : quand il existe, c'est lui qui reçoit la réponse. */
  readonly repondreA: Correspondant | null;
  readonly objet: string;
  readonly corps: string;
  readonly recuLe: Instant;
  /** Envoi en nombre (List-Unsubscribe, List-Id, Precedence: bulk…), repéré par l'adapter. */
  readonly diffusionDeMasse: boolean;
}

export interface SaisieDeCourriel {
  readonly id: string;
  readonly expediteur: SaisieDeCorrespondant;
  readonly repondreA: SaisieDeCorrespondant | null;
  readonly objet: string;
  readonly corps: string;
  readonly recuLe: number;
  readonly diffusionDeMasse: boolean;
}

export type ErreurDeCourriel =
  | { readonly kind: 'identifiant-vide' }
  | { readonly kind: 'expediteur-invalide' }
  | { readonly kind: 'adresse-de-reponse-invalide' }
  | { readonly kind: 'date-invalide' };

export function creerCourriel(saisie: SaisieDeCourriel): Result<Courriel, ErreurDeCourriel> {
  const id = saisie.id.trim();
  if (!estUnId(id)) return err({ kind: 'identifiant-vide' });

  const expediteur = creerCorrespondant(saisie.expediteur);
  if (!expediteur.ok) return err({ kind: 'expediteur-invalide' });

  let repondreA: Correspondant | null = null;
  if (saisie.repondreA !== null) {
    const lu = creerCorrespondant(saisie.repondreA);
    if (!lu.ok) return err({ kind: 'adresse-de-reponse-invalide' });
    repondreA = lu.value;
  }

  const recuLe = creerInstant(saisie.recuLe);
  if (!recuLe.ok) return err({ kind: 'date-invalide' });

  return ok({
    id,
    expediteur: expediteur.value,
    repondreA,
    objet: saisie.objet.trim(),
    corps: saisie.corps.replace(/\r\n?/gu, '\n').trim(),
    recuLe: recuLe.value,
    diffusionDeMasse: saisie.diffusionDeMasse,
  });
}

/** La réponse part à l'adresse Reply-To si l'expéditeur en a donné une, sinon à l'expéditeur. */
export const destinataireDeReponse = (courriel: Courriel): Correspondant =>
  courriel.repondreA ?? courriel.expediteur;

/**
 * Au-delà, le corps n'est pas envoyé en entier au modèle : un fil de discussion cité dix fois ne
 * change pas le résumé, mais coûte et ralentit. La coupure est signalée, jamais silencieuse.
 */
export const LONGUEUR_MAXIMALE_ANALYSEE = 20_000;

export interface TexteAAnalyser {
  readonly texte: string;
  readonly tronque: boolean;
}

export function texteAAnalyser(courriel: Courriel): TexteAAnalyser {
  const tronque = courriel.corps.length > LONGUEUR_MAXIMALE_ANALYSEE;
  return {
    texte: tronque ? courriel.corps.slice(0, LONGUEUR_MAXIMALE_ANALYSEE) : courriel.corps,
    tronque,
  };
}

const LONGUEUR_DE_L_APERCU = 200;

/** Début du corps sur une ligne, pour la liste des courriels. */
export function apercu(courriel: Courriel): string {
  const uneLigne = courriel.corps.replace(/\s+/gu, ' ');
  return uneLigne.length > LONGUEUR_DE_L_APERCU
    ? `${uneLigne.slice(0, LONGUEUR_DE_L_APERCU - 1)}…`
    : uneLigne;
}
