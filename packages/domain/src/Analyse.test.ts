import { describe, expect, it } from 'vitest';
import {
  consoliderLAnalyse,
  NOMBRE_MAXIMAL_DE_PROPOSITIONS,
  type AnalyseProposee,
} from './Analyse.js';
import { unCourriel } from './testing/fixtures.js';

const uneAnalyseProposee = (surcharges: Partial<AnalyseProposee> = {}): AnalyseProposee => ({
  resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
  reponseAttendue: true,
  urgence: 'normale',
  motif: 'Question directe adressée au destinataire.',
  propositions: [
    { intention: 'Confirmer', texte: 'Bonjour Claire, je serai présent jeudi à 10 h.' },
    { intention: 'Décliner', texte: 'Bonjour Claire, je ne pourrai pas être présent jeudi.' },
  ],
  ...surcharges,
});

describe('consoliderLAnalyse', () => {
  it('retient le résumé, l’urgence et les propositions du modèle', () => {
    expect(consoliderLAnalyse(unCourriel(), uneAnalyseProposee({ urgence: 'haute' }))).toEqual({
      ok: true,
      value: {
        resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
        attente: {
          kind: 'attendue',
          urgence: 'haute',
          motif: 'Question directe adressée au destinataire.',
        },
        propositions: [
          { intention: 'Confirmer', texte: 'Bonjour Claire, je serai présent jeudi à 10 h.' },
          { intention: 'Décliner', texte: 'Bonjour Claire, je ne pourrai pas être présent jeudi.' },
        ],
      },
    });
  });

  it('refuse un résumé vide', () => {
    expect(consoliderLAnalyse(unCourriel(), uneAnalyseProposee({ resume: '  ' }))).toEqual({
      ok: false,
      error: { kind: 'resume-vide' },
    });
  });

  it('suit le modèle quand il juge qu’aucune réponse n’est attendue, sans proposition', () => {
    const analyse = consoliderLAnalyse(
      unCourriel(),
      uneAnalyseProposee({ reponseAttendue: false, motif: ' Simple information. ' }),
    );
    expect(analyse).toEqual({
      ok: true,
      value: {
        resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
        attente: { kind: 'aucune', motif: 'Simple information.' },
        propositions: [],
      },
    });
  });

  it('impose « aucune réponse » à un envoi automatique, même si le modèle en attend une', () => {
    const analyse = consoliderLAnalyse(
      unCourriel({ expediteur: { nom: null, adresse: 'noreply@banque.fr' } }),
      uneAnalyseProposee({ reponseAttendue: true, urgence: 'haute' }),
    );
    expect(analyse.ok && analyse.value.attente).toEqual({
      kind: 'aucune',
      motif: "Envoi automatique : l'adresse de réponse n'est lue par personne.",
    });
    expect(analyse.ok && analyse.value.propositions).toEqual([]);
  });

  it('nettoie les propositions : espaces, textes vides, doublons, intention manquante', () => {
    const analyse = consoliderLAnalyse(
      unCourriel(),
      uneAnalyseProposee({
        propositions: [
          { intention: ' Confirmer ', texte: '  Je serai là.  ' },
          { intention: 'Vide', texte: '   ' },
          { intention: 'Doublon', texte: 'Je serai là.' },
          { intention: '', texte: 'Je reviens vers toi.' },
        ],
      }),
    );
    expect(analyse.ok && analyse.value.propositions).toEqual([
      { intention: 'Confirmer', texte: 'Je serai là.' },
      { intention: 'Réponse', texte: 'Je reviens vers toi.' },
    ]);
  });

  it(`garde au plus ${String(NOMBRE_MAXIMAL_DE_PROPOSITIONS)} propositions, dans l’ordre du modèle`, () => {
    const propositions = Array.from({ length: 6 }, (_, i) => ({
      intention: `Option ${String(i + 1)}`,
      texte: `Texte ${String(i + 1)}`,
    }));
    const analyse = consoliderLAnalyse(unCourriel(), uneAnalyseProposee({ propositions }));
    expect(analyse.ok && analyse.value.propositions.map((p) => p.intention)).toEqual([
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4',
    ]);
  });

  it('refuse une réponse attendue sans aucune proposition utilisable', () => {
    const analyse = consoliderLAnalyse(
      unCourriel(),
      uneAnalyseProposee({ propositions: [{ intention: 'Vide', texte: ' ' }] }),
    );
    expect(analyse).toEqual({ ok: false, error: { kind: 'propositions-manquantes' } });
  });
});
