import { describe, expect, it } from 'vitest';
import { creerAdresseCourriel, creerCorrespondant, partieLocale } from './AdresseCourriel.js';

describe('AdresseCourriel', () => {
  it('normalise les espaces et la casse', () => {
    expect(creerAdresseCourriel('  Claire.Martin@Exemple.FR ')).toEqual({
      ok: true,
      value: 'claire.martin@exemple.fr',
    });
  });

  it.each([
    '',
    'claire',
    'claire@',
    '@exemple.fr',
    'claire@exemple',
    'claire@exemple.',
    'claire martin@exemple.fr',
    'claire@@exemple.fr',
    '<claire@exemple.fr>',
    'claire@exemple.fr,autre@exemple.fr',
    'claire@exemple.fr;',
    'mailto:claire@exemple.fr',
    '"claire"@exemple.fr',
    '(claire)@exemple.fr',
  ])('refuse « %s »', (texte) => {
    expect(creerAdresseCourriel(texte)).toEqual({ ok: false, error: { kind: 'adresse-invalide' } });
  });

  it('refuse une adresse de plus de 254 caractères', () => {
    const domaine = `${'a'.repeat(250)}.fr`;
    expect(creerAdresseCourriel(`c@${domaine}`).ok).toBe(false);
    expect(creerAdresseCourriel(`c@${'a'.repeat(249)}.fr`).ok).toBe(true); // 254 caractères
  });

  it('donne la partie locale', () => {
    const adresse = creerAdresseCourriel('no-reply@banque.fr');
    expect(adresse.ok && partieLocale(adresse.value)).toBe('no-reply');
  });
});

describe('Correspondant', () => {
  it('garde le nom affiché, débarrassé de ses espaces', () => {
    expect(creerCorrespondant({ nom: ' Claire Martin ', adresse: 'claire@exemple.fr' })).toEqual({
      ok: true,
      value: { nom: 'Claire Martin', adresse: 'claire@exemple.fr' },
    });
  });

  it.each([null, '', '   '])('sans nom affiché (%j), le nom est null', (nom) => {
    const correspondant = creerCorrespondant({ nom, adresse: 'claire@exemple.fr' });
    expect(correspondant.ok && correspondant.value.nom).toBeNull();
  });

  it('refuse une adresse invalide', () => {
    expect(creerCorrespondant({ nom: 'Claire', adresse: 'claire' })).toEqual({
      ok: false,
      error: { kind: 'adresse-invalide' },
    });
  });
});
