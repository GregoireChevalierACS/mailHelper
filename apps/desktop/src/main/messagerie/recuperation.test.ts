import { uneSaisieDeCourriel, unInstant } from '@mailhelper/application/testing';
import { describe, expect, it } from 'vitest';
import { enLotDeCourriels, ErreurDeMessagerie, lireLeJson, parPaquets } from './recuperation.js';

describe('lireLeJson', () => {
  it('lit le corps d’une réponse réussie', async () => {
    expect(await lireLeJson(Response.json({ a: 1 }))).toEqual({ a: 1 });
  });

  it('échoue sur un statut d’erreur sans en recopier le corps', async () => {
    const reponse = Response.json({ error: 'jeton secret invalide' }, { status: 401 });
    await expect(lireLeJson(reponse)).rejects.toThrow(new ErreurDeMessagerie('HTTP 401'));
  });
});

describe('enLotDeCourriels', () => {
  it('compte comme illisibles les saisies absentes ou refusées par le domaine', () => {
    const lot = enLotDeCourriels(
      [
        uneSaisieDeCourriel(),
        null,
        uneSaisieDeCourriel({ expediteur: { nom: null, adresse: '' } }),
      ],
      { depuis: unInstant(0), limite: 10 },
    );
    expect(lot.courriels).toHaveLength(1);
    expect(lot.illisibles).toBe(2);
  });
});

describe('parPaquets', () => {
  it('traite tout, dans l’ordre, sans dépasser la taille du paquet', async () => {
    let enCours = 0;
    let maximum = 0;
    const resultats = await parPaquets([1, 2, 3, 4, 5], 2, async (n) => {
      enCours += 1;
      maximum = Math.max(maximum, enCours);
      await new Promise((resolve) => setTimeout(resolve, 1));
      enCours -= 1;
      return n * 10;
    });
    expect(resultats).toEqual([10, 20, 30, 40, 50]);
    expect(maximum).toBe(2);
  });
});
