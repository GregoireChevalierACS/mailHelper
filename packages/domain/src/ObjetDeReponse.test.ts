import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { objetDeReponse } from './ObjetDeReponse.js';

describe('objetDeReponse', () => {
  it.each([
    ['Réunion de jeudi', 'RE: Réunion de jeudi'],
    ['  Réunion  ', 'RE: Réunion'],
    ['RE: Réunion', 'RE: Réunion'],
    ['Re: RE: re:Réunion', 'RE: Réunion'],
    ['RE : Réunion', 'RE: Réunion'],
    ['Ré: Réunion', 'RE: Réunion'],
    ['RÉ: Réunion', 'RE: Réunion'],
    ['AW: Besprechung', 'RE: Besprechung'],
    ['SV: Möte', 'RE: Möte'],
    ['Antw: Vergadering', 'RE: Vergadering'],
    ['RE[2]: Réunion', 'RE: Réunion'],
    ['RE[12]: Réunion', 'RE: Réunion'],
    ['Offre: nouveau tarif', 'RE: Offre: nouveau tarif'],
    ['TR: Réunion', 'RE: TR: Réunion'],
    ['Fwd: Réunion', 'RE: Fwd: Réunion'],
    ['Reunion', 'RE: Reunion'],
    ['Rendez-vous: jeudi', 'RE: Rendez-vous: jeudi'],
    ['', 'RE:'],
    ['RE:', 'RE:'],
  ])('« %s » devient « %s »', (objet, attendu) => {
    expect(objetDeReponse(objet)).toBe(attendu);
  });

  it('est idempotent : répondre à une réponse ne rajoute pas de préfixe', () => {
    fc.assert(
      fc.property(fc.string(), (objet) => {
        const une = objetDeReponse(objet);
        expect(objetDeReponse(une)).toBe(une);
      }),
    );
  });

  it('commence toujours par « RE: » sans doublon', () => {
    fc.assert(
      fc.property(fc.string(), (objet) => {
        expect(objetDeReponse(objet)).toMatch(/^RE:(?! ?RE:)/u);
      }),
    );
  });
});
