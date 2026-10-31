import { describe, expect, it } from 'vitest';
import { estUneDiffusionDeMasse, lireUnCorrespondant, valeurDeLEnTete } from './enTetes.js';

describe('valeurDeLEnTete', () => {
  it('ignore la casse du nom, et vaut null en son absence', () => {
    const enTetes = [{ name: 'Reply-To', value: 'a@exemple.fr' }];
    expect(valeurDeLEnTete(enTetes, 'reply-to')).toBe('a@exemple.fr');
    expect(valeurDeLEnTete(enTetes, 'From')).toBeNull();
  });
});

describe('estUneDiffusionDeMasse', () => {
  it.each([
    [{ name: 'List-Unsubscribe', value: '<mailto:désinscription@exemple.fr>' }, true],
    [{ name: 'List-Id', value: 'equipe.exemple.fr' }, true],
    [{ name: 'Precedence', value: 'bulk' }, true],
    [{ name: 'Precedence', value: ' List ' }, true],
    [{ name: 'Precedence', value: 'junk' }, true],
    [{ name: 'Precedence', value: 'first-class' }, false],
    [{ name: 'Auto-Submitted', value: 'auto-generated' }, true],
    [{ name: 'Auto-Submitted', value: 'auto-replied' }, true],
    [{ name: 'Auto-Submitted', value: 'no' }, false],
    [{ name: 'Subject', value: 'Bonjour' }, false],
  ])('%j → %s', (enTete, attendu) => {
    expect(estUneDiffusionDeMasse([enTete])).toBe(attendu);
  });
});

describe('lireUnCorrespondant', () => {
  it.each([
    ['Claire Martin <claire@exemple.fr>', { nom: 'Claire Martin', adresse: 'claire@exemple.fr' }],
    [
      '"Martin, Claire" <claire@exemple.fr>',
      { nom: 'Martin, Claire', adresse: 'claire@exemple.fr' },
    ],
    [
      '"Claire \\"CM\\" Martin" <claire@exemple.fr>',
      { nom: 'Claire "CM" Martin', adresse: 'claire@exemple.fr' },
    ],
    ['<claire@exemple.fr>', { nom: null, adresse: 'claire@exemple.fr' }],
    ['claire@exemple.fr', { nom: null, adresse: 'claire@exemple.fr' }],
    ['a@exemple.fr, b@exemple.fr', { nom: null, adresse: 'a@exemple.fr' }],
    [
      'Équipe <equipe@exemple.fr>, Autre <autre@exemple.fr>',
      { nom: 'Équipe', adresse: 'equipe@exemple.fr' },
    ],
    ['', { nom: null, adresse: '' }],
  ])('« %s »', (valeur, attendu) => {
    expect(lireUnCorrespondant(valeur)).toEqual(attendu);
  });
});
