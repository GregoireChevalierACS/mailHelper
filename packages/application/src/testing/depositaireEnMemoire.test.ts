import { describe, expect, it } from 'vitest';
import { verifierLeContratDuDepositaireDeBrouillon } from './contratDuDepositaireDeBrouillon.js';
import { DepositaireEnMemoire, depositaireEnPanne, unBrouillon } from './doublures.js';

verifierLeContratDuDepositaireDeBrouillon('doublure en mémoire', () => {
  const depositaire = new DepositaireEnMemoire();
  return Promise.resolve({
    depositaire,
    relireLesBrouillons: () =>
      Promise.resolve(
        depositaire.depots.map(({ brouillon, piecesJointes }) => ({
          a: { nom: brouillon.a.nom, adresse: brouillon.a.adresse },
          objet: brouillon.objet,
          corps: brouillon.corps,
          piecesJointes,
        })),
      ),
  });
});

describe('DepositaireEnMemoire', () => {
  it('garde une copie des octets : modifier la pièce jointe après coup ne change rien', async () => {
    const depositaire = new DepositaireEnMemoire();
    const contenu = Uint8Array.from([1, 2, 3]);
    await depositaire.deposer({
      brouillon: unBrouillon(),
      piecesJointes: [{ nom: 'a.bin', type: 'application/octet-stream', contenu }],
    });
    contenu[0] = 9;
    expect(depositaire.depots[0]?.piecesJointes[0]?.contenu).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('a une version en panne, pour tester les cas d’erreur', async () => {
    await expect(
      depositaireEnPanne().deposer({ brouillon: unBrouillon(), piecesJointes: [] }),
    ).rejects.toThrow('serveur injoignable');
  });
});
