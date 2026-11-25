import { randomUUID } from 'node:crypto';
import type { SaisieDeCourriel } from '@mailhelper/domain';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { avecUneConnexion, type ConnexionImap } from '../connexion.js';

// Les tests de ce paquet parlent à un vrai serveur IMAP : GreenMail, lancé par la CI (service
// Docker) ou en local (`docker run -p 3143:3143 greenmail/standalone`). Il tourne sans
// authentification : chaque test se connecte à un compte neuf, créé à la première connexion.

export function uneConnexionDeTest(): ConnexionImap {
  return {
    hote: process.env['GREENMAIL_HOTE'] ?? '127.0.0.1',
    port: Number(process.env['GREENMAIL_PORT_IMAP'] ?? '3143'),
    securise: false,
    utilisateur: `test-${randomUUID()}@exemple.test`,
    motDePasse: 'test',
  };
}

/** Le message RFC 5322 qu'un serveur aurait reçu pour cette saisie. */
export function composerUnCourrielRecu(saisie: SaisieDeCourriel): Promise<Buffer> {
  const adresse = ({ nom, adresse }: { nom: string | null; adresse: string }) =>
    nom === null ? adresse : { name: nom, address: adresse };
  return new MailComposer({
    from: adresse(saisie.expediteur),
    ...(saisie.repondreA === null ? {} : { replyTo: adresse(saisie.repondreA) }),
    to: 'boite@exemple.test',
    subject: saisie.objet,
    text: saisie.corps,
    date: new Date(saisie.recuLe),
    headers: saisie.diffusionDeMasse ? { 'List-Unsubscribe': '<mailto:stop@exemple.test>' } : {},
  })
    .compile()
    .build();
}

/** Dépose des messages bruts dans un dossier (créé au besoin), avec leur date de réception. */
export function deposerDesMessages(
  connexion: ConnexionImap,
  dossier: string,
  messages: readonly { readonly source: Buffer | string; readonly recuLe: number }[],
): Promise<string[]> {
  return avecUneConnexion(connexion, async (client) => {
    if (dossier !== 'INBOX' && !(await client.list()).some(({ path }) => path === dossier)) {
      await client.mailboxCreate(dossier);
    }
    const identifiants: string[] = [];
    for (const { source, recuLe } of messages) {
      const depot = await client.append(dossier, source, [], new Date(recuLe));
      if (depot === false || depot.uid === undefined || depot.uidValidity === undefined) {
        throw new Error('GreenMail n’a pas renvoyé l’UID du message déposé (UIDPLUS).');
      }
      identifiants.push(`${String(depot.uidValidity)}:${String(depot.uid)}`);
    }
    return identifiants;
  });
}
