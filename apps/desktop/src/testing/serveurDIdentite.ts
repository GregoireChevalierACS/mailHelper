import type { DependancesOAuth, FournisseurOAuth } from '../main/oauth/connexionOAuth.js';

export const FOURNISSEUR_DE_TEST: FournisseurOAuth = {
  urlDAutorisation: 'https://identite.exemple/authorize',
  urlDeJeton: 'https://identite.exemple/token',
  clientId: 'client-de-test',
  clientSecret: 'secret-de-test',
  portees: ['lecture', 'hors-ligne'],
  parametresDAutorisation: { prompt: 'consent' },
};

export interface ReponseDeJeton {
  readonly statut: number;
  readonly corps: unknown;
}

/**
 * Faux fournisseur d'identité : le « navigateur » suit la redirection vers le serveur local comme
 * le ferait l'utilisateur, et le point de jeton répond ce qu'on lui a demandé de répondre.
 */
export class ServeurDIdentite {
  readonly urlsOuvertes: URL[] = [];
  readonly demandesDeJeton: URLSearchParams[] = [];
  /** Ce que le navigateur renvoie au serveur local ; par défaut, le code et l'état reçus. */
  redirection: (url: URL) => string = (url) =>
    `?code=code-recu&state=${url.searchParams.get('state') ?? ''}`;
  reponsesDeJeton: ReponseDeJeton[] = [];
  maintenant = 1_000_000;

  dependances(surcharges: Partial<DependancesOAuth> = {}): DependancesOAuth {
    return {
      fetch: (_url, init) => {
        this.demandesDeJeton.push(
          new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
        );
        const reponse = this.reponsesDeJeton.shift() ?? {
          statut: 200,
          corps: { access_token: 'acces-1', refresh_token: 'renouvellement-1', expires_in: 3600 },
        };
        return Promise.resolve(Response.json(reponse.corps, { status: reponse.statut }));
      },
      ouvrirLeNavigateur: async (url) => {
        const ouverte = new URL(url);
        this.urlsOuvertes.push(ouverte);
        const retour = ouverte.searchParams.get('redirect_uri') ?? '';
        await fetch(`${retour}favicon.ico`);
        await fetch(`${retour}${this.redirection(ouverte)}`);
      },
      maintenant: () => this.maintenant,
      ...surcharges,
    };
  }
}
