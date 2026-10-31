import { describe, expect, it } from 'vitest';
import { preparerLeBrouillon } from './BrouillonDeReponse.js';
import { unCourriel } from './testing/fixtures.js';

describe('preparerLeBrouillon', () => {
  it('répond à l’expéditeur, avec l’objet préfixé et le texte choisi', () => {
    expect(preparerLeBrouillon(unCourriel(), '  Je serai présent.  ')).toEqual({
      ok: true,
      value: {
        a: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
        objet: 'RE: Réunion de jeudi',
        corps: 'Je serai présent.',
        enReponseA: 'courriel-1',
      },
    });
  });

  it('répond à l’adresse Reply-To quand elle existe', () => {
    const courriel = unCourriel({
      repondreA: { nom: 'Secrétariat', adresse: 'secretariat@exemple.fr' },
    });
    const brouillon = preparerLeBrouillon(courriel, 'Merci.');
    expect(brouillon.ok && brouillon.value.a.adresse).toBe('secretariat@exemple.fr');
  });

  it('refuse un texte vide', () => {
    expect(preparerLeBrouillon(unCourriel(), ' \n ')).toEqual({
      ok: false,
      error: { kind: 'texte-vide' },
    });
  });

  it('refuse d’écrire à une adresse que personne ne lit', () => {
    const courriel = unCourriel({ expediteur: { nom: null, adresse: 'no-reply@banque.fr' } });
    expect(preparerLeBrouillon(courriel, 'Merci.')).toEqual({
      ok: false,
      error: { kind: 'destinataire-sans-lecteur' },
    });
  });
});
