import type { AttenteDeReponse } from './Analyse.js';
import type { Instant } from './Instant.js';

/**
 * Rang d'affichage : ce qui attend une réponse d'abord, par urgence ; puis les courriels que le
 * modèle n'a pas pu analyser (l'utilisateur doit les lire lui-même) ; enfin ce qui n'attend rien.
 */
export function rangDePriorite(attente: AttenteDeReponse | null): number {
  if (attente === null) return 3;
  if (attente.kind === 'aucune') return 4;
  switch (attente.urgence) {
    case 'haute':
      return 0;
    case 'normale':
      return 1;
    case 'basse':
      return 2;
  }
}

export interface CleDeTri {
  readonly attente: AttenteDeReponse | null;
  readonly recuLe: Instant;
}

/** Trie par rang de priorité, puis du plus récent au plus ancien. Ne modifie pas la liste reçue. */
export function ordonnerParPriorite<T>(
  elements: readonly T[],
  cle: (element: T) => CleDeTri,
): readonly T[] {
  return [...elements].sort((a, b) => {
    const cleA = cle(a);
    const cleB = cle(b);
    return rangDePriorite(cleA.attente) - rangDePriorite(cleB.attente) || cleB.recuLe - cleA.recuLe;
  });
}
