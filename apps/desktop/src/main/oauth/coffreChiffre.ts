import { z } from 'zod';
import type { Jetons } from './connexionOAuth.js';
import type { CoffreDeJetons } from './sessionOAuth.js';

export interface DependancesDuCoffre {
  /** safeStorage d'Electron : chiffrement lié à la session Windows de l'utilisateur (DPAPI). */
  readonly chiffrer: (texte: string) => Promise<Buffer>;
  readonly dechiffrer: (octets: Buffer) => Promise<string>;
  readonly lireLeFichier: () => Promise<Buffer | null>;
  readonly ecrireLeFichier: (octets: Buffer) => Promise<void>;
}

const schemaDeJetons = z.strictObject({
  acces: z.string().min(1),
  renouvellement: z.string().min(1).nullable(),
  expireA: z.number(),
});

/**
 * Jetons OAuth chiffrés sur disque. Un fichier illisible (autre session Windows, fichier abîmé)
 * n'est pas une panne : il vaut « aucun jeton », et l'utilisateur se reconnecte.
 */
export function creerUnCoffreChiffre(dependances: DependancesDuCoffre): CoffreDeJetons {
  return {
    async lire(): Promise<Jetons | null> {
      const octets = await dependances.lireLeFichier();
      if (octets === null) return null;
      try {
        const lus = schemaDeJetons.safeParse(JSON.parse(await dependances.dechiffrer(octets)));
        return lus.success ? lus.data : null;
      } catch {
        return null;
      }
    },

    async ecrire(jetons: Jetons): Promise<void> {
      await dependances.ecrireLeFichier(await dependances.chiffrer(JSON.stringify(jetons)));
    },
  };
}
