import { describe, expect, it } from 'vitest';
import {
  apercu,
  creerCourriel,
  destinataireDeReponse,
  LONGUEUR_MAXIMALE_ANALYSEE,
  texteAAnalyser,
} from './Courriel.js';
import { INSTANT_DE_REFERENCE, unCourriel, uneSaisieDeCourriel } from './testing/fixtures.js';

describe('Courriel', () => {
  it('se crée à partir d’une saisie valide, normalisée', () => {
    const courriel = creerCourriel(
      uneSaisieDeCourriel({
        id: ' abc ',
        objet: '  Réunion  ',
        corps: '\r\nLigne 1\r\nLigne 2\rLigne 3\n ',
        repondreA: { nom: null, adresse: 'Secretariat@Exemple.fr' },
      }),
    );
    expect(courriel).toEqual({
      ok: true,
      value: {
        id: 'abc',
        expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
        repondreA: { nom: null, adresse: 'secretariat@exemple.fr' },
        objet: 'Réunion',
        corps: 'Ligne 1\nLigne 2\nLigne 3',
        recuLe: INSTANT_DE_REFERENCE,
        diffusionDeMasse: false,
      },
    });
  });

  it.each([
    [{ id: '  ' }, 'identifiant-vide'],
    [{ expediteur: { nom: 'X', adresse: 'pas-une-adresse' } }, 'expediteur-invalide'],
    [{ repondreA: { nom: 'X', adresse: 'pas-une-adresse' } }, 'adresse-de-reponse-invalide'],
    [{ recuLe: -1 }, 'date-invalide'],
  ] as const)('refuse %j (%s)', (surcharges, kind) => {
    expect(creerCourriel(uneSaisieDeCourriel(surcharges))).toEqual({ ok: false, error: { kind } });
  });
});

describe('destinataireDeReponse', () => {
  it('est l’expéditeur sans Reply-To', () => {
    expect(destinataireDeReponse(unCourriel()).adresse).toBe('claire.martin@exemple.fr');
  });

  it('est l’adresse Reply-To quand elle existe', () => {
    const courriel = unCourriel({ repondreA: { nom: 'Support', adresse: 'support@exemple.fr' } });
    expect(destinataireDeReponse(courriel)).toEqual({
      nom: 'Support',
      adresse: 'support@exemple.fr',
    });
  });
});

describe('texteAAnalyser', () => {
  it('transmet un corps court en entier', () => {
    expect(texteAAnalyser(unCourriel({ corps: 'Court.' }))).toEqual({
      texte: 'Court.',
      tronque: false,
    });
  });

  it('transmet un corps de longueur maximale en entier', () => {
    const corps = 'a'.repeat(LONGUEUR_MAXIMALE_ANALYSEE);
    expect(texteAAnalyser(unCourriel({ corps }))).toEqual({ texte: corps, tronque: false });
  });

  it('coupe un corps trop long et le signale', () => {
    const corps = `${'a'.repeat(LONGUEUR_MAXIMALE_ANALYSEE)}b`;
    expect(texteAAnalyser(unCourriel({ corps }))).toEqual({
      texte: 'a'.repeat(LONGUEUR_MAXIMALE_ANALYSEE),
      tronque: true,
    });
  });
});

describe('apercu', () => {
  it('met le corps sur une ligne', () => {
    expect(apercu(unCourriel({ corps: 'Bonjour,\n\n  à jeudi.' }))).toBe('Bonjour, à jeudi.');
  });

  it('garde 200 caractères tels quels', () => {
    const corps = 'a'.repeat(200);
    expect(apercu(unCourriel({ corps }))).toBe(corps);
  });

  it('coupe au-delà de 200 caractères avec des points de suspension', () => {
    const resultat = apercu(unCourriel({ corps: 'a'.repeat(201) }));
    expect(resultat).toBe(`${'a'.repeat(199)}…`);
    expect(resultat).toHaveLength(200);
  });
});
