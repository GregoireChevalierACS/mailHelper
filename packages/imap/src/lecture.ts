import { ErreurDeMessagerie } from '@mailhelper/messagerie';
import { z } from 'zod';

// Ce que renvoie imapflow est une donnée externe, comme une réponse JSON de Gmail : validée ici,
// jamais transtypée. Un message mal formé est écarté, jamais deviné.

/** Lit tout un flux asynchrone (Array.fromAsync n'est pas dans la bibliothèque ES2023 visée). */
export async function toutLire<T>(flux: AsyncIterable<T>): Promise<T[]> {
  const elements: T[] = [];
  for await (const element of flux) elements.push(element);
  return elements;
}

const schemaDeDossierOuvert = z.object({ uidValidity: z.bigint() });

/** UIDVALIDITY du dossier ouvert ; échoue si aucun dossier n'est ouvert. */
export function uidValiditeDe(dossierOuvert: unknown): bigint {
  const lu = schemaDeDossierOuvert.safeParse(dossierOuvert);
  if (!lu.success) throw new ErreurDeMessagerie('Aucun dossier ouvert sur la connexion IMAP.');
  return lu.data.uidValidity;
}

const schemaDeDate = z.object({
  uid: z.number().int().positive(),
  internalDate: z.union([z.date(), z.string()]).transform((date) => new Date(date).getTime()),
});

export interface DateDeMessage {
  readonly uid: number;
  readonly recuLe: number;
}

/** Date interne de chaque message ; un message sans date lisible est écarté. */
export function datesDesMessages(messages: readonly unknown[]): DateDeMessage[] {
  return messages.flatMap((message) => {
    const lu = schemaDeDate.safeParse(message);
    return lu.success && !Number.isNaN(lu.data.internalDate)
      ? [{ uid: lu.data.uid, recuLe: lu.data.internalDate }]
      : [];
  });
}

const schemaDeSource = z.object({ uid: z.number().int().positive(), source: z.instanceof(Buffer) });

/** Source brute (RFC 5322) d'un message, ou null si le serveur ne l'a pas renvoyée. */
export function sourceDuMessage(
  message: unknown,
): { readonly uid: number; readonly source: Buffer } | null {
  const lu = schemaDeSource.safeParse(message);
  return lu.success ? lu.data : null;
}
