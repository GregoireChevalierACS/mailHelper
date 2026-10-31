import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { URGENCES, type AttenteDeReponse } from './Analyse.js';
import { creerInstant, type Instant } from './Instant.js';
import { ordonnerParPriorite, rangDePriorite, type CleDeTri } from './Priorite.js';

function instant(millisecondes: number): Instant {
  const resultat = creerInstant(millisecondes);
  if (!resultat.ok) throw new Error('instant invalide');
  return resultat.value;
}

const attendue = (urgence: (typeof URGENCES)[number]): AttenteDeReponse => ({
  kind: 'attendue',
  urgence,
  motif: '',
});
const aucune: AttenteDeReponse = { kind: 'aucune', motif: '' };

describe('rangDePriorite', () => {
  it('classe haute < normale < basse < non analysé < aucune réponse', () => {
    expect([
      rangDePriorite(attendue('haute')),
      rangDePriorite(attendue('normale')),
      rangDePriorite(attendue('basse')),
      rangDePriorite(null),
      rangDePriorite(aucune),
    ]).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('ordonnerParPriorite', () => {
  interface Element extends CleDeTri {
    readonly nom: string;
  }
  const element = (nom: string, attente: AttenteDeReponse | null, recuLe: number): Element => ({
    nom,
    attente,
    recuLe: instant(recuLe),
  });

  it('met l’urgent devant, puis le plus récent à rang égal', () => {
    const elements = [
      element('info', aucune, 500),
      element('normale ancienne', attendue('normale'), 100),
      element('échec', null, 400),
      element('haute', attendue('haute'), 50),
      element('normale récente', attendue('normale'), 300),
      element('basse', attendue('basse'), 600),
    ];
    expect(ordonnerParPriorite(elements, (e) => e).map((e) => e.nom)).toEqual([
      'haute',
      'normale récente',
      'normale ancienne',
      'basse',
      'échec',
      'info',
    ]);
  });

  it('ne modifie pas la liste reçue', () => {
    const elements = [element('b', aucune, 1), element('a', attendue('haute'), 2)];
    ordonnerParPriorite(elements, (e) => e);
    expect(elements.map((e) => e.nom)).toEqual(['b', 'a']);
  });

  it('conserve exactement les mêmes éléments, triés', () => {
    const attenteArbitraire = fc.oneof(
      fc.constant(null),
      fc.constant(aucune),
      fc.constantFrom(...URGENCES).map(attendue),
    );
    fc.assert(
      fc.property(
        fc.array(fc.record({ attente: attenteArbitraire, recuLe: fc.nat().map(instant) })),
        (elements) => {
          const tries = ordonnerParPriorite(elements, (e) => e);
          expect(tries).toHaveLength(elements.length);
          for (const e of elements) expect(tries).toContain(e);
          for (let i = 1; i < tries.length; i += 1) {
            const avant = tries[i - 1];
            const apres = tries[i];
            if (avant === undefined || apres === undefined) throw new Error('indice hors limites');
            const ecart = rangDePriorite(avant.attente) - rangDePriorite(apres.attente);
            expect(ecart < 0 || (ecart === 0 && avant.recuLe >= apres.recuLe)).toBe(true);
          }
        },
      ),
    );
  });
});
