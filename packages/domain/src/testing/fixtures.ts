import { creerCourriel, type Courriel, type SaisieDeCourriel } from '../Courriel.js';

// 2026-10-31 09:00:00 UTC
export const INSTANT_DE_REFERENCE = 1_793_437_200_000;

export const uneSaisieDeCourriel = (
  surcharges: Partial<SaisieDeCourriel> = {},
): SaisieDeCourriel => ({
  id: 'courriel-1',
  expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
  repondreA: null,
  objet: 'Réunion de jeudi',
  corps: 'Bonjour,\n\nPeux-tu confirmer ta présence jeudi à 10 h ?\n\nClaire',
  recuLe: INSTANT_DE_REFERENCE,
  diffusionDeMasse: false,
  ...surcharges,
});

export function unCourriel(surcharges: Partial<SaisieDeCourriel> = {}): Courriel {
  const courriel = creerCourriel(uneSaisieDeCourriel(surcharges));
  if (!courriel.ok) throw new Error(`fixture invalide : ${courriel.error.kind}`);
  return courriel.value;
}
