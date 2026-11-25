import type { BrouillonADeposer, DepositaireDeBrouillon } from '@mailhelper/application';
import type { SaisieDeCorrespondant } from '@mailhelper/domain';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { avecUneConnexion, cheminDuDossier, type ConnexionImap } from './connexion.js';

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
        let chemin = await cheminDuDossier(client, '\\Drafts');
        if (chemin === null) {
          await client.mailboxCreate(DOSSIER_DES_BROUILLONS_PAR_DEFAUT);
          chemin = DOSSIER_DES_BROUILLONS_PAR_DEFAUT;
        }
        // \Seen : un brouillon que l'on vient d'écrire n'est pas un message « non lu ».
        await client.append(chemin, await composerLeBrouillon(expediteur, depot), [
          '\\Draft',
          '\\Seen',
        ]);
      }),
  };
}
