import {
  consoliderLAnalyse,
  err,
  heuresAvant,
  ok,
  ordonnerParPriorite,
  preparerLeBrouillon,
  type Analyse,
  type BrouillonDeReponse,
  type Courriel,
  type ErreurDAnalyse,
  type ErreurDeBrouillon,
  type Result,
} from '@mailhelper/domain';
import type {
  Analyseur,
  BoiteDeReception,
  Horloge,
  LotDeCourriels,
  OuvreurDeReponse,
  PressePapiers,
} from './ports.js';
import { schemaDAnalyseProposee } from './schemaDAnalyse.js';

export interface DependancesDesCasDUsage {
  readonly boite: BoiteDeReception;
  readonly analyseur: Analyseur;
  readonly ouvreur: OuvreurDeReponse;
  readonly pressePapiers: PressePapiers;
  readonly horloge: Horloge;
}

export interface DemandeDeSynthese {
  readonly fenetreEnHeures: number;
  readonly limite: number;
}

export type ProblemeDAnalyse =
  | { readonly kind: 'analyseur-injoignable' }
  | { readonly kind: 'reponse-du-modele-invalide' }
  | ErreurDAnalyse;

export interface Fiche {
  readonly courriel: Courriel;
  readonly analyse: Result<Analyse, ProblemeDAnalyse>;
}

export interface Synthese {
  readonly fiches: readonly Fiche[];
  readonly illisibles: number;
}

export interface ProblemeDeSynthese {
  readonly kind: 'boite-injoignable';
}

export interface DemandeDeReponse {
  readonly idDuCourriel: string;
  readonly texte: string;
}

export type ProblemeDeReponse =
  | { readonly kind: 'courriel-inconnu' }
  | ErreurDeBrouillon
  | { readonly kind: 'presse-papiers-indisponible' }
  | { readonly kind: 'ouverture-impossible' };

/**
 * Nombre d'analyses envoyées en même temps au modèle : assez pour qu'une boîte de 20 courriels
 * se résume en quelques secondes, assez peu pour rester sous les limites de débit de l'API.
 */
export const ANALYSES_SIMULTANEES = 4;

async function enParallele<T, R>(
  elements: readonly T[],
  simultanes: number,
  traiter: (element: T) => Promise<R>,
): Promise<readonly R[]> {
  const resultats = new Array<R>(elements.length);
  // Un seul itérateur partagé : chaque ouvrier prend le prochain élément libre.
  const file = elements.entries();
  async function ouvrier(): Promise<void> {
    for (const [indice, element] of file) {
      resultats[indice] = await traiter(element);
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultanes, elements.length) }, ouvrier));
  return resultats;
}

export function creerLesCasDUsage(dependances: DependancesDesCasDUsage) {
  const { boite, analyseur, ouvreur, pressePapiers, horloge } = dependances;

  // Courriels de la dernière synthèse. La fenêtre ne désigne un courriel que par son identifiant :
  // le destinataire et l'objet de la réponse sont toujours relus ici, jamais reçus de la fenêtre.
  let courrielsConnus = new Map<string, Courriel>();

  async function analyser(courriel: Courriel): Promise<Result<Analyse, ProblemeDAnalyse>> {
    let brute: unknown;
    try {
      brute = await analyseur.analyser(courriel);
    } catch {
      return err({ kind: 'analyseur-injoignable' });
    }
    const lue = schemaDAnalyseProposee.safeParse(brute);
    if (!lue.success) return err({ kind: 'reponse-du-modele-invalide' });
    return consoliderLAnalyse(courriel, lue.data);
  }

  return {
    async synthetiser(demande: DemandeDeSynthese): Promise<Result<Synthese, ProblemeDeSynthese>> {
      const depuis = heuresAvant(horloge.maintenant(), demande.fenetreEnHeures);
      let lot: LotDeCourriels;
      try {
        lot = await boite.listerLesRecents({ depuis, limite: demande.limite });
      } catch {
        return err({ kind: 'boite-injoignable' });
      }

      const fiches = await enParallele(
        lot.courriels,
        ANALYSES_SIMULTANEES,
        async (courriel): Promise<Fiche> => ({ courriel, analyse: await analyser(courriel) }),
      );
      courrielsConnus = new Map(lot.courriels.map((courriel) => [courriel.id, courriel]));

      return ok({
        fiches: ordonnerParPriorite(fiches, (fiche) => ({
          attente: fiche.analyse.ok ? fiche.analyse.value.attente : null,
          recuLe: fiche.courriel.recuLe,
        })),
        illisibles: lot.illisibles,
      });
    },

    /**
     * Copie le texte choisi et ouvre une réponse dans la messagerie. Appelé seulement après la
     * confirmation de l'utilisateur ; rien n'est jamais envoyé sans lui.
     */
    async repondre(
      demande: DemandeDeReponse,
    ): Promise<Result<BrouillonDeReponse, ProblemeDeReponse>> {
      const courriel = courrielsConnus.get(demande.idDuCourriel);
      if (courriel === undefined) return err({ kind: 'courriel-inconnu' });

      const brouillon = preparerLeBrouillon(courriel, demande.texte);
      if (!brouillon.ok) return brouillon;

      try {
        await pressePapiers.copier(brouillon.value.corps);
      } catch {
        return err({ kind: 'presse-papiers-indisponible' });
      }
      try {
        await ouvreur.ouvrir(brouillon.value);
      } catch {
        return err({ kind: 'ouverture-impossible' });
      }
      return brouillon;
    },
  };
}

export type CasDUsage = ReturnType<typeof creerLesCasDUsage>;
