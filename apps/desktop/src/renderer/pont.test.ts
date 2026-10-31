import { describe, expect, it } from 'vitest';
import { uneFiche } from '../testing/fauxPont.js';
import { creerLePont, type ApiDuPreload } from './pont.js';

function api(reponse: unknown) {
  const appels: [string, unknown][] = [];
  const repondre = (canal: string) => (charge: unknown) => {
    appels.push([canal, charge]);
    return Promise.resolve(reponse);
  };
  const exposee: ApiDuPreload = {
    connecter: repondre('connecter'),
    synthetiser: repondre('synthetiser'),
    repondre: repondre('repondre'),
  };
  return { appels, pont: creerLePont(exposee) };
}

describe('pont vers le processus principal', () => {
  it('transmet les demandes et rend les réponses conformes au contrat', async () => {
    const connexion = api({ ok: true, fournisseur: 'outlook' });
    expect(await connexion.pont.connecter('outlook')).toEqual({ ok: true, fournisseur: 'outlook' });
    expect(connexion.appels).toEqual([['connecter', { fournisseur: 'outlook' }]]);

    const synthese = api({ ok: true, fiches: [uneFiche()], illisibles: 0 });
    expect(await synthese.pont.synthetiser({ fenetreEnHeures: 24, limite: 30 })).toEqual({
      ok: true,
      fiches: [uneFiche()],
      illisibles: 0,
    });

    const reponse = api({ ok: false, probleme: 'texte-vide' });
    expect(await reponse.pont.repondre({ idDuCourriel: 'a', texte: ' ' })).toEqual({
      ok: false,
      probleme: 'texte-vide',
    });
  });

  it('refuse une réponse hors contrat au lieu de la croire', async () => {
    await expect(api({ ok: true }).pont.connecter('gmail')).rejects.toThrow();
    await expect(
      api({ ok: true, fiches: [{ id: 1 }] }).pont.synthetiser({ fenetreEnHeures: 1, limite: 1 }),
    ).rejects.toThrow();
    await expect(
      api({ ok: false, probleme: 'inventé' }).pont.repondre({ idDuCourriel: 'a', texte: 'b' }),
    ).rejects.toThrow();
  });
});
