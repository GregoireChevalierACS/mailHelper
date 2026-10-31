import {
  PROBLEMES_D_ANALYSE,
  PROBLEMES_DE_CONNEXION,
  PROBLEMES_DE_REPONSE,
  PROBLEMES_DE_SYNTHESE,
} from '@mailhelper/application';
import { describe, expect, it } from 'vitest';
import {
  messageDAnalyse,
  messageDeConnexion,
  messageDeReponse,
  messageDeSynthese,
} from './messages.js';

// Chaque problème du contrat a un message, et deux problèmes différents ne se confondent pas
// (sauf les échecs d'analyse, volontairement regroupés : l'utilisateur fait la même chose).
const distincts = (messages: readonly string[]) => new Set(messages.filter((m) => m !== '')).size;

describe('catalogue des messages', () => {
  it('connexion : un message distinct par problème', () => {
    expect(distincts(PROBLEMES_DE_CONNEXION.map(messageDeConnexion))).toBe(
      PROBLEMES_DE_CONNEXION.length,
    );
  });

  it('synthèse : un message distinct par problème', () => {
    expect(distincts(PROBLEMES_DE_SYNTHESE.map(messageDeSynthese))).toBe(
      PROBLEMES_DE_SYNTHESE.length,
    );
  });

  it('réponse : un message distinct par problème', () => {
    expect(distincts(PROBLEMES_DE_REPONSE.map(messageDeReponse))).toBe(PROBLEMES_DE_REPONSE.length);
  });

  it('analyse : un message pour chaque problème', () => {
    for (const probleme of PROBLEMES_D_ANALYSE) {
      expect(messageDAnalyse(probleme)).toMatch(/Lisez ce courriel vous-même\.$/u);
    }
  });
});
