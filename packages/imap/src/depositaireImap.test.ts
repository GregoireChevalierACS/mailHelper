import type { BrouillonRelu } from '@mailhelper/application/testing';
import {
  unBrouillon,
  verifierLeContratDuDepositaireDeBrouillon,
} from '@mailhelper/application/testing';
import { simpleParser } from 'mailparser';
import { describe, expect, it } from 'vitest';
import { avecUneConnexion, cheminDuDossier, type ConnexionImap } from './connexion.js';
import {
  creerLeDepositaireImap,
  DOSSIER_DES_BROUILLONS_PAR_DEFAUT,
  dossierDesBrouillons,
} from './depositaireImap.js';
import { toutLire } from './lecture.js';
import { deposerDesMessages, uneConnexionDeTest } from './testing/greenmail.js';

const EXPEDITEUR = { nom: 'Atelier Thermique', adresse: 'devis@atelier.test' };

/** Les brouillons du dossier des brouillons, dans l'ordre de dépôt, avec leurs drapeaux. */
function relireLeDossier(connexion: ConnexionImap) {
  return avecUneConnexion(connexion, async (client) => {
    const chemin = await cheminDuDossier(client, '\\Drafts');
    if (chemin === null) return [];
    const verrou = await client.getMailboxLock(chemin, { readOnly: true });
    try {
      const messages = await toutLire(
        client.fetch('1:*', { uid: true, flags: true, source: true }),
      );
      return await Promise.all(
        messages
          .sort((a, b) => a.uid - b.uid)
          .map(async (message) => ({
            drapeaux: [...(message.flags ?? [])],
            lu: await simpleParser(message.source ?? Buffer.alloc(0)),
          })),
      );
    } finally {
      verrou.release();
    }
  });
}

async function relireLesBrouillons(connexion: ConnexionImap): Promise<BrouillonRelu[]> {
  return (await relireLeDossier(connexion)).map(({ lu }) => {
    const [destinataire] = (Array.isArray(lu.to) ? lu.to : [lu.to]).flatMap((a) => a?.value ?? []);
    return {
      a: {
        nom: destinataire?.name === '' ? null : (destinataire?.name ?? null),
        adresse: destinataire?.address ?? '',
      },
      objet: lu.subject ?? '',
      // Le corps MIME se termine par une fin de ligne, que le texte d'origine n'avait pas.
      corps: (lu.text ?? '').replace(/\n$/, ''),
      piecesJointes: lu.attachments.map((piece) => ({
        nom: piece.filename ?? '',
        type: piece.contentType,
        contenu: Uint8Array.from(piece.content),
      })),
    };
  });
}

verifierLeContratDuDepositaireDeBrouillon('IMAP (GreenMail)', () => {
  const connexion = uneConnexionDeTest();
  return Promise.resolve({
    depositaire: creerLeDepositaireImap({ connexion, expediteur: EXPEDITEUR }),
    relireLesBrouillons: () => relireLesBrouillons(connexion),
  });
});

describe('dépositaire IMAP', () => {
  it('marque le brouillon \\Draft et lu, avec la boîte pour expéditeur', async () => {
    const connexion = uneConnexionDeTest();
    await creerLeDepositaireImap({ connexion, expediteur: EXPEDITEUR }).deposer({
      brouillon: unBrouillon(),
      piecesJointes: [],
    });
    const [depose] = await relireLeDossier(connexion);
    expect(depose?.drapeaux).toEqual(expect.arrayContaining(['\\Draft', '\\Seen']));
    expect(depose?.lu.from?.value).toEqual([{ name: EXPEDITEUR.nom, address: EXPEDITEUR.adresse }]);
  });

  it('crée le dossier des brouillons quand la boîte n’en a pas, puis le réutilise', async () => {
    const connexion = uneConnexionDeTest();
    const depositaire = creerLeDepositaireImap({
      connexion,
      expediteur: { nom: null, adresse: 'devis@atelier.test' },
    });
    await depositaire.deposer({ brouillon: unBrouillon(), piecesJointes: [] });
    await depositaire.deposer({ brouillon: unBrouillon(), piecesJointes: [] });
    const dossiers = await avecUneConnexion(connexion, async (client) =>
      (await client.list()).map(({ path }) => path),
    );
    expect(
      dossiers.filter((dossier) => dossier === DOSSIER_DES_BROUILLONS_PAR_DEFAUT),
    ).toHaveLength(1);
    const deposes = await relireLeDossier(connexion);
    expect(deposes).toHaveLength(2);
    expect(deposes[0]?.lu.from?.value).toEqual([{ name: '', address: 'devis@atelier.test' }]);
  });

  it('dépose des brouillons simultanés dans une boîte sans dossier des brouillons', async () => {
    const connexion = uneConnexionDeTest();
    const depositaire = creerLeDepositaireImap({ connexion, expediteur: EXPEDITEUR });
    // Chaque dépôt ouvre sa connexion : tous voient la boîte sans dossier, et tentent de le créer.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        depositaire.deposer({ brouillon: unBrouillon(), piecesJointes: [] }),
      ),
    );
    const dossiers = await avecUneConnexion(connexion, async (client) =>
      (await client.list()).map(({ path }) => path),
    );
    expect(
      dossiers.filter((dossier) => dossier === DOSSIER_DES_BROUILLONS_PAR_DEFAUT),
    ).toHaveLength(1);
    expect(await relireLeDossier(connexion)).toHaveLength(5);
  });

  it('fait remonter l’échec de la création quand le dossier manque toujours', async () => {
    const refus = new Error('création refusée');
    const client = { list: () => Promise.resolve([]), mailboxCreate: () => Promise.reject(refus) };
    await expect(dossierDesBrouillons(client)).rejects.toBe(refus);
  });

  it('prend le dossier créé entre-temps par un autre dépôt', async () => {
    const listes = [[], [{ path: 'Brouillons', specialUse: '\\Drafts' }]];
    const client = {
      list: () => Promise.resolve(listes.shift() ?? []),
      mailboxCreate: () => Promise.reject(new Error('existe déjà')),
    };
    expect(await dossierDesBrouillons(client)).toBe('Brouillons');
  });

  it('dépose dans le dossier des brouillons existant, quel que soit son nom', async () => {
    const connexion = uneConnexionDeTest();
    // « Brouillons » est reconnu comme dossier \Drafts, comme chez les hébergeurs français.
    await deposerDesMessages(connexion, 'Brouillons', []);
    await creerLeDepositaireImap({ connexion, expediteur: EXPEDITEUR }).deposer({
      brouillon: unBrouillon(),
      piecesJointes: [],
    });
    const dossiers = await avecUneConnexion(connexion, async (client) =>
      (await client.list()).map(({ path }) => path),
    );
    expect(dossiers).not.toContain(DOSSIER_DES_BROUILLONS_PAR_DEFAUT);
    expect(await relireLeDossier(connexion)).toHaveLength(1);
  });

  it('échoue quand le serveur est injoignable', async () => {
    const depositaire = creerLeDepositaireImap({
      connexion: { ...uneConnexionDeTest(), port: 1 },
      expediteur: EXPEDITEUR,
    });
    await expect(
      depositaire.deposer({ brouillon: unBrouillon(), piecesJointes: [] }),
    ).rejects.toThrow();
  });
});
