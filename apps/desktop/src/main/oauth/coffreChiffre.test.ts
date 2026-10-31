import { describe, expect, it } from 'vitest';
import { creerUnCoffreChiffre, type DependancesDuCoffre } from './coffreChiffre.js';

// Chiffrement factice mais réversible : inverse les octets, pour vérifier qu'on écrit bien du chiffré.
function disqueFactice(contenuInitial: Buffer | null = null) {
  const disque = { contenu: contenuInitial };
  const dependances: DependancesDuCoffre = {
    chiffrer: (texte) => Promise.resolve(Buffer.from(texte).reverse()),
    dechiffrer: (octets) => Promise.resolve(Buffer.from(octets).reverse().toString()),
    lireLeFichier: () => Promise.resolve(disque.contenu),
    ecrireLeFichier: (octets) => {
      disque.contenu = octets;
      return Promise.resolve();
    },
  };
  return { disque, coffre: creerUnCoffreChiffre(dependances) };
}

const JETONS = { acces: 'acces', renouvellement: 'renouvellement', expireA: 42 };

describe('coffre chiffré', () => {
  it('est vide tant que rien n’a été écrit', async () => {
    expect(await disqueFactice().coffre.lire()).toBeNull();
  });

  it('relit ce qu’il a écrit, sans jamais l’écrire en clair', async () => {
    const { disque, coffre } = disqueFactice();
    await coffre.ecrire(JETONS);
    expect(disque.contenu?.toString()).not.toContain('renouvellement');
    expect(await coffre.lire()).toEqual(JETONS);
  });

  it('vaut « aucun jeton » si le fichier ne se déchiffre pas', async () => {
    const { coffre } = disqueFactice(Buffer.from('n’importe quoi'));
    expect(await coffre.lire()).toBeNull();
  });

  it('vaut « aucun jeton » si le contenu déchiffré n’a pas la forme attendue', async () => {
    const { coffre } = disqueFactice(Buffer.from(JSON.stringify({ acces: '' })).reverse());
    expect(await coffre.lire()).toBeNull();
  });
});
