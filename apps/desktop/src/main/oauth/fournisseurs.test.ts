import { describe, expect, it } from 'vitest';
import {
  fournisseurGoogle,
  fournisseurMicrosoft,
  PORTEE_GMAIL,
  PORTEE_OUTLOOK,
} from './fournisseurs.js';

describe('fournisseurs OAuth', () => {
  it('Google : lecture seule de Gmail, avec jeton de renouvellement', () => {
    expect(fournisseurGoogle({ clientId: 'id', clientSecret: 'secret' })).toEqual({
      urlDAutorisation: 'https://accounts.google.com/o/oauth2/v2/auth',
      urlDeJeton: 'https://oauth2.googleapis.com/token',
      clientId: 'id',
      clientSecret: 'secret',
      portees: [PORTEE_GMAIL],
      parametresDAutorisation: { access_type: 'offline', prompt: 'consent' },
    });
    expect(PORTEE_GMAIL).toBe('https://www.googleapis.com/auth/gmail.readonly');
  });

  it('Microsoft : lecture seule du courrier, client public, annuaire de l’entreprise', () => {
    expect(fournisseurMicrosoft({ clientId: 'id', tenant: 'mon entreprise' })).toEqual({
      urlDAutorisation: 'https://login.microsoftonline.com/mon%20entreprise/oauth2/v2.0/authorize',
      urlDeJeton: 'https://login.microsoftonline.com/mon%20entreprise/oauth2/v2.0/token',
      clientId: 'id',
      clientSecret: null,
      portees: ['offline_access', PORTEE_OUTLOOK],
      parametresDAutorisation: { prompt: 'select_account' },
    });
    expect(PORTEE_OUTLOOK).toBe('https://graph.microsoft.com/Mail.Read');
  });
});
