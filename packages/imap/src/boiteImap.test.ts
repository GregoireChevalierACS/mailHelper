import type { BoiteDeReception } from '@mailhelper/application';
import {
  INSTANT_DE_REFERENCE,
  UNE_HEURE,
  uneSaisieDeCourriel,
  unInstant,
  verifierLeContratDeLaBoiteDeReception,
} from '@mailhelper/application/testing';
import { creerCourriel, type Courriel } from '@mailhelper/domain';
import { ErreurDeMessagerie } from '@mailhelper/messagerie';
import { describe, expect, it } from 'vitest';
import { creerLaBoiteImap, saisieDuMessage } from './boiteImap.js';
import {
  composerUnCourrielRecu,
  deposerDesMessages,
  uneConnexionDeTest,
} from './testing/greenmail.js';

/**
 * Les identifiants d'une boîte IMAP sont attribués par le serveur (UIDVALIDITY:UID). La fabrique
 * retient l'identifiant obtenu pour chaque saisie déposée, et le retraduit : le contrat compare
 * alors les courriels à leurs saisies d'origine, un pour un.
 */
function retraduire(boite: BoiteDeReception, ids: ReadonlyMap<string, string>): BoiteDeReception {
  const renommer = (courriel: Courriel): Courriel => {
    const renomme = creerCourriel({ ...courriel, id: ids.get(courriel.id) ?? courriel.id });
    if (!renomme.ok) throw new Error(renomme.error.kind);
    return renomme.value;
  };
  return {
    listerLesRecents: async (critere) => {
      const lot = await boite.listerLesRecents(critere);
      return { ...lot, courriels: lot.courriels.map(renommer) };
    },
  };
}

verifierLeContratDeLaBoiteDeReception('IMAP (GreenMail)', async (saisies) => {
  const connexion = uneConnexionDeTest();
  const messages = await Promise.all(
    saisies.map(async (saisie) => ({
      source: await composerUnCourrielRecu(saisie),
      recuLe: saisie.recuLe,
    })),
  );
  const identifiants = await deposerDesMessages(connexion, 'INBOX', messages);
  return retraduire(
    creerLaBoiteImap({ connexion }),
    new Map(identifiants.map((identifiant, index) => [identifiant, saisies[index]?.id ?? ''])),
  );
});

const ilYA = (heures: number): number => INSTANT_DE_REFERENCE - heures * UNE_HEURE;
const DEPUIS_24_HEURES = { depuis: unInstant(ilYA(24)), limite: 10 };

const brut = (enTetes: string, corps = 'Corps du message'): string =>
  `${enTetes}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${corps}\r\n`;

describe('boîte IMAP', () => {
  it('donne à chaque message un identifiant stable, UIDVALIDITY:UID', async () => {
    const connexion = uneConnexionDeTest();
    const [identifiant] = await deposerDesMessages(connexion, 'INBOX', [
      { source: await composerUnCourrielRecu(uneSaisieDeCourriel()), recuLe: ilYA(1) },
    ]);
    const boite = creerLaBoiteImap({ connexion });
    const premier = await boite.listerLesRecents(DEPUIS_24_HEURES);
    const second = await boite.listerLesRecents(DEPUIS_24_HEURES);
    expect(premier.courriels.map((c) => c.id)).toEqual([identifiant]);
    expect(second.courriels.map((c) => c.id)).toEqual([identifiant]);
    expect(identifiant).toMatch(/^\d+:\d+$/);
  });

  it('écarte à la milliseconde un message de la veille trouvé par la recherche IMAP', async () => {
    // SINCE ne compare que des dates : ce message est trouvé, puis écarté par sa date interne.
    const connexion = uneConnexionDeTest();
    await deposerDesMessages(connexion, 'INBOX', [
      { source: await composerUnCourrielRecu(uneSaisieDeCourriel()), recuLe: ilYA(30) },
    ]);
    const lot = await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    expect(lot).toEqual({ courriels: [], illisibles: 0 });
  });

  it('compte comme illisible un message sans expéditeur', async () => {
    const connexion = uneConnexionDeTest();
    await deposerDesMessages(connexion, 'INBOX', [
      { source: brut('Subject: Sans expéditeur'), recuLe: ilYA(1) },
      { source: await composerUnCourrielRecu(uneSaisieDeCourriel()), recuLe: ilYA(2) },
    ]);
    const lot = await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    expect(lot.courriels).toHaveLength(1);
    expect(lot.illisibles).toBe(1);
  });

  it('lit un message sans nom d’expéditeur, sans objet ni corps', async () => {
    const connexion = uneConnexionDeTest();
    await deposerDesMessages(connexion, 'INBOX', [
      { source: 'From: claire@exemple.fr\r\n\r\n', recuLe: ilYA(1) },
    ]);
    const lot = await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    expect(lot.courriels[0]).toMatchObject({
      expediteur: { nom: null, adresse: 'claire@exemple.fr' },
      objet: '',
      corps: '',
      repondreA: null,
    });
  });

  it('convertit en texte un message HTML seul', async () => {
    const connexion = uneConnexionDeTest();
    const html =
      'From: claire@exemple.fr\r\nSubject: HTML\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Bonjour <b>Paul</b></p>\r\n';
    await deposerDesMessages(connexion, 'INBOX', [{ source: html, recuLe: ilYA(1) }]);
    const lot = await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    expect(lot.courriels[0]?.corps).toBe('Bonjour Paul');
  });

  it('repère un envoi en masse par ses en-têtes de liste', async () => {
    const connexion = uneConnexionDeTest();
    await deposerDesMessages(connexion, 'INBOX', [
      { source: brut('From: lettre@exemple.fr\r\nPrecedence: bulk'), recuLe: ilYA(1) },
    ]);
    const lot = await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    expect(lot.courriels[0]?.diffusionDeMasse).toBe(true);
  });

  it('ne marque aucun message comme lu', async () => {
    const connexion = uneConnexionDeTest();
    await deposerDesMessages(connexion, 'INBOX', [
      { source: await composerUnCourrielRecu(uneSaisieDeCourriel()), recuLe: ilYA(1) },
    ]);
    await creerLaBoiteImap({ connexion }).listerLesRecents(DEPUIS_24_HEURES);
    // Relu une seconde fois en tant que nouveau message : rien n'a changé ses drapeaux.
    const { ImapFlow } = await import('imapflow');
    const client = new ImapFlow({
      host: connexion.hote,
      port: connexion.port,
      secure: false,
      auth: { user: connexion.utilisateur, pass: connexion.motDePasse },
      logger: false,
    });
    await client.connect();
    const verrou = await client.getMailboxLock('INBOX', { readOnly: true });
    const drapeaux = [];
    for await (const message of client.fetch('1:*', { flags: true }))
      drapeaux.push(...(message.flags ?? []));
    verrou.release();
    await client.logout();
    expect(drapeaux).not.toContain('\\Seen');
  });

  it('lit le dossier des messages envoyés', async () => {
    const connexion = uneConnexionDeTest();
    const envoye = uneSaisieDeCourriel({
      expediteur: { nom: 'Atelier', adresse: 'devis@atelier.test' },
      objet: 'Votre devis',
    });
    await deposerDesMessages(connexion, 'Sent', [
      { source: await composerUnCourrielRecu(envoye), recuLe: ilYA(1) },
    ]);
    const lot = await creerLaBoiteImap({ connexion, dossier: 'envoyes' }).listerLesRecents(
      DEPUIS_24_HEURES,
    );
    expect(lot.courriels.map((c) => c.objet)).toEqual(['Votre devis']);
  });

  it('échoue clairement quand la boîte n’a pas de dossier des envoyés', async () => {
    const boite = creerLaBoiteImap({ connexion: uneConnexionDeTest(), dossier: 'envoyes' });
    await expect(boite.listerLesRecents(DEPUIS_24_HEURES)).rejects.toThrow(ErreurDeMessagerie);
  });

  it('échoue quand le serveur est injoignable', async () => {
    const boite = creerLaBoiteImap({ connexion: { ...uneConnexionDeTest(), port: 1 } });
    await expect(boite.listerLesRecents(DEPUIS_24_HEURES)).rejects.toThrow();
  });

  it('compte comme illisible un message dont le serveur n’a pas renvoyé la source', async () => {
    expect(await saisieDuMessage({ uid: 3 }, 1n, new Map([[3, ilYA(1)]]))).toBeNull();
  });
});
