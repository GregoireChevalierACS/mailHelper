import { describe, expect, it } from 'vitest';
import { creerInstant, heuresAvant, type Instant } from './Instant.js';

function instant(millisecondes: number): Instant {
  const resultat = creerInstant(millisecondes);
  if (!resultat.ok) throw new Error('instant invalide');
  return resultat.value;
}

describe('Instant', () => {
  it.each([0, 1, 1_793_437_200_000, Number.MAX_SAFE_INTEGER])('accepte %d', (millisecondes) => {
    expect(creerInstant(millisecondes)).toEqual({ ok: true, value: millisecondes });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'refuse %d',
    (millisecondes) => {
      expect(creerInstant(millisecondes)).toEqual({
        ok: false,
        error: { kind: 'instant-invalide' },
      });
    },
  );

  it('recule du nombre d’heures demandé : 24 h × 3 600 000 ms = 86 400 000 ms', () => {
    expect(heuresAvant(instant(100_000_000), 24)).toBe(13_600_000);
  });

  it('ne recule jamais avant l’époque Unix', () => {
    expect(heuresAvant(instant(1_000), 1)).toBe(0);
  });

  it('signale une durée qui ne tombe pas sur une milliseconde entière comme un bug', () => {
    expect(() => heuresAvant(instant(10_000_000), 1e-9)).toThrow(RangeError);
    expect(() => heuresAvant(instant(10_000_000), Number.NaN)).toThrow('durée invalide : NaN h');
  });
});
