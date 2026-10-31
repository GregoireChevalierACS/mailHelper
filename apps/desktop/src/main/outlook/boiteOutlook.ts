import type { BoiteDeReception, CritereDeRecherche, LotDeCourriels } from '@mailhelper/application';
import type { SaisieDeCorrespondant, SaisieDeCourriel } from '@mailhelper/domain';
import { z } from 'zod';
import { estUneDiffusionDeMasse } from '../messagerie/enTetes.js';
import { enLotDeCourriels, lireLeJson } from '../messagerie/recuperation.js';
import { texteDepuisLeHtml } from '../messagerie/texteDepuisLeHtml.js';

const API = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages';

const schemaDAdresse = z.object({
  emailAddress: z.object({ name: z.string().nullish(), address: z.string().nullish() }),
});

const schemaDeMessage = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  from: schemaDAdresse.nullish(),
  replyTo: z.array(schemaDAdresse).nullish(),
  body: z.object({ contentType: z.string(), content: z.string() }).nullish(),
  receivedDateTime: z.string(),
  internetMessageHeaders: z.array(z.object({ name: z.string(), value: z.string() })).nullish(),
});

const schemaDeListe = z.object({ value: z.array(z.unknown()) });

const versLeCorrespondant = (adresse: z.infer<typeof schemaDAdresse>): SaisieDeCorrespondant => ({
  nom: adresse.emailAddress.name ?? null,
  adresse: adresse.emailAddress.address ?? '',
});

function versLaSaisie(brut: unknown): SaisieDeCourriel | null {
  const lu = schemaDeMessage.safeParse(brut);
  if (!lu.success) return null;
  const message = lu.data;
  const expediteur = message.from;
  if (expediteur === null || expediteur === undefined) return null;
  const repondreA = message.replyTo?.[0];
  const corps = message.body ?? { contentType: 'text', content: '' };
  return {
    id: message.id,
    expediteur: versLeCorrespondant(expediteur),
    repondreA: repondreA === undefined ? null : versLeCorrespondant(repondreA),
    objet: message.subject ?? '',
    corps:
      corps.contentType.toLowerCase() === 'html' ? texteDepuisLeHtml(corps.content) : corps.content,
    // Une date illisible donne NaN, refusé par le domaine : le courriel est compté illisible.
    recuLe: Date.parse(message.receivedDateTime),
    diffusionDeMasse: estUneDiffusionDeMasse(message.internetMessageHeaders ?? []),
  };
}

export interface DependancesOutlook {
  readonly fetch: typeof fetch;
  readonly jeton: () => Promise<string>;
}

/**
 * Boîte de réception Outlook (Microsoft 365, Exchange Online), lue par Microsoft Graph avec la
 * seule portée Mail.Read. Une seule requête : Graph filtre, trie et renvoie les corps.
 */
export function creerLaBoiteOutlook(dependances: DependancesOutlook): BoiteDeReception {
  return {
    async listerLesRecents(critere: CritereDeRecherche): Promise<LotDeCourriels> {
      const recherche = new URLSearchParams({
        $filter: `receivedDateTime ge ${new Date(critere.depuis).toISOString()}`,
        $orderby: 'receivedDateTime desc',
        $top: String(critere.limite),
        $select: 'id,subject,from,replyTo,body,receivedDateTime,internetMessageHeaders',
      });
      const reponse = await dependances.fetch(`${API}?${recherche.toString()}`, {
        headers: {
          authorization: `Bearer ${await dependances.jeton()}`,
          // Graph convertit lui-même le HTML en texte : moins de bruit pour le modèle.
          prefer: 'outlook.body-content-type="text"',
        },
      });
      const liste = schemaDeListe.parse(await lireLeJson(reponse));
      return enLotDeCourriels(liste.value.map(versLaSaisie), critere);
    },
  };
}
