import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FOURNISSEUR_DE_TEST, ServeurDIdentite } from '../../testing/serveurDIdentite.js';
import { autoriser, EchecDeConnexion, renouveler } from './connexionOAuth.js';

describe('autoriser', () => {
  it('ouvre la page d’autorisation avec PKCE et une redirection sur 127.0.0.1', async () => {
    const identite = new ServeurDIdentite();
    await autoriser(FOURNISSEUR_DE_TEST, identite.dependances());

    const url = identite.urlsOuvertes[0];
    expect(url?.href.split('?')[0]).toBe('https://identite.exemple/authorize');
    const p = url?.searchParams;
    expect(p?.get('client_id')).toBe('client-de-test');
    expect(p?.get('response_type')).toBe('code');
    expect(p?.get('scope')).toBe('lecture hors-ligne');
    expect(p?.get('prompt')).toBe('consent');
    expect(p?.get('code_challenge_method')).toBe('S256');
    expect(p?.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/u);
    expect(p?.get('state')).toMatch(/^[\w-]{22}$/u);
  });

  it('échange le code contre des jetons, avec le vérificateur PKCE correspondant au défi', async () => {
    const identite = new ServeurDIdentite();
    const jetons = await autoriser(FOURNISSEUR_DE_TEST, identite.dependances());

    expect(jetons).toEqual({
      acces: 'acces-1',
      renouvellement: 'renouvellement-1',
      expireA: 1_000_000 + 3_600_000,
    });
    const demande = identite.demandesDeJeton[0];
    expect(demande?.get('grant_type')).toBe('authorization_code');
    expect(demande?.get('code')).toBe('code-recu');
    expect(demande?.get('client_secret')).toBe('secret-de-test');
    expect(demande?.get('redirect_uri')).toBe(
      identite.urlsOuvertes[0]?.searchParams.get('redirect_uri'),
    );
    const defi = createHash('sha256')
      .update(demande?.get('code_verifier') ?? '')
      .digest('base64url');
    expect(defi).toBe(identite.urlsOuvertes[0]?.searchParams.get('code_challenge'));
  });

  it('n’envoie pas de secret pour un client public (Microsoft)', async () => {
    const identite = new ServeurDIdentite();
    await autoriser({ ...FOURNISSEUR_DE_TEST, clientSecret: null }, identite.dependances());
    expect(identite.demandesDeJeton[0]?.has('client_secret')).toBe(false);
  });

  it('refuse une redirection dont l’état ne correspond pas (CSRF)', async () => {
    const identite = new ServeurDIdentite();
    identite.redirection = () => '?code=code-vole&state=autre';
    await expect(autoriser(FOURNISSEUR_DE_TEST, identite.dependances())).rejects.toThrow(
      EchecDeConnexion,
    );
    expect(identite.demandesDeJeton).toEqual([]);
  });

  it('échoue quand l’utilisateur refuse l’accès', async () => {
    const identite = new ServeurDIdentite();
    identite.redirection = () => '?error=access_denied';
    await expect(autoriser(FOURNISSEUR_DE_TEST, identite.dependances())).rejects.toThrow(
      'autorisation refusée ou détournée',
    );
  });

  it('abandonne si l’utilisateur ne se connecte pas à temps', async () => {
    const identite = new ServeurDIdentite();
    const dependances = identite.dependances({
      ouvrirLeNavigateur: () => Promise.resolve(),
      delaiEnMillisecondes: 20,
    });
    await expect(autoriser(FOURNISSEUR_DE_TEST, dependances)).rejects.toThrow(
      'délai de connexion dépassé',
    );
  });

  it('ne rapporte que le statut d’un refus du point de jeton', async () => {
    const identite = new ServeurDIdentite();
    identite.reponsesDeJeton = [
      { statut: 400, corps: { error: 'invalid_grant', code: 'code-recu' } },
    ];
    await expect(autoriser(FOURNISSEUR_DE_TEST, identite.dependances())).rejects.toThrow(
      /^jeton refusé \(HTTP 400\)$/u,
    );
  });

  it('refuse une réponse de jeton mal formée', async () => {
    const identite = new ServeurDIdentite();
    identite.reponsesDeJeton = [{ statut: 200, corps: { token: 'x' } }];
    await expect(autoriser(FOURNISSEUR_DE_TEST, identite.dependances())).rejects.toThrow(
      'réponse de jeton illisible',
    );
  });
});

describe('renouveler', () => {
  it('demande un nouveau jeton d’accès avec le jeton de renouvellement', async () => {
    const identite = new ServeurDIdentite();
    identite.reponsesDeJeton = [
      { statut: 200, corps: { access_token: 'acces-2', expires_in: 60 } },
    ];
    const jetons = await renouveler(
      FOURNISSEUR_DE_TEST,
      'renouvellement-1',
      identite.dependances(),
    );

    // Sans nouveau jeton de renouvellement dans la réponse, l'ancien reste valable.
    expect(jetons).toEqual({
      acces: 'acces-2',
      renouvellement: 'renouvellement-1',
      expireA: 1_060_000,
    });
    const demande = identite.demandesDeJeton[0];
    expect(demande?.get('grant_type')).toBe('refresh_token');
    expect(demande?.get('refresh_token')).toBe('renouvellement-1');
    expect(identite.urlsOuvertes).toEqual([]);
  });
});
