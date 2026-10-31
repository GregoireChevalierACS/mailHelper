import {
  creerCourriel,
  creerInstant,
  type BrouillonDeReponse,
  type Courriel,
  type Instant,
  type SaisieDeCourriel,
} from '@mailhelper/domain';
import type {
  Analyseur,
  BoiteDeReception,
  CritereDeRecherche,
  Horloge,
  LotDeCourriels,
  OuvreurDeReponse,
  PressePapiers,
} from '../ports.js';

// 2026-10-31 09:00:00 UTC
export const INSTANT_DE_REFERENCE = 1_793_437_200_000;
export const UNE_HEURE = 3_600_000;

export function unInstant(millisecondes: number): Instant {
  const instant = creerInstant(millisecondes);
  if (!instant.ok) throw new Error(`instant invalide : ${String(millisecondes)}`);
  return instant.value;
}

export const uneSaisieDeCourriel = (
  surcharges: Partial<SaisieDeCourriel> = {},
): SaisieDeCourriel => ({
  id: 'courriel-1',
  expediteur: { nom: 'Claire Martin', adresse: 'claire.martin@exemple.fr' },
  repondreA: null,
  objet: 'Réunion de jeudi',
  corps: 'Bonjour,\n\nPeux-tu confirmer ta présence jeudi à 10 h ?\n\nClaire',
  recuLe: INSTANT_DE_REFERENCE - UNE_HEURE,
  diffusionDeMasse: false,
  ...surcharges,
});

export function unCourriel(surcharges: Partial<SaisieDeCourriel> = {}): Courriel {
  const courriel = creerCourriel(uneSaisieDeCourriel(surcharges));
  if (!courriel.ok) throw new Error(`fixture invalide : ${courriel.error.kind}`);
  return courriel.value;
}

/** Réponse brute du modèle, telle qu'un analyseur la renverrait. */
export const uneReponseDuModele = (surcharges: Record<string, unknown> = {}): unknown => ({
  resume: 'Claire demande une confirmation de présence jeudi à 10 h.',
  reponseAttendue: true,
  urgence: 'normale',
  motif: 'Question directe adressée au destinataire.',
  propositions: [
    { intention: 'Confirmer', texte: 'Bonjour Claire, je serai présent jeudi à 10 h.' },
    { intention: 'Décliner', texte: 'Bonjour Claire, je ne pourrai pas être présent.' },
  ],
  ...surcharges,
});

/** Boîte de réception en mémoire, tenue par le même contrat que les adapters Gmail et Outlook. */
export class BoiteEnMemoire implements BoiteDeReception {
  readonly criteres: CritereDeRecherche[] = [];

  constructor(
    private readonly courriels: readonly Courriel[],
    private readonly illisibles = 0,
  ) {}

  listerLesRecents(critere: CritereDeRecherche): Promise<LotDeCourriels> {
    this.criteres.push(critere);
    const courriels = this.courriels
      .filter((courriel) => courriel.recuLe >= critere.depuis)
      .sort((a, b) => b.recuLe - a.recuLe)
      .slice(0, critere.limite);
    return Promise.resolve({ courriels, illisibles: this.illisibles });
  }
}

export const boiteEnPanne = (): BoiteDeReception => ({
  listerLesRecents: () => Promise.reject(new Error('réseau coupé')),
});

/** Analyseur qui rejoue une réponse écrite à l'avance par identifiant de courriel. */
export class AnalyseurScripte implements Analyseur {
  readonly analyses: string[] = [];
  enCours = 0;
  maximumSimultane = 0;

  constructor(
    private readonly reponses: ReadonlyMap<string, unknown> = new Map(),
    private readonly parDefaut: unknown = uneReponseDuModele(),
  ) {}

  async analyser(courriel: Courriel): Promise<unknown> {
    this.analyses.push(courriel.id);
    this.enCours += 1;
    this.maximumSimultane = Math.max(this.maximumSimultane, this.enCours);
    // Laisse les autres analyses démarrer, pour mesurer la concurrence réelle.
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.enCours -= 1;
    const reponse = this.reponses.has(courriel.id)
      ? this.reponses.get(courriel.id)
      : this.parDefaut;
    if (reponse instanceof Error) throw reponse;
    return reponse;
  }
}

export class OuvreurQuiRetient implements OuvreurDeReponse {
  readonly brouillons: BrouillonDeReponse[] = [];

  ouvrir(brouillon: BrouillonDeReponse): Promise<void> {
    this.brouillons.push(brouillon);
    return Promise.resolve();
  }
}

export const ouvreurEnPanne = (): OuvreurDeReponse => ({
  ouvrir: () => Promise.reject(new Error('aucune messagerie')),
});

export class PressePapiersEnMemoire implements PressePapiers {
  contenu = '';

  copier(texte: string): Promise<void> {
    this.contenu = texte;
    return Promise.resolve();
  }
}

export const pressePapiersEnPanne = (): PressePapiers => ({
  copier: () => Promise.reject(new Error('presse-papiers verrouillé')),
});

export class HorlogeFixe implements Horloge {
  constructor(private instant: Instant = unInstant(INSTANT_DE_REFERENCE)) {}

  maintenant(): Instant {
    return this.instant;
  }
}
