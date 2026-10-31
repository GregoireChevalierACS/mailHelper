import {
  schemaDeDemandeDeConnexion,
  schemaDeDemandeDeReponse,
  schemaDeDemandeDeSynthese,
  versLeResultatDeSynthese,
  type ResultatDeConnexion,
  type ResultatDeReponse,
  type ResultatDeSynthese,
} from '@mailhelper/application';
import type { Canal } from '../canaux.js';
import type { Session } from './session.js';

export type Gestionnaires = Readonly<Record<Canal, (charge: unknown) => Promise<unknown>>>;

/**
 * Gestionnaires des messages de la fenêtre. Chaque charge est validée avant usage : la fenêtre
 * affiche du contenu venu de l'extérieur (des courriels), elle n'est donc pas digne de confiance.
 */
export function creerLesGestionnaires(session: Session): Gestionnaires {
  return {
    async connecter(charge): Promise<ResultatDeConnexion> {
      const demande = schemaDeDemandeDeConnexion.safeParse(charge);
      if (!demande.success) return { ok: false, probleme: 'demande-invalide' };
      return session.connecter(demande.data.fournisseur);
    },

    async synthetiser(charge): Promise<ResultatDeSynthese> {
      const casDUsage = session.casDUsage();
      if (casDUsage === null) return { ok: false, probleme: 'non-connecte' };
      const demande = schemaDeDemandeDeSynthese.safeParse(charge);
      if (!demande.success) return { ok: false, probleme: 'demande-invalide' };
      const synthese = await casDUsage.synthetiser(demande.data);
      return synthese.ok
        ? versLeResultatDeSynthese(synthese.value)
        : { ok: false, probleme: synthese.error.kind };
    },

    async repondre(charge): Promise<ResultatDeReponse> {
      const casDUsage = session.casDUsage();
      if (casDUsage === null) return { ok: false, probleme: 'non-connecte' };
      const demande = schemaDeDemandeDeReponse.safeParse(charge);
      if (!demande.success) return { ok: false, probleme: 'demande-invalide' };
      const reponse = await casDUsage.repondre(demande.data);
      return reponse.ok ? { ok: true } : { ok: false, probleme: reponse.error.kind };
    },
  };
}
