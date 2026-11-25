import type { BrouillonDeReponse } from '@mailhelper/domain';
import { describe, expect, it } from 'vitest';
import type { DepositaireDeBrouillon, PieceJointe } from '../ports.js';
import { unBrouillon } from './doublures.js';

/** Un brouillon tel qu'on le relit dans la messagerie, après son dépôt. */
export interface BrouillonRelu {
  readonly a: { readonly nom: string | null; readonly adresse: string };
  readonly objet: string;
  readonly corps: string;
  readonly piecesJointes: readonly PieceJointe[];
}

export interface DepositaireObserve {
  readonly depositaire: DepositaireDeBrouillon;
  /** Relit les brouillons déposés, dans l'ordre de dépôt. */
  readonly relireLesBrouillons: () => Promise<readonly BrouillonRelu[]>;
}

/** Fabrique un dépositaire neuf, sur une messagerie qui ne contient encore aucun brouillon. */
export type FabriqueDeDepositaire = () => Promise<DepositaireObserve>;

const relu = (brouillon: BrouillonDeReponse, piecesJointes: readonly PieceJointe[] = []) => ({
  a: { nom: brouillon.a.nom, adresse: brouillon.a.adresse },
  objet: brouillon.objet,
  corps: brouillon.corps,
  piecesJointes,
});

/**
 * Comportement exigé de tout dépositaire de brouillons. Le même contrat tient la doublure en
 * mémoire et l'adapter IMAP : ce qui est relu dans la messagerie est exactement ce qui a été
 * déposé, pièces jointes comprises, octet pour octet.
 */
export function verifierLeContratDuDepositaireDeBrouillon(
  nom: string,
  fabriquer: FabriqueDeDepositaire,
): void {
  describe(`contrat du dépositaire de brouillons : ${nom}`, () => {
    it('dépose un brouillon avec son destinataire, son objet et son corps', async () => {
      const { depositaire, relireLesBrouillons } = await fabriquer();
      const brouillon = unBrouillon();
      await depositaire.deposer({ brouillon, piecesJointes: [] });
      expect(await relireLesBrouillons()).toEqual([relu(brouillon)]);
    });

    it('garde les accents du nom, de l’objet et du corps', async () => {
      const { depositaire, relireLesBrouillons } = await fabriquer();
      const brouillon = unBrouillon({
        nom: 'Hélène Lefèvre',
        objet: 'RE: Devis chaudière à condensation',
        corps: 'Bonjour Madame,\n\nVeuillez trouver ci-joint le devis.\n\nÀ bientôt,\nL’équipe',
      });
      await depositaire.deposer({ brouillon, piecesJointes: [] });
      expect(await relireLesBrouillons()).toEqual([relu(brouillon)]);
    });

    it('joint les pièces jointes octet pour octet', async () => {
      const { depositaire, relireLesBrouillons } = await fabriquer();
      const brouillon = unBrouillon();
      // Les 256 valeurs d'octet : aucun encodage ne doit en perdre ni en transformer une.
      const pdf: PieceJointe = {
        nom: 'D-2027-0001.pdf',
        type: 'application/pdf',
        contenu: Uint8Array.from({ length: 256 }, (_, octet) => octet),
      };
      const texte: PieceJointe = {
        nom: 'conditions générales.txt',
        type: 'text/plain',
        contenu: new TextEncoder().encode('Conditions générales\n'),
      };
      await depositaire.deposer({ brouillon, piecesJointes: [pdf, texte] });
      expect(await relireLesBrouillons()).toEqual([relu(brouillon, [pdf, texte])]);
    });

    it('dépose chaque brouillon sans écraser les précédents', async () => {
      const { depositaire, relireLesBrouillons } = await fabriquer();
      const premier = unBrouillon({ objet: 'RE: Premier' });
      const second = unBrouillon({
        objet: 'RE: Second',
        adresse: 'paul.durand@exemple.fr',
        nom: null,
      });
      await depositaire.deposer({ brouillon: premier, piecesJointes: [] });
      await depositaire.deposer({ brouillon: second, piecesJointes: [] });
      expect(await relireLesBrouillons()).toEqual([relu(premier), relu(second)]);
    });
  });
}
