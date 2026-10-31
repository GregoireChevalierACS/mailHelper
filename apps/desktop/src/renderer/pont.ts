import {
  schemaDeResultatDeConnexion,
  schemaDeResultatDeReponse,
  schemaDeResultatDeSynthese,
  type Fournisseur,
  type ResultatDeConnexion,
  type ResultatDeReponse,
  type ResultatDeSynthese,
} from '@mailhelper/application';

/** Ce que le preload expose sur `window.mailHelper` : des appels qui rendent des données non vérifiées. */
export interface ApiDuPreload {
  connecter(charge: unknown): Promise<unknown>;
  synthetiser(charge: unknown): Promise<unknown>;
  repondre(charge: unknown): Promise<unknown>;
}

export interface Pont {
  connecter(fournisseur: Fournisseur): Promise<ResultatDeConnexion>;
  synthetiser(demande: { fenetreEnHeures: number; limite: number }): Promise<ResultatDeSynthese>;
  repondre(demande: { idDuCourriel: string; texte: string }): Promise<ResultatDeReponse>;
}

/**
 * Valide chaque réponse du processus principal par le contrat publié. Une réponse hors contrat
 * est une panne (versions désaccordées, bug) : elle lève une exception, montrée comme telle.
 */
export function creerLePont(api: ApiDuPreload): Pont {
  return {
    connecter: async (fournisseur) =>
      schemaDeResultatDeConnexion.parse(await api.connecter({ fournisseur })),
    synthetiser: async (demande) =>
      schemaDeResultatDeSynthese.parse(await api.synthetiser(demande)),
    repondre: async (demande) => schemaDeResultatDeReponse.parse(await api.repondre(demande)),
  };
}
