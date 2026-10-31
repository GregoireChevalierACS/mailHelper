import { apercu, destinataireDeReponse, objetDeReponse, URGENCES } from '@mailhelper/domain';
import { z } from 'zod';
import type {
  Fiche,
  ProblemeDAnalyse,
  ProblemeDeReponse,
  ProblemeDeSynthese,
  Synthese,
} from './casDUsage.js';

// Contrat entre la fenêtre et le processus principal. Les demandes sont validées à leur arrivée
// dans le processus principal, les réponses à leur arrivée dans la fenêtre : aucune des deux ne
// croit l'autre sur parole.

export const FOURNISSEURS = ['gmail', 'outlook'] as const;
export type Fournisseur = (typeof FOURNISSEURS)[number];

export const schemaDeDemandeDeConnexion = z.strictObject({ fournisseur: z.enum(FOURNISSEURS) });

export const FENETRE_MAXIMALE_EN_HEURES = 24 * 7;
export const LIMITE_MAXIMALE_DE_COURRIELS = 50;

export const schemaDeDemandeDeSynthese = z.strictObject({
  fenetreEnHeures: z.int().min(1).max(FENETRE_MAXIMALE_EN_HEURES),
  limite: z.int().min(1).max(LIMITE_MAXIMALE_DE_COURRIELS),
});

export const schemaDeDemandeDeReponse = z.strictObject({
  idDuCourriel: z.string().min(1),
  texte: z.string().min(1).max(20_000),
});

const schemaDeCorrespondant = z.strictObject({ nom: z.string().nullable(), adresse: z.string() });

const schemaDAttente = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('attendue'), urgence: z.enum(URGENCES), motif: z.string() }),
  z.strictObject({ kind: z.literal('aucune'), motif: z.string() }),
]);

export const PROBLEMES_D_ANALYSE = [
  'analyseur-injoignable',
  'reponse-du-modele-invalide',
  'resume-vide',
  'propositions-manquantes',
] as const satisfies readonly ProblemeDAnalyse['kind'][];

export const schemaDeFiche = z.strictObject({
  id: z.string(),
  expediteur: schemaDeCorrespondant,
  objet: z.string(),
  recuLe: z.number(),
  apercu: z.string(),
  /** Destinataire et objet de la réponse, montrés dans la demande de confirmation. */
  reponse: z.strictObject({ a: schemaDeCorrespondant, objet: z.string() }),
  analyse: z.discriminatedUnion('ok', [
    z.strictObject({
      ok: z.literal(true),
      resume: z.string(),
      attente: schemaDAttente,
      propositions: z.array(z.strictObject({ intention: z.string(), texte: z.string() })),
    }),
    z.strictObject({ ok: z.literal(false), probleme: z.enum(PROBLEMES_D_ANALYSE) }),
  ]),
});
export type DonneesDeFiche = z.infer<typeof schemaDeFiche>;

export const PROBLEMES_DE_SYNTHESE = [
  'non-connecte',
  'demande-invalide',
  'boite-injoignable',
] as const satisfies readonly ('non-connecte' | 'demande-invalide' | ProblemeDeSynthese['kind'])[];

export const schemaDeResultatDeSynthese = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), fiches: z.array(schemaDeFiche), illisibles: z.int() }),
  z.strictObject({ ok: z.literal(false), probleme: z.enum(PROBLEMES_DE_SYNTHESE) }),
]);
export type ResultatDeSynthese = z.infer<typeof schemaDeResultatDeSynthese>;

export const PROBLEMES_DE_REPONSE = [
  'non-connecte',
  'demande-invalide',
  'courriel-inconnu',
  'texte-vide',
  'destinataire-sans-lecteur',
  'presse-papiers-indisponible',
  'ouverture-impossible',
] as const satisfies readonly ('non-connecte' | 'demande-invalide' | ProblemeDeReponse['kind'])[];

export const schemaDeResultatDeReponse = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), probleme: z.enum(PROBLEMES_DE_REPONSE) }),
]);
export type ResultatDeReponse = z.infer<typeof schemaDeResultatDeReponse>;

export const PROBLEMES_DE_CONNEXION = [
  'demande-invalide',
  'configuration-incomplete',
  'connexion-refusee',
] as const;

export const schemaDeResultatDeConnexion = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), fournisseur: z.enum(FOURNISSEURS) }),
  z.strictObject({ ok: z.literal(false), probleme: z.enum(PROBLEMES_DE_CONNEXION) }),
]);
export type ResultatDeConnexion = z.infer<typeof schemaDeResultatDeConnexion>;

export function versLaFiche(fiche: Fiche): DonneesDeFiche {
  const { courriel, analyse } = fiche;
  return {
    id: courriel.id,
    expediteur: courriel.expediteur,
    objet: courriel.objet,
    recuLe: courriel.recuLe,
    apercu: apercu(courriel),
    reponse: { a: destinataireDeReponse(courriel), objet: objetDeReponse(courriel.objet) },
    analyse: analyse.ok
      ? {
          ok: true,
          resume: analyse.value.resume,
          attente: analyse.value.attente,
          propositions: [...analyse.value.propositions],
        }
      : { ok: false, probleme: analyse.error.kind },
  };
}

export function versLeResultatDeSynthese(synthese: Synthese): ResultatDeSynthese {
  return { ok: true, fiches: synthese.fiches.map(versLaFiche), illisibles: synthese.illisibles };
}
