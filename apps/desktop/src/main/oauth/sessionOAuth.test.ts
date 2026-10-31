import { describe, expect, it } from 'vitest';
import { FOURNISSEUR_DE_TEST, ServeurDIdentite } from '../../testing/serveurDIdentite.js';
import type { Jetons } from './connexionOAuth.js';
import { creerUneSessionOAuth, MARGE_D_EXPIRATION, type CoffreDeJetons } from './sessionOAuth.js';

class CoffreEnMemoire implements CoffreDeJetons {
  constructor(public jetons: Jetons | null = null) {}
  lire() {
    return Promise.resolve(this.jetons);
  }
  ecrire(jetons: Jetons) {
    this.jetons = jetons;
    return Promise.resolve();
  }
}

describe('session OAuth', () => {
  it('se connecte dans le navigateur la première fois et garde les jetons', async () => {
    const identite = new ServeurDIdentite();
    const coffre = new CoffreEnMemoire();
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());

    expect(await session.jeton()).toBe('acces-1');
    expect(identite.urlsOuvertes).toHaveLength(1);
    expect(coffre.jetons?.renouvellement).toBe('renouvellement-1');
  });

  it('réutilise un jeton encore valide au-delà de la marge, sans réseau', async () => {
    const identite = new ServeurDIdentite();
    const coffre = new CoffreEnMemoire({
      acces: 'en-cache',
      renouvellement: 'r',
      expireA: identite.maintenant + MARGE_D_EXPIRATION + 1,
    });
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());
    expect(await session.jeton()).toBe('en-cache');
    expect(identite.demandesDeJeton).toEqual([]);
  });

  it('renouvelle un jeton qui expire dans la marge', async () => {
    const identite = new ServeurDIdentite();
    identite.reponsesDeJeton = [
      { statut: 200, corps: { access_token: 'renouvele', expires_in: 3600 } },
    ];
    const coffre = new CoffreEnMemoire({
      acces: 'presque-expire',
      renouvellement: 'r',
      expireA: identite.maintenant + MARGE_D_EXPIRATION,
    });
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());

    expect(await session.jeton()).toBe('renouvele');
    expect(identite.urlsOuvertes).toEqual([]);
    expect(coffre.jetons).toEqual({ acces: 'renouvele', renouvellement: 'r', expireA: 4_600_000 });
  });

  it('reconnecte l’utilisateur quand le renouvellement est refusé', async () => {
    const identite = new ServeurDIdentite();
    identite.reponsesDeJeton = [{ statut: 400, corps: { error: 'invalid_grant' } }];
    const coffre = new CoffreEnMemoire({ acces: 'expire', renouvellement: 'revoque', expireA: 0 });
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());

    expect(await session.jeton()).toBe('acces-1');
    expect(identite.urlsOuvertes).toHaveLength(1);
  });

  it('reconnecte l’utilisateur sans jeton de renouvellement', async () => {
    const identite = new ServeurDIdentite();
    const coffre = new CoffreEnMemoire({ acces: 'expire', renouvellement: null, expireA: 0 });
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());
    expect(await session.jeton()).toBe('acces-1');
    expect(identite.demandesDeJeton.map((d) => d.get('grant_type'))).toEqual([
      'authorization_code',
    ]);
  });

  it('partage une seule connexion entre des demandes simultanées, puis en permet une autre', async () => {
    const identite = new ServeurDIdentite();
    const coffre = new CoffreEnMemoire();
    const session = creerUneSessionOAuth(FOURNISSEUR_DE_TEST, coffre, identite.dependances());

    expect(await Promise.all([session.jeton(), session.jeton(), session.jeton()])).toEqual([
      'acces-1',
      'acces-1',
      'acces-1',
    ]);
    expect(identite.urlsOuvertes).toHaveLength(1);

    coffre.jetons = null;
    await session.jeton();
    expect(identite.urlsOuvertes).toHaveLength(2);
  });
});
