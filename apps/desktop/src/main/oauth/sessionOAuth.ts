import {
  autoriser,
  renouveler,
  type DependancesOAuth,
  type FournisseurOAuth,
  type Jetons,
} from './connexionOAuth.js';

/** Où les jetons survivent à un redémarrage (chiffrés par Windows, voir coffreChiffre.ts). */
export interface CoffreDeJetons {
  lire(): Promise<Jetons | null>;
  ecrire(jetons: Jetons): Promise<void>;
}

/** Marge avant expiration : un jeton qui expire pendant la requête la ferait échouer. */
export const MARGE_D_EXPIRATION = 60_000;

/**
 * Donne un jeton d'accès valide : celui du coffre s'il l'est encore, sinon un jeton renouvelé,
 * sinon une nouvelle connexion dans le navigateur. Les demandes simultanées partagent la même
 * opération (une seule fenêtre de connexion, un seul renouvellement).
 */
export function creerUneSessionOAuth(
  fournisseur: FournisseurOAuth,
  coffre: CoffreDeJetons,
  dependances: DependancesOAuth,
) {
  let enCours: Promise<string> | null = null;

  async function obtenir(): Promise<string> {
    const actuels = await coffre.lire();
    if (actuels !== null && actuels.expireA - MARGE_D_EXPIRATION > dependances.maintenant()) {
      return actuels.acces;
    }

    let nouveaux: Jetons | null = null;
    if (actuels !== null && actuels.renouvellement !== null) {
      try {
        nouveaux = await renouveler(fournisseur, actuels.renouvellement, dependances);
      } catch {
        // Renouvellement révoqué ou expiré : l'utilisateur se reconnecte.
        nouveaux = null;
      }
    }
    nouveaux ??= await autoriser(fournisseur, dependances);
    await coffre.ecrire(nouveaux);
    return nouveaux.acces;
  }

  return {
    jeton(): Promise<string> {
      enCours ??= obtenir().finally(() => {
        enCours = null;
      });
      return enCours;
    },
  };
}

export type SessionOAuth = ReturnType<typeof creerUneSessionOAuth>;
