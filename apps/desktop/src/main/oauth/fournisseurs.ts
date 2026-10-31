import type { FournisseurOAuth } from './connexionOAuth.js';

/** Lecture seule : l'application ne peut ni envoyer, ni modifier, ni supprimer un courriel. */
export const PORTEE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly';
export const PORTEE_OUTLOOK = 'https://graph.microsoft.com/Mail.Read';

export function fournisseurGoogle(identifiants: {
  readonly clientId: string;
  readonly clientSecret: string;
}): FournisseurOAuth {
  return {
    urlDAutorisation: 'https://accounts.google.com/o/oauth2/v2/auth',
    urlDeJeton: 'https://oauth2.googleapis.com/token',
    clientId: identifiants.clientId,
    clientSecret: identifiants.clientSecret,
    portees: [PORTEE_GMAIL],
    // offline + consent : Google ne délivre un jeton de renouvellement qu'à ces conditions.
    parametresDAutorisation: { access_type: 'offline', prompt: 'consent' },
  };
}

export function fournisseurMicrosoft(identifiants: {
  readonly clientId: string;
  readonly tenant: string;
}): FournisseurOAuth {
  const base = `https://login.microsoftonline.com/${encodeURIComponent(identifiants.tenant)}/oauth2/v2.0`;
  return {
    urlDAutorisation: `${base}/authorize`,
    urlDeJeton: `${base}/token`,
    clientId: identifiants.clientId,
    clientSecret: null,
    // offline_access : sans lui, Microsoft ne délivre pas de jeton de renouvellement.
    portees: ['offline_access', PORTEE_OUTLOOK],
    parametresDAutorisation: { prompt: 'select_account' },
  };
}
