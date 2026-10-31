import { err, ok, type Result } from './Result.js';

declare const marque: unique symbol;

/** Adresse électronique normalisée (sans espaces, en minuscules). */
export type AdresseCourriel = string & { readonly [marque]: 'AdresseCourriel' };

export interface ErreurDAdresse {
  readonly kind: 'adresse-invalide';
}

// Volontairement plus simple que la RFC 5322 : on ne valide que ce qui sert à répondre (une partie
// locale, un « @ », un domaine avec un point), et on refuse ce qui casserait un lien mailto.
const FORME = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:.]+$/u;
const LONGUEUR_MAXIMALE = 254;

const aLaForme = (texte: string): texte is AdresseCourriel =>
  texte.length <= LONGUEUR_MAXIMALE && FORME.test(texte);

export function creerAdresseCourriel(texte: string): Result<AdresseCourriel, ErreurDAdresse> {
  // Les messageries ignorent la casse en pratique, même si la RFC l'autorise dans la partie locale.
  const normalisee = texte.trim().toLowerCase();
  return aLaForme(normalisee) ? ok(normalisee) : err({ kind: 'adresse-invalide' });
}

export const partieLocale = (adresse: AdresseCourriel): string =>
  adresse.slice(0, adresse.indexOf('@'));

/** Quelqu'un à qui l'on écrit ou de qui l'on reçoit : un nom affiché facultatif et une adresse. */
export interface Correspondant {
  readonly nom: string | null;
  readonly adresse: AdresseCourriel;
}

export interface SaisieDeCorrespondant {
  readonly nom: string | null;
  readonly adresse: string;
}

export function creerCorrespondant(
  saisie: SaisieDeCorrespondant,
): Result<Correspondant, ErreurDAdresse> {
  const adresse = creerAdresseCourriel(saisie.adresse);
  if (!adresse.ok) return adresse;
  const nom = saisie.nom?.trim() ?? '';
  return ok({ nom: nom === '' ? null : nom, adresse: adresse.value });
}
