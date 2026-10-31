import type { BoiteDeReception, CritereDeRecherche, LotDeCourriels } from '@mailhelper/application';
import type { SaisieDeCourriel } from '@mailhelper/domain';
import { z } from 'zod';
import {
  estUneDiffusionDeMasse,
  lireUnCorrespondant,
  valeurDeLEnTete,
  type EnTete,
} from '../messagerie/enTetes.js';
import { enLotDeCourriels, lireLeJson, parPaquets } from '../messagerie/recuperation.js';
import { texteDepuisLeHtml } from '../messagerie/texteDepuisLeHtml.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** messages.get coûte 5 unités de quota ; Gmail en accorde 250 par seconde et par utilisateur. */
const LECTURES_SIMULTANEES = 10;

interface Partie {
  readonly mimeType?: string | undefined;
  readonly filename?: string | undefined;
  readonly headers?: readonly EnTete[] | undefined;
  readonly body?: { readonly data?: string | undefined } | undefined;
  readonly parts?: readonly Partie[] | undefined;
}

const schemaDEnTete = z.object({ name: z.string(), value: z.string() });

const schemaDePartie: z.ZodType<Partie> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z.array(schemaDEnTete).optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(schemaDePartie).optional(),
  }),
);

const schemaDeListe = z.object({
  messages: z.array(z.object({ id: z.string() })).optional(),
});

const schemaDeMessage = z.object({
  id: z.string(),
  internalDate: z.string().regex(/^\d+$/u),
  payload: schemaDePartie,
});

function premierePartie(partie: Partie, type: string): string | null {
  // Une pièce jointe texte (.txt, .html) n'est pas le corps du message.
  if (
    partie.mimeType === type &&
    (partie.filename ?? '') === '' &&
    partie.body?.data !== undefined
  ) {
    return Buffer.from(partie.body.data, 'base64url').toString('utf8');
  }
  for (const sousPartie of partie.parts ?? []) {
    const trouvee = premierePartie(sousPartie, type);
    if (trouvee !== null) return trouvee;
  }
  return null;
}

/** Corps en texte brut : la version text/plain si elle existe, sinon la version HTML convertie. */
export function texteDuCorps(partie: Partie): string {
  const brut = premierePartie(partie, 'text/plain');
  if (brut !== null) return brut;
  const html = premierePartie(partie, 'text/html');
  return html === null ? '' : texteDepuisLeHtml(html);
}

function versLaSaisie(message: z.infer<typeof schemaDeMessage>): SaisieDeCourriel | null {
  const enTetes = message.payload.headers ?? [];
  const expediteur = valeurDeLEnTete(enTetes, 'From');
  if (expediteur === null) return null;
  const repondreA = valeurDeLEnTete(enTetes, 'Reply-To');
  return {
    id: message.id,
    expediteur: lireUnCorrespondant(expediteur),
    repondreA: repondreA === null ? null : lireUnCorrespondant(repondreA),
    objet: valeurDeLEnTete(enTetes, 'Subject') ?? '',
    corps: texteDuCorps(message.payload),
    recuLe: Number(message.internalDate),
    diffusionDeMasse: estUneDiffusionDeMasse(enTetes),
  };
}

export interface DependancesGmail {
  readonly fetch: typeof fetch;
  readonly jeton: () => Promise<string>;
}

/** Boîte de réception Gmail, lue par l'API REST avec la seule portée gmail.readonly. */
export function creerLaBoiteGmail(dependances: DependancesGmail): BoiteDeReception {
  async function lire(chemin: string): Promise<unknown> {
    const reponse = await dependances.fetch(`${API}${chemin}`, {
      headers: { authorization: `Bearer ${await dependances.jeton()}` },
    });
    return lireLeJson(reponse);
  }

  return {
    async listerLesRecents(critere: CritereDeRecherche): Promise<LotDeCourriels> {
      const recherche = new URLSearchParams({
        q: `in:inbox after:${String(Math.floor(critere.depuis / 1000))}`,
        maxResults: String(critere.limite),
      });
      const liste = schemaDeListe.parse(await lire(`/messages?${recherche.toString()}`));

      const saisies = await parPaquets(
        liste.messages ?? [],
        LECTURES_SIMULTANEES,
        async ({ id }) => {
          const message = schemaDeMessage.safeParse(
            await lire(`/messages/${encodeURIComponent(id)}?format=full`),
          );
          return message.success ? versLaSaisie(message.data) : null;
        },
      );
      return enLotDeCourriels(saisies, critere);
    },
  };
}
