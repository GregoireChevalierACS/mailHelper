import type { Correspondant } from './AdresseCourriel.js';
import { destinataireDeReponse, type Courriel, type IdDeCourriel } from './Courriel.js';
import { estUneAdresseSansLecteur } from './EnvoiAutomatique.js';
import { objetDeReponse } from './ObjetDeReponse.js';
import { err, ok, type Result } from './Result.js';

/** Tout ce qu'il faut pour ouvrir une fenêtre de réponse dans la messagerie de l'utilisateur. */
export interface BrouillonDeReponse {
  readonly a: Correspondant;
  readonly objet: string;
  readonly corps: string;
  readonly enReponseA: IdDeCourriel;
}

export type ErreurDeBrouillon =
  { readonly kind: 'texte-vide' } | { readonly kind: 'destinataire-sans-lecteur' };

/**
 * Le destinataire et l'objet viennent toujours du courriel d'origine, jamais de la fenêtre ni du
 * modèle : seul le texte est choisi par l'utilisateur.
 */
export function preparerLeBrouillon(
  courriel: Courriel,
  texte: string,
): Result<BrouillonDeReponse, ErreurDeBrouillon> {
  const corps = texte.trim();
  if (corps === '') return err({ kind: 'texte-vide' });

  const a = destinataireDeReponse(courriel);
  if (estUneAdresseSansLecteur(a.adresse)) return err({ kind: 'destinataire-sans-lecteur' });

  return ok({ a, objet: objetDeReponse(courriel.objet), corps, enReponseA: courriel.id });
}
