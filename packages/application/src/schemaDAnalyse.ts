import { URGENCES, type AnalyseProposee } from '@mailhelper/domain';
import { z } from 'zod';

/**
 * Format de réponse imposé au modèle (sorties structurées), puis revalidé à la réception.
 * Volontairement sans bornes (longueurs, nombre d'éléments) : les sorties structurées n'acceptent
 * pas toutes les contraintes JSON Schema, et ces bornes sont des règles du domaine
 * (`consoliderLAnalyse`). Les descriptions sont lues par le modèle. Les choix fermés doivent rester
 * ceux du domaine (`satisfies`) : la compilation échoue sinon.
 */
export const schemaDAnalyseProposee = z.strictObject({
  resume: z
    .string()
    .describe('Résumé factuel en français, 1 à 3 phrases : qui demande quoi, pour quand.'),
  reponseAttendue: z
    .boolean()
    .describe("Vrai si l'expéditeur attend une réponse écrite du destinataire."),
  urgence: z
    .enum(URGENCES)
    .describe('Urgence de la réponse : haute (échéance proche, blocage), normale ou basse.'),
  motif: z.string().describe('Une phrase qui justifie la décision sur la réponse attendue.'),
  propositions: z
    .array(
      z.strictObject({
        intention: z.string().describe('Deux à quatre mots : « Accepter », « Demander un délai »…'),
        texte: z
          .string()
          .describe('Corps complet de la réponse, prêt à envoyer, sans objet ni signature.'),
      }),
    )
    .describe(
      'De 2 à 4 réponses aux intentions distinctes ; liste vide si aucune réponse attendue.',
    ),
}) satisfies z.ZodType<AnalyseProposee>;
