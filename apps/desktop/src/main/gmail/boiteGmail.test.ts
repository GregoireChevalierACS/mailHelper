import {
  INSTANT_DE_REFERENCE,
  uneSaisieDeCourriel,
  unInstant,
  verifierLeContratDeLaBoiteDeReception,
} from '@mailhelper/application/testing';
import { describe, expect, it } from 'vitest';
import { fausseApiGmail, messageGmail } from '../../testing/faussesApi.js';
import { creerLaBoiteGmail, texteDuCorps } from './boiteGmail.js';

const jeton = () => Promise.resolve('jeton-gmail');

verifierLeContratDeLaBoiteDeReception('Gmail', (saisies) =>
  Promise.resolve(
    creerLaBoiteGmail({ fetch: fausseApiGmail(saisies.map(messageGmail)).fetch, jeton }),
  ),
);

const CRITERE = { depuis: unInstant(INSTANT_DE_REFERENCE - 86_400_000), limite: 20 };

describe('boîte Gmail', () => {
  it('cherche dans la boîte de réception depuis la date demandée, avec le jeton', async () => {
    const api = fausseApiGmail([messageGmail(uneSaisieDeCourriel())]);
    await creerLaBoiteGmail({ fetch: api.fetch, jeton }).listerLesRecents(CRITERE);

    const [liste, message] = api.requetes;
    expect(liste?.url.pathname).toBe('/gmail/v1/users/me/messages');
    expect(liste?.url.searchParams.get('q')).toBe(
      `in:inbox after:${String((INSTANT_DE_REFERENCE - 86_400_000) / 1000)}`,
    );
    expect(liste?.url.searchParams.get('maxResults')).toBe('20');
    expect(message?.url.pathname).toBe('/gmail/v1/users/me/messages/courriel-1');
    expect(message?.url.searchParams.get('format')).toBe('full');
    expect(message?.enTetes.get('authorization')).toBe('Bearer jeton-gmail');
  });

  it('compte comme illisibles un message mal formé ou sans expéditeur', async () => {
    const sansExpediteur = { id: 'b', internalDate: String(INSTANT_DE_REFERENCE), payload: {} };
    const api = fausseApiGmail([messageGmail(uneSaisieDeCourriel()), { id: 'a' }, sansExpediteur]);
    const lot = await creerLaBoiteGmail({ fetch: api.fetch, jeton }).listerLesRecents(CRITERE);
    expect(lot.courriels).toHaveLength(1);
    expect(lot.illisibles).toBe(2);
  });

  it('lit un message sans objet ni corps', async () => {
    const minimal = {
      id: 'minimal',
      internalDate: String(INSTANT_DE_REFERENCE),
      payload: { headers: [{ name: 'From', value: 'claire@exemple.fr' }] },
    };
    const lot = await creerLaBoiteGmail({
      fetch: fausseApiGmail([minimal]).fetch,
      jeton,
    }).listerLesRecents(CRITERE);
    expect(lot.courriels[0]).toMatchObject({
      objet: '',
      corps: '',
      repondreA: null,
      diffusionDeMasse: false,
    });
  });

  it('lit une boîte où Gmail ne renvoie aucune liste', async () => {
    const fetch: typeof globalThis.fetch = () =>
      Promise.resolve(Response.json({ resultSizeEstimate: 0 }));
    const lot = await creerLaBoiteGmail({ fetch, jeton }).listerLesRecents(CRITERE);
    expect(lot).toEqual({ courriels: [], illisibles: 0 });
  });

  it('échoue quand Gmail refuse l’accès', async () => {
    const api = fausseApiGmail([], 401);
    await expect(
      creerLaBoiteGmail({ fetch: api.fetch, jeton }).listerLesRecents(CRITERE),
    ).rejects.toThrow('HTTP 401');
  });
});

describe('texteDuCorps', () => {
  const donnees = (texte: string) => ({ data: Buffer.from(texte).toString('base64url') });

  it('préfère la partie texte, même imbriquée', () => {
    expect(
      texteDuCorps({
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/html', body: donnees('<p>HTML</p>') },
              { mimeType: 'text/plain', body: donnees('Texte é') },
            ],
          },
        ],
      }),
    ).toBe('Texte é');
  });

  it('convertit la partie HTML quand il n’y a pas de texte brut', () => {
    expect(texteDuCorps({ mimeType: 'text/html', body: donnees('<p>Bonjour&nbsp;!</p>') })).toBe(
      'Bonjour !',
    );
  });

  it('ignore une pièce jointe texte et une partie sans données', () => {
    expect(
      texteDuCorps({
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: {} },
          { mimeType: 'text/plain', filename: 'notes.txt', body: donnees('Pièce jointe') },
        ],
      }),
    ).toBe('');
  });
});
