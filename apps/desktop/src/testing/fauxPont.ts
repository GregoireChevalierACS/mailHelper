import type {
  DonneesDeFiche,
  Fournisseur,
  ResultatDeConnexion,
  ResultatDeReponse,
  ResultatDeSynthese,
} from '@mailhelper/application';
import type { Pont } from '../renderer/pont.js';

export const uneFiche = (surcharges: Partial<DonneesDeFiche> = {}): DonneesDeFiche => ({
  id: 'courriel-1',
  expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
  objet: 'Réunion de jeudi',
  recuLe: Date.UTC(2026, 9, 31, 8, 0),
  apercu: 'Bonjour, peux-tu confirmer ta présence jeudi à 10 h ?',
  reponse: {
    a: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
    objet: 'RE: Réunion de jeudi',
  },
  analyse: {
    ok: true,
    resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
    attente: { kind: 'attendue', urgence: 'haute', motif: 'Question directe.' },
    propositions: [
      { intention: 'Confirmer', texte: 'Bonjour Claire, je serai présent.' },
      { intention: 'Décliner', texte: 'Bonjour Claire, je ne pourrai pas venir.' },
    ],
  },
  ...surcharges,
});

/** Réponse prévue : une valeur, une panne, ou une promesse que le test résout quand il veut. */
type Reponse<T> = T | Error | Promise<T>;

async function rendre<T>(reponse: Reponse<T>): Promise<T> {
  if (reponse instanceof Error) throw reponse;
  return reponse;
}

/** Pont factice : répond ce que le test a prévu, et retient ce qu'on lui a demandé. */
export class FauxPont implements Pont {
  connexion: Reponse<ResultatDeConnexion> = { ok: true, fournisseur: 'gmail' };
  synthese: Reponse<ResultatDeSynthese> = { ok: true, fiches: [uneFiche()], illisibles: 0 };
  reponse: Reponse<ResultatDeReponse> = { ok: true };

  readonly connexions: Fournisseur[] = [];
  readonly syntheses: { fenetreEnHeures: number; limite: number }[] = [];
  readonly reponses: { idDuCourriel: string; texte: string }[] = [];

  connecter(fournisseur: Fournisseur) {
    this.connexions.push(fournisseur);
    return rendre(this.connexion);
  }

  synthetiser(demande: { fenetreEnHeures: number; limite: number }) {
    this.syntheses.push(demande);
    return rendre(this.synthese);
  }

  repondre(demande: { idDuCourriel: string; texte: string }) {
    this.reponses.push(demande);
    return rendre(this.reponse);
  }
}
