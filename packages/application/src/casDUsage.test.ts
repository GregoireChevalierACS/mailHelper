import { describe, expect, it } from 'vitest';
import {
  ANALYSES_SIMULTANEES,
  creerLesCasDUsage,
  type DependancesDesCasDUsage,
} from './casDUsage.js';
import {
  AnalyseurScripte,
  boiteEnPanne,
  BoiteEnMemoire,
  HorlogeFixe,
  INSTANT_DE_REFERENCE,
  OuvreurQuiRetient,
  ouvreurEnPanne,
  PressePapiersEnMemoire,
  pressePapiersEnPanne,
  UNE_HEURE,
  unCourriel,
  uneReponseDuModele,
  verifierLeContratDeLaBoiteDeReception,
} from './testing/index.js';
import { creerCourriel } from '@mailhelper/domain';

verifierLeContratDeLaBoiteDeReception('doublure en mémoire', (saisies) =>
  Promise.resolve(
    new BoiteEnMemoire(
      saisies.map((saisie) => {
        const courriel = creerCourriel(saisie);
        if (!courriel.ok) throw new Error(courriel.error.kind);
        return courriel.value;
      }),
    ),
  ),
);

function preparer(surcharges: Partial<DependancesDesCasDUsage> = {}) {
  const ouvreur = new OuvreurQuiRetient();
  const pressePapiers = new PressePapiersEnMemoire();
  const dependances: DependancesDesCasDUsage = {
    boite: new BoiteEnMemoire([unCourriel()]),
    analyseur: new AnalyseurScripte(),
    ouvreur,
    pressePapiers,
    horloge: new HorlogeFixe(),
    ...surcharges,
  };
  return { ouvreur, pressePapiers, dependances, casDUsage: creerLesCasDUsage(dependances) };
}

const DEMANDE = { fenetreEnHeures: 24, limite: 20 };

describe('synthétiser les courriels récents', () => {
  it('cherche sur la fenêtre demandée : 24 h avant maintenant', async () => {
    const boite = new BoiteEnMemoire([]);
    const { casDUsage } = preparer({ boite });
    await casDUsage.synthetiser(DEMANDE);
    expect(boite.criteres).toEqual([{ depuis: INSTANT_DE_REFERENCE - 24 * UNE_HEURE, limite: 20 }]);
  });

  it('résume chaque courriel et propose des réponses', async () => {
    const { casDUsage } = preparer();
    const synthese = await casDUsage.synthetiser(DEMANDE);
    expect(synthese).toEqual({
      ok: true,
      value: {
        illisibles: 0,
        fiches: [
          {
            courriel: unCourriel(),
            analyse: {
              ok: true,
              value: {
                resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
                attente: {
                  kind: 'attendue',
                  urgence: 'normale',
                  motif: 'Question directe adressée au destinataire.',
                },
                propositions: [
                  {
                    intention: 'Confirmer',
                    texte: 'Bonjour Claire, je serai présent jeudi à 10 h.',
                  },
                  {
                    intention: 'Décliner',
                    texte: 'Bonjour Claire, je ne pourrai pas être présent.',
                  },
                ],
              },
            },
          },
        ],
      },
    });
  });

  it('transmet le nombre de courriels illisibles', async () => {
    const { casDUsage } = preparer({ boite: new BoiteEnMemoire([], 3) });
    const synthese = await casDUsage.synthetiser(DEMANDE);
    expect(synthese.ok && synthese.value.illisibles).toBe(3);
  });

  it('classe par priorité : urgent, normal, échec d’analyse, sans réponse', async () => {
    const boite = new BoiteEnMemoire([
      unCourriel({ id: 'info', recuLe: INSTANT_DE_REFERENCE - 1 * UNE_HEURE }),
      unCourriel({ id: 'echec', recuLe: INSTANT_DE_REFERENCE - 2 * UNE_HEURE }),
      unCourriel({ id: 'normal', recuLe: INSTANT_DE_REFERENCE - 3 * UNE_HEURE }),
      unCourriel({ id: 'urgent', recuLe: INSTANT_DE_REFERENCE - 4 * UNE_HEURE }),
    ]);
    const analyseur = new AnalyseurScripte(
      new Map<string, unknown>([
        ['info', uneReponseDuModele({ reponseAttendue: false, propositions: [] })],
        ['echec', new Error('quota dépassé')],
        ['urgent', uneReponseDuModele({ urgence: 'haute' })],
      ]),
    );
    const { casDUsage } = preparer({ boite, analyseur });
    const synthese = await casDUsage.synthetiser(DEMANDE);
    expect(synthese.ok && synthese.value.fiches.map((f) => f.courriel.id)).toEqual([
      'urgent',
      'normal',
      'echec',
      'info',
    ]);
  });

  it('isole l’échec d’une analyse : les autres courriels restent résumés', async () => {
    const boite = new BoiteEnMemoire([unCourriel({ id: 'a' }), unCourriel({ id: 'b' })]);
    const analyseur = new AnalyseurScripte(new Map([['a', new Error('délai dépassé')]]));
    const { casDUsage } = preparer({ boite, analyseur });
    const synthese = await casDUsage.synthetiser(DEMANDE);
    const parId = new Map<string, unknown>(
      synthese.ok ? synthese.value.fiches.map((f) => [f.courriel.id, f.analyse]) : [],
    );
    expect(parId.get('a')).toEqual({ ok: false, error: { kind: 'analyseur-injoignable' } });
    expect(parId.get('b')).toMatchObject({ ok: true });
  });

  it.each([
    ['un texte au lieu d’un objet', 'Voici le résumé…'],
    ['une urgence inconnue', uneReponseDuModele({ urgence: 'critique' })],
    ['un champ en trop', uneReponseDuModele({ envoyerMaintenant: true })],
    ['un champ manquant', { resume: 'x' }],
  ])('refuse une réponse du modèle mal formée : %s', async (_cas, reponse) => {
    const { casDUsage } = preparer({ analyseur: new AnalyseurScripte(new Map(), reponse) });
    const synthese = await casDUsage.synthetiser(DEMANDE);
    expect(synthese.ok && synthese.value.fiches[0]?.analyse).toEqual({
      ok: false,
      error: { kind: 'reponse-du-modele-invalide' },
    });
  });

  it('transmet le refus du domaine (résumé vide)', async () => {
    const analyseur = new AnalyseurScripte(new Map(), uneReponseDuModele({ resume: ' ' }));
    const { casDUsage } = preparer({ analyseur });
    const synthese = await casDUsage.synthetiser(DEMANDE);
    expect(synthese.ok && synthese.value.fiches[0]?.analyse).toEqual({
      ok: false,
      error: { kind: 'resume-vide' },
    });
  });

  it(`n’envoie pas plus de ${String(ANALYSES_SIMULTANEES)} analyses à la fois, et les fait toutes`, async () => {
    const courriels = Array.from({ length: 10 }, (_, i) =>
      unCourriel({ id: `c${String(i)}`, recuLe: INSTANT_DE_REFERENCE - (i + 1) * UNE_HEURE }),
    );
    const analyseur = new AnalyseurScripte();
    const { casDUsage } = preparer({ boite: new BoiteEnMemoire(courriels), analyseur });
    await casDUsage.synthetiser(DEMANDE);
    expect(analyseur.maximumSimultane).toBe(ANALYSES_SIMULTANEES);
    expect([...analyseur.analyses].sort()).toEqual(courriels.map((c) => c.id).sort());
  });

  it('signale une boîte injoignable sans en exposer le détail', async () => {
    const { casDUsage } = preparer({ boite: boiteEnPanne() });
    expect(await casDUsage.synthetiser(DEMANDE)).toEqual({
      ok: false,
      error: { kind: 'boite-injoignable' },
    });
  });
});

describe('répondre', () => {
  async function apresUneSynthese(surcharges: Partial<DependancesDesCasDUsage> = {}) {
    const preparation = preparer(surcharges);
    await preparation.casDUsage.synthetiser(DEMANDE);
    return preparation;
  }

  it('copie le texte et ouvre une réponse au bon destinataire, avec le bon objet', async () => {
    const { casDUsage, ouvreur, pressePapiers } = await apresUneSynthese();
    const resultat = await casDUsage.repondre({
      idDuCourriel: 'courriel-1',
      texte: ' Je serai là. ',
    });

    const brouillon = {
      a: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
      objet: 'RE: Réunion de jeudi',
      corps: 'Je serai là.',
      enReponseA: 'courriel-1',
    };
    expect(resultat).toEqual({ ok: true, value: brouillon });
    expect(pressePapiers.contenu).toBe('Je serai là.');
    expect(ouvreur.brouillons).toEqual([brouillon]);
  });

  it('refuse un courriel absent de la dernière synthèse', async () => {
    const { casDUsage, ouvreur } = await apresUneSynthese();
    expect(await casDUsage.repondre({ idDuCourriel: 'inventé', texte: 'Bonjour' })).toEqual({
      ok: false,
      error: { kind: 'courriel-inconnu' },
    });
    expect(ouvreur.brouillons).toEqual([]);
  });

  it('oublie les courriels d’une synthèse précédente', async () => {
    let courriels = [unCourriel({ id: 'ancien' })];
    const boite = { listerLesRecents: () => Promise.resolve({ courriels, illisibles: 0 }) };
    const { casDUsage } = preparer({ boite });
    await casDUsage.synthetiser(DEMANDE);
    courriels = [unCourriel({ id: 'nouveau' })];
    await casDUsage.synthetiser(DEMANDE);

    expect(await casDUsage.repondre({ idDuCourriel: 'ancien', texte: 'x' })).toEqual({
      ok: false,
      error: { kind: 'courriel-inconnu' },
    });
    expect((await casDUsage.repondre({ idDuCourriel: 'nouveau', texte: 'x' })).ok).toBe(true);
  });

  it('refuse avant toute synthèse', async () => {
    const { casDUsage } = preparer();
    expect((await casDUsage.repondre({ idDuCourriel: 'courriel-1', texte: 'x' })).ok).toBe(false);
  });

  it('transmet le refus du domaine (adresse sans lecteur)', async () => {
    const boite = new BoiteEnMemoire([
      unCourriel({ expediteur: { nom: null, adresse: 'noreply@banque.fr' } }),
    ]);
    const { casDUsage, ouvreur } = await apresUneSynthese({ boite });
    expect(await casDUsage.repondre({ idDuCourriel: 'courriel-1', texte: 'Merci' })).toEqual({
      ok: false,
      error: { kind: 'destinataire-sans-lecteur' },
    });
    expect(ouvreur.brouillons).toEqual([]);
  });

  it('n’ouvre rien si le presse-papiers est indisponible', async () => {
    const ouvreur = new OuvreurQuiRetient();
    const { casDUsage } = await apresUneSynthese({
      pressePapiers: pressePapiersEnPanne(),
      ouvreur,
    });
    expect(await casDUsage.repondre({ idDuCourriel: 'courriel-1', texte: 'Merci' })).toEqual({
      ok: false,
      error: { kind: 'presse-papiers-indisponible' },
    });
    expect(ouvreur.brouillons).toEqual([]);
  });

  it('signale une messagerie qui ne s’ouvre pas', async () => {
    const { casDUsage } = await apresUneSynthese({ ouvreur: ouvreurEnPanne() });
    expect(await casDUsage.repondre({ idDuCourriel: 'courriel-1', texte: 'Merci' })).toEqual({
      ok: false,
      error: { kind: 'ouverture-impossible' },
    });
  });
});
