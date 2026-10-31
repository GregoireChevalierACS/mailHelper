import { err, ok, type Result } from './Result.js';

declare const marque: unique symbol;

/** Moment exprimé en millisecondes depuis l'époque Unix. Le domaine ne lit jamais l'heure : il la reçoit. */
export type Instant = number & { readonly [marque]: 'Instant' };

export interface ErreurDInstant {
  readonly kind: 'instant-invalide';
}

const estUnInstant = (millisecondes: number): millisecondes is Instant =>
  Number.isSafeInteger(millisecondes) && millisecondes >= 0;

export function creerInstant(millisecondes: number): Result<Instant, ErreurDInstant> {
  return estUnInstant(millisecondes) ? ok(millisecondes) : err({ kind: 'instant-invalide' });
}

export const MILLISECONDES_PAR_HEURE = 3_600_000;

/** Instant situé `heures` heures avant `depuis`, borné à l'époque Unix. */
export function heuresAvant(depuis: Instant, heures: number): Instant {
  const valeur = Math.max(0, depuis - heures * MILLISECONDES_PAR_HEURE);
  // Une durée non entière en millisecondes ou non finie est un bug de l'appelant, pas un cas métier.
  if (!estUnInstant(valeur)) throw new RangeError(`durée invalide : ${String(heures)} h`);
  return valeur;
}
