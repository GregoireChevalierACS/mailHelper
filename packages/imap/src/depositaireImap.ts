import type { BrouillonADeposer, DepositaireDeBrouillon } from '@mailhelper/application';
import type { SaisieDeCorrespondant } from '@mailhelper/domain';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import {
  avecUneConnexion,
  cheminDuDossier,
  type ConnexionAuxDossiers,
  type ConnexionImap,
} from './connexion.js';

export interface DependancesDepositaireImap {
  readonly connexion: ConnexionImap;
  /** Adresse de la boîte, qui figurera comme expéditeur du brouillon. */
  readonly expediteur: SaisieDeCorrespondant;
}

/** Dossier créé quand la boîte n'a aucun dossier de brouillons. */
export const DOSSIER_DES_BROUILLONS_PAR_DEFAUT = 'Drafts';

const versAdresse = ({ nom, adresse }: SaisieDeCorrespondant) =>
  nom === null ? adresse : { name: nom, address: adresse };

/** Message MIME du brouillon, pièces jointes comprises (base64, octet pour octet). */
export function composerLeBrouillon(
  expediteur: SaisieDeCorrespondant,
  { brouillon, piecesJointes }: BrouillonADeposer,
): Promise<Buffer> {
  return new MailComposer({
    from: versAdresse(expediteur),
    to: versAdresse(brouillon.a),
    subject: brouillon.objet,
    text: brouillon.corps,
    attachments: piecesJointes.map((piece) => ({
      filename: piece.nom,
      contentType: piece.type,
      content: Buffer.from(piece.contenu),
    })),
  })
    .compile()
    .build();
}

/**
 * Le dossier des brouillons, créé s'il manque. Deux dépôts simultanés dans une boîte qui n'en a
 * pas tentent de le créer ensemble : le second échoue, trouve le dossier créé par le premier, et
 * l'utilise. Si le dossier manque toujours, l'échec de la création est réel et remonte.
 */
export async function dossierDesBrouillons(client: ConnexionAuxDossiers): Promise<string> {
  const chemin = await cheminDuDossier(client, '\\Drafts');
  if (chemin !== null) return chemin;
  try {
    await client.mailboxCreate(DOSSIER_DES_BROUILLONS_PAR_DEFAUT);
    return DOSSIER_DES_BROUILLONS_PAR_DEFAUT;
  } catch (erreur) {
    const creeEntreTemps = await cheminDuDossier(client, '\\Drafts');
    if (creeEntreTemps === null) throw erreur;
    return creeEntreTemps;
  }
}

/**
 * Dépose les brouillons dans le dossier des brouillons de la boîte (IMAP APPEND, drapeau
 * \Draft) : l'utilisateur les retrouve dans sa messagerie, sur son ordinateur comme sur son
 * téléphone, les relit et les envoie lui-même. Aucun envoi n'est possible par ce chemin.
 */
export function creerLeDepositaireImap({
  connexion,
  expediteur,
}: DependancesDepositaireImap): DepositaireDeBrouillon {
  return {
    deposer: (depot) =>
      avecUneConnexion(connexion, async (client) => {
        const chemin = await dossierDesBrouillons(client);
        // \Seen : un brouillon que l'on vient d'écrire n'est pas un message « non lu ».
        await client.append(chemin, await composerLeBrouillon(expediteur, depot), [
          '\\Draft',
          '\\Seen',
        ]);
      }),
  };
}
