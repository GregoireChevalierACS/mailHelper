import {
  INSTANT_DE_REFERENCE,
  uneSaisieDeCourriel,
  unInstant,
  verifierLeContratDeLaBoiteDeReception,
} from '@mailhelper/application/testing';
import { describe, expect, it } from 'vitest';
import { fausseApiGraph, messageGraph } from '../../testing/faussesApi.js';
import { creerLaBoiteOutlook } from './boiteOutlook.js';

const jeton = () => Promise.resolve('jeton-graph');

verifierLeContratDeLaBoiteDeReception('Outlook (Microsoft Graph)', (saisies) =>
  Promise.resolve(
    creerLaBoiteOutlook({ fetch: fausseApiGraph(saisies.map(messageGraph)).fetch, jeton }),
  ),
);

const CRITERE = { depuis: unInstant(INSTANT_DE_REFERENCE - 86_400_000), limite: 20 };

describe('boîte Outlook', () => {
  it('demande à Graph de filtrer, trier et convertir les corps en texte', async () => {
    const api = fausseApiGraph([]);
    await creerLaBoiteOutlook({ fetch: api.fetch, jeton }).listerLesRecents(CRITERE);

    const requete = api.requetes[0];
    expect(requete?.url.href.split('?')[0]).toBe(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages',
    );
    expect(requete?.url.searchParams.get('$filter')).toBe(
      'receivedDateTime ge 2026-10-30T09:00:00.000Z',
    );
    expect(requete?.url.searchParams.get('$orderby')).toBe('receivedDateTime desc');
    expect(requete?.url.searchParams.get('$top')).toBe('20');
    expect(requete?.enTetes.get('authorization')).toBe('Bearer jeton-graph');
    expect(requete?.enTetes.get('prefer')).toBe('outlook.body-content-type="text"');
  });

  it('lit un message minimal : sans objet, sans corps, sans en-têtes, nom absent', async () => {
    const api = fausseApiGraph([
      {
        id: 'minimal',
        from: { emailAddress: { address: 'claire@exemple.fr' } },
        receivedDateTime: new Date(INSTANT_DE_REFERENCE).toISOString(),
      },
    ]);
    const lot = await creerLaBoiteOutlook({ fetch: api.fetch, jeton }).listerLesRecents(CRITERE);
    expect(lot.courriels[0]).toMatchObject({
      id: 'minimal',
      expediteur: { nom: null, adresse: 'claire@exemple.fr' },
      repondreA: null,
      objet: '',
      corps: '',
      diffusionDeMasse: false,
    });
  });

  it('convertit un corps resté en HTML', async () => {
    const message = {
      ...messageGraph(uneSaisieDeCourriel()),
      body: { contentType: 'HTML', content: '<p>Bonjour&nbsp;!</p>' },
    };
    const lot = await creerLaBoiteOutlook({
      fetch: fausseApiGraph([message]).fetch,
      jeton,
    }).listerLesRecents(CRITERE);
    expect(lot.courriels[0]?.corps).toBe('Bonjour !');
  });

  it.each([
    ['sans expéditeur', { id: 'a', from: null, receivedDateTime: '2026-10-31T08:00:00Z' }],
    ['mal formé', { id: 42 }],
    [
      'à la date illisible',
      { id: 'b', from: { emailAddress: { address: 'c@exemple.fr' } }, receivedDateTime: 'hier' },
    ],
    [
      'sans adresse',
      { id: 'c', from: { emailAddress: { name: 'X' } }, receivedDateTime: '2026-10-31T08:00:00Z' },
    ],
  ])('compte comme illisible un message %s', async (_cas, message) => {
    const lot = await creerLaBoiteOutlook({
      fetch: fausseApiGraph([message]).fetch,
      jeton,
    }).listerLesRecents(CRITERE);
    expect(lot).toEqual({ courriels: [], illisibles: 1 });
  });

  it('échoue quand Graph refuse l’accès', async () => {
    await expect(
      creerLaBoiteOutlook({ fetch: fausseApiGraph([], 403).fetch, jeton }).listerLesRecents(
        CRITERE,
      ),
    ).rejects.toThrow('HTTP 403');
  });
});
