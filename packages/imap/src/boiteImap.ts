import type { BoiteDeReception, CritereDeRecherche, LotDeCourriels } from '@mailhelper/application';
import type { SaisieDeCorrespondant, SaisieDeCourriel } from '@mailhelper/domain';
import { enLotDeCourriels, estUneDiffusionDeMasse, type EnTete } from '@mailhelper/messagerie';
import type { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import { avecUneConnexion, cheminObligatoire, type ConnexionImap } from './connexion.js';
import { datesDesMessages, sourceDuMessage, toutLire, uidValiditeDe } from './lecture.js';

/** Dossier lu : la boîte de réception, ou les messages envoyés (source des relances). */
export type DossierLu = 'reception' | 'envoyes';

export interface DependancesBoiteImap {
  readonly connexion: ConnexionImap;
  readonly dossier?: DossierLu;
}

const UN_JOUR = 86_400_000;

/**
 * Identifiant stable d'un message : UIDVALIDITY et UID ensemble (RFC 3501, 2.3.1.1). Tant que
 * le serveur garde la même UIDVALIDITY, un message relu donne le même identifiant ; s'il la
 * change, tous les identifiants changent, ce qui est le comportement voulu.
 */
export const identifiantImap = (uidValidity: bigint, uid: number): string =>
  `${String(uidValidity)}:${String(uid)}`;

const premierCorrespondant = (
  adresses: AddressObject | undefined,
): SaisieDeCorrespondant | null => {
  const premier = adresses?.value[0];
  if (premier?.address === undefined || premier.address === '') return null;
  return { nom: premier.name === '' ? null : premier.name, adresse: premier.address };
};

/** Lignes d'en-tête brutes (« List-Unsubscribe: <…> ») en couples nom-valeur. */
const versLesEnTetes = (lignes: readonly { readonly line: string }[]): EnTete[] =>
  lignes.map(({ line }) => {
    const deuxPoints = line.indexOf(':');
    return { name: line.slice(0, deuxPoints), value: line.slice(deuxPoints + 1).trim() };
  });

async function versLaSaisie(
  source: Buffer,
  id: string,
  recuLe: number,
): Promise<SaisieDeCourriel | null> {
  const message = await simpleParser(source);
  const expediteur = premierCorrespondant(message.from);
  if (expediteur === null) return null;
  return {
    id,
    expediteur,
    repondreA: premierCorrespondant(message.replyTo),
    objet: message.subject ?? '',
    // mailparser convertit un corps HTML seul en texte : aucun cas particulier ici.
    corps: message.text ?? '',
    recuLe,
    diffusionDeMasse: estUneDiffusionDeMasse(versLesEnTetes(message.headerLines)),
    // Une image « related » est intégrée au corps HTML (logo, signature) : pas une pièce jointe.
    piecesJointes: message.attachments
      .filter((piece) => piece.related !== true)
      .map((piece) => ({
        nom: piece.filename ?? 'piece-jointe',
        type: piece.contentType,
        contenu: new Uint8Array(piece.content),
      })),
  };
}

/**
 * Saisie d'un message renvoyé par le serveur, ou null s'il est inexploitable (source absente,
 * pas d'expéditeur) : il sera compté parmi les illisibles.
 */
export async function saisieDuMessage(
  message: unknown,
  uidValidity: bigint,
  datesDeReception: ReadonlyMap<number, number>,
): Promise<SaisieDeCourriel | null> {
  const lu = sourceDuMessage(message);
  if (lu === null) return null;
  return versLaSaisie(
    lu.source,
    identifiantImap(uidValidity, lu.uid),
    Number(datesDeReception.get(lu.uid)),
  );
}

async function lireLeDossier(
  client: ImapFlow,
  chemin: string,
  critere: CritereDeRecherche,
): Promise<LotDeCourriels> {
  const verrou = await client.getMailboxLock(chemin, { readOnly: true });
  try {
    const uidValidity = uidValiditeDe(client.mailbox);
    // SINCE ne compare que des dates, dans le fuseau du serveur : on cherche un jour plus tôt,
    // puis on filtre à la milliseconde sur la date interne.
    const uids = await client.search({ since: new Date(critere.depuis - UN_JOUR) }, { uid: true });
    if (!Array.isArray(uids) || uids.length === 0) return { courriels: [], illisibles: 0 };

    const dates = datesDesMessages(
      await toutLire(client.fetch(uids, { uid: true, internalDate: true }, { uid: true })),
    );
    // Seuls les plus récents sont téléchargés en entier.
    const retenus = dates
      .filter(({ recuLe }) => recuLe >= critere.depuis)
      .sort((a, b) => b.recuLe - a.recuLe)
      .slice(0, critere.limite);
    if (retenus.length === 0) return { courriels: [], illisibles: 0 };

    const recuLe = new Map(retenus.map((retenu) => [retenu.uid, retenu.recuLe]));
    const messages = await toutLire(
      client.fetch(
        retenus.map(({ uid }) => uid),
        { uid: true, source: true },
        { uid: true },
      ),
    );
    const saisies = await Promise.all(
      messages.map((message) => saisieDuMessage(message, uidValidity, recuLe)),
    );
    return enLotDeCourriels(saisies, critere);
  } finally {
    verrou.release();
  }
}

/**
 * Boîte lue par IMAP, pour les hébergeurs sans API. Ouverte en lecture seule : un relevé ne
 * marque aucun message comme lu.
 */
export function creerLaBoiteImap({
  connexion,
  dossier = 'reception',
}: DependancesBoiteImap): BoiteDeReception {
  return {
    listerLesRecents: (critere) =>
      avecUneConnexion(connexion, async (client) => {
        const chemin =
          dossier === 'reception' ? 'INBOX' : await cheminObligatoire(client, '\\Sent');
        return lireLeDossier(client, chemin, critere);
      }),
  };
}
