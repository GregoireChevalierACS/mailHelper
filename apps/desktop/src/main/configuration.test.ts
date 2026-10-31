import { describe, expect, it } from 'vitest';
import { lireLaConfiguration } from './configuration.js';

const MINIMALE = { ANTHROPIC_API_KEY: 'sk-ant-secret' };

describe('lireLaConfiguration', () => {
  it('applique les valeurs par défaut, sans messagerie configurée', () => {
    expect(lireLaConfiguration(MINIMALE)).toEqual({
      ok: true,
      value: {
        anthropic: { cleDApi: 'sk-ant-secret', modele: 'claude-opus-5-5', effort: 'low' },
        google: null,
        microsoft: null,
      },
    });
  });

  it('lit Gmail, Outlook, le modèle et l’effort', () => {
    const configuration = lireLaConfiguration({
      ...MINIMALE,
      MAILHELPER_MODELE: 'claude-sonnet-5-5',
      MAILHELPER_EFFORT: 'medium',
      GOOGLE_CLIENT_ID: 'id-google',
      GOOGLE_CLIENT_SECRET: 'secret-google',
      MICROSOFT_CLIENT_ID: 'id-microsoft',
      MICROSOFT_TENANT: 'mon-entreprise.onmicrosoft.com',
    });
    expect(configuration).toEqual({
      ok: true,
      value: {
        anthropic: { cleDApi: 'sk-ant-secret', modele: 'claude-sonnet-5-5', effort: 'medium' },
        google: { clientId: 'id-google', clientSecret: 'secret-google' },
        microsoft: { clientId: 'id-microsoft', tenant: 'mon-entreprise.onmicrosoft.com' },
      },
    });
  });

  it('ignore Gmail tant que l’identifiant et le secret ne sont pas tous deux fournis', () => {
    const configuration = lireLaConfiguration({ ...MINIMALE, GOOGLE_CLIENT_ID: 'id-google' });
    expect(configuration.ok && configuration.value.google).toBeNull();
  });

  it('nomme les variables invalides sans jamais afficher leur valeur', () => {
    const configuration = lireLaConfiguration({
      ANTHROPIC_API_KEY: '  ',
      MAILHELPER_EFFORT: 'maximum-secret',
    });
    expect(configuration).toEqual({
      ok: false,
      error: {
        kind: 'configuration-invalide',
        variables: ['ANTHROPIC_API_KEY', 'MAILHELPER_EFFORT'],
      },
    });
    expect(JSON.stringify(configuration)).not.toContain('maximum-secret');
  });
});
