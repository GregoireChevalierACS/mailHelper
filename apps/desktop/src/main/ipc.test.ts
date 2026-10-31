import {
  AnalyseurScripte,
  boiteEnPanne,
  BoiteEnMemoire,
  HorlogeFixe,
  OuvreurQuiRetient,
  PressePapiersEnMemoire,
  unCourriel,
} from '@mailhelper/application/testing';
import { schemaDeResultatDeSynthese, type BoiteDeReception } from '@mailhelper/application';
import { describe, expect, it } from 'vitest';
import { CANAUX } from '../canaux.js';
import { creerLesGestionnaires } from './ipc.js';
import { creerLaSession, type Connecteur, type MessagerieConnectee } from './session.js';

function preparer(gmail: Connecteur, outlook: Connecteur = null) {
  const session = creerLaSession({
    connecteurs: { gmail, outlook },
    analyseur: new AnalyseurScripte(),
    pressePapiers: new PressePapiersEnMemoire(),
    horloge: new HorlogeFixe(),
  });
  return creerLesGestionnaires(session);
}

function messagerie(boite: BoiteDeReception = new BoiteEnMemoire([unCourriel()])) {
  const ouvreur = new OuvreurQuiRetient();
  const connectee: MessagerieConnectee = { boite, ouvreur };
  return { ouvreur, connecteur: () => Promise.resolve(connectee) };
}

const SYNTHESE = { fenetreEnHeures: 24, limite: 20 };

describe('canaux', () => {
  it('ont chacun un gestionnaire, et réciproquement', () => {
    expect(Object.keys(preparer(null)).sort()).toEqual(Object.keys(CANAUX).sort());
    expect(new Set(Object.values(CANAUX)).size).toBe(Object.keys(CANAUX).length);
  });
});

describe('connexion', () => {
  it('se connecte à la messagerie choisie', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    expect(await gestionnaires.connecter({ fournisseur: 'gmail' })).toEqual({
      ok: true,
      fournisseur: 'gmail',
    });
  });

  it('refuse une messagerie non configurée sur ce poste', async () => {
    const gestionnaires = preparer(messagerie().connecteur, null);
    expect(await gestionnaires.connecter({ fournisseur: 'outlook' })).toEqual({
      ok: false,
      probleme: 'configuration-incomplete',
    });
  });

  it('signale une connexion refusée ou abandonnée', async () => {
    const gestionnaires = preparer(() => Promise.reject(new Error('fenêtre fermée')));
    expect(await gestionnaires.connecter({ fournisseur: 'gmail' })).toEqual({
      ok: false,
      probleme: 'connexion-refusee',
    });
  });

  it('refuse une demande mal formée', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    expect(await gestionnaires.connecter({ fournisseur: 'yahoo' })).toEqual({
      ok: false,
      probleme: 'demande-invalide',
    });
  });
});

describe('synthèse', () => {
  it('refuse tant que l’utilisateur n’est pas connecté', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    expect(await gestionnaires.synthetiser(SYNTHESE)).toEqual({
      ok: false,
      probleme: 'non-connecte',
    });
  });

  it('renvoie des fiches conformes au contrat de la fenêtre', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    const resultat = schemaDeResultatDeSynthese.parse(await gestionnaires.synthetiser(SYNTHESE));
    expect(resultat.ok && resultat.fiches.map((f) => f.id)).toEqual(['courriel-1']);
  });

  it('refuse une demande hors limites', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    expect(await gestionnaires.synthetiser({ fenetreEnHeures: 10_000, limite: 20 })).toEqual({
      ok: false,
      probleme: 'demande-invalide',
    });
  });

  it('signale une boîte injoignable', async () => {
    const gestionnaires = preparer(messagerie(boiteEnPanne()).connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    expect(await gestionnaires.synthetiser(SYNTHESE)).toEqual({
      ok: false,
      probleme: 'boite-injoignable',
    });
  });
});

describe('réponse', () => {
  it('refuse tant que l’utilisateur n’est pas connecté', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    expect(await gestionnaires.repondre({ idDuCourriel: 'courriel-1', texte: 'x' })).toEqual({
      ok: false,
      probleme: 'non-connecte',
    });
  });

  it('ouvre la réponse au courriel désigné', async () => {
    const { ouvreur, connecteur } = messagerie();
    const gestionnaires = preparer(connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    await gestionnaires.synthetiser(SYNTHESE);

    expect(await gestionnaires.repondre({ idDuCourriel: 'courriel-1', texte: 'Merci' })).toEqual({
      ok: true,
    });
    expect(ouvreur.brouillons.map((b) => b.a.adresse)).toEqual(['claire.martin@exemple.fr']);
  });

  it('refuse une demande qui tente d’imposer son destinataire', async () => {
    const { ouvreur, connecteur } = messagerie();
    const gestionnaires = preparer(connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    await gestionnaires.synthetiser(SYNTHESE);

    expect(
      await gestionnaires.repondre({
        idDuCourriel: 'courriel-1',
        texte: 'x',
        a: 'pirate@exemple.fr',
      }),
    ).toEqual({ ok: false, probleme: 'demande-invalide' });
    expect(ouvreur.brouillons).toEqual([]);
  });

  it('transmet la nature d’un refus', async () => {
    const gestionnaires = preparer(messagerie().connecteur);
    await gestionnaires.connecter({ fournisseur: 'gmail' });
    expect(await gestionnaires.repondre({ idDuCourriel: 'inconnu', texte: 'x' })).toEqual({
      ok: false,
      probleme: 'courriel-inconnu',
    });
  });
});
