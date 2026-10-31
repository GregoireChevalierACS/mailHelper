import { err, ok } from '@mailhelper/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  schemaDeDemandeDeReponse,
  schemaDeDemandeDeSynthese,
  schemaDeResultatDeSynthese,
  versLaFiche,
  versLeResultatDeSynthese,
} from './echanges.js';
import { unCourriel } from './testing/index.js';

const analyse = {
  resume: 'Claire demande une confirmation.',
  attente: { kind: 'attendue', urgence: 'haute', motif: 'Question directe.' },
  propositions: [{ intention: 'Confirmer', texte: 'Je serai là.' }],
} as const;

describe('versLaFiche', () => {
  it('donne à la fenêtre l’aperçu, le résumé et le destinataire de la réponse', () => {
    const courriel = unCourriel({
      repondreA: { nom: 'Secrétariat', adresse: 'secretariat@exemple.fr' },
    });
    expect(versLaFiche({ courriel, analyse: ok(analyse) })).toEqual({
      id: 'courriel-1',
      expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
      objet: 'Réunion de jeudi',
      recuLe: courriel.recuLe,
      apercu: 'Bonjour, Peux-tu confirmer ta présence jeudi à 10 h ? Claire',
      reponse: {
        a: { nom: 'Secrétariat', adresse: 'secretariat@exemple.fr' },
        objet: 'RE: Réunion de jeudi',
      },
      analyse: { ok: true, ...analyse },
    });
  });

  it('ne transmet que la nature d’un échec d’analyse', () => {
    const fiche = versLaFiche({
      courriel: unCourriel(),
      analyse: err({ kind: 'analyseur-injoignable' }),
    });
    expect(fiche.analyse).toEqual({ ok: false, probleme: 'analyseur-injoignable' });
  });

  it('produit toujours ce que la fenêtre accepte (aller-retour par le contrat)', () => {
    const resultat = versLeResultatDeSynthese({
      fiches: [
        { courriel: unCourriel({ id: 'a' }), analyse: ok(analyse) },
        { courriel: unCourriel({ id: 'b' }), analyse: err({ kind: 'propositions-manquantes' }) },
      ],
      illisibles: 2,
    });
    expect(schemaDeResultatDeSynthese.parse(resultat)).toEqual(resultat);
  });
});

describe('demandes venues de la fenêtre', () => {
  it.each([
    [{ fenetreEnHeures: 24, limite: 20 }, true],
    [{ fenetreEnHeures: 168, limite: 50 }, true],
    [{ fenetreEnHeures: 0, limite: 20 }, false],
    [{ fenetreEnHeures: 169, limite: 20 }, false],
    [{ fenetreEnHeures: 1.5, limite: 20 }, false],
    [{ fenetreEnHeures: 24, limite: 51 }, false],
    [{ fenetreEnHeures: 24, limite: 20, autre: 1 }, false],
  ])('synthèse %j : valide = %s', (demande, valide) => {
    expect(schemaDeDemandeDeSynthese.safeParse(demande).success).toBe(valide);
  });

  it('une demande de réponse ne peut pas imposer son destinataire', () => {
    expect(
      schemaDeDemandeDeReponse.safeParse({ idDuCourriel: 'a', texte: 'x', a: 'pirate@exemple.fr' })
        .success,
    ).toBe(false);
  });

  it('refuse un texte vide ou démesuré', () => {
    expect(schemaDeDemandeDeReponse.safeParse({ idDuCourriel: 'a', texte: '' }).success).toBe(
      false,
    );
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20_000 }), (texte) => {
        expect(schemaDeDemandeDeReponse.safeParse({ idDuCourriel: 'a', texte }).success).toBe(true);
      }),
    );
    expect(
      schemaDeDemandeDeReponse.safeParse({ idDuCourriel: 'a', texte: 'a'.repeat(20_001) }).success,
    ).toBe(false);
  });
});
