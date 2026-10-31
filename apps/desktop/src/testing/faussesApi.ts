import type { SaisieDeCorrespondant, SaisieDeCourriel } from '@mailhelper/domain';

/** Requêtes reçues par une fausse API, pour vérifier ce que l'adapter a demandé. */
export interface RequeteRecue {
  readonly url: URL;
  readonly enTetes: Headers;
}

const enTeteDAdresse = (correspondant: SaisieDeCorrespondant): string =>
  correspondant.nom === null
    ? correspondant.adresse
    : `"${correspondant.nom}" <${correspondant.adresse}>`;

const enBase64Url = (texte: string): string => Buffer.from(texte, 'utf8').toString('base64url');

/** Message Gmail (format=full) tel que l'API le renverrait pour cette saisie. */
export function messageGmail(saisie: SaisieDeCourriel): unknown {
  const headers = [
    { name: 'From', value: enTeteDAdresse(saisie.expediteur) },
    { name: 'Subject', value: saisie.objet },
    ...(saisie.repondreA === null
      ? []
      : [{ name: 'Reply-To', value: enTeteDAdresse(saisie.repondreA) }]),
    ...(saisie.diffusionDeMasse
      ? [{ name: 'List-Unsubscribe', value: '<mailto:stop@exemple.fr>' }]
      : []),
  ];
  return {
    id: saisie.id,
    threadId: `fil-${saisie.id}`,
    internalDate: String(saisie.recuLe),
    payload: {
      mimeType: 'multipart/alternative',
      headers,
      parts: [
        { mimeType: 'text/plain', filename: '', body: { data: enBase64Url(saisie.corps) } },
        {
          mimeType: 'text/html',
          filename: '',
          body: { data: enBase64Url(`<p>${saisie.corps}</p>`) },
        },
      ],
    },
  };
}

/**
 * Fausse API Gmail : liste tous les messages connus (sans appliquer la recherche, comme une API
 * moins précise que prévu) et renvoie chacun par son identifiant.
 */
export function fausseApiGmail(messages: readonly unknown[], statut = 200) {
  const requetes: RequeteRecue[] = [];
  const parId = new Map(
    messages.map((message) => [
      typeof message === 'object' && message !== null && 'id' in message ? String(message.id) : '',
      message,
    ]),
  );
  const fetch: typeof globalThis.fetch = (entree, init) => {
    const url = new URL(entree instanceof Request ? entree.url : entree);
    requetes.push({ url, enTetes: new Headers(init?.headers) });
    if (statut !== 200)
      return Promise.resolve(Response.json({ error: 'refus' }, { status: statut }));
    const id = /\/messages\/([^/?]+)$/u.exec(url.pathname)?.[1];
    if (id === undefined) {
      return Promise.resolve(
        Response.json({ messages: [...parId.keys()].map((cle) => ({ id: cle })) }),
      );
    }
    return Promise.resolve(Response.json(parId.get(decodeURIComponent(id)) ?? {}));
  };
  return { fetch, requetes };
}

const adresseGraph = (correspondant: SaisieDeCorrespondant) => ({
  emailAddress: { name: correspondant.nom, address: correspondant.adresse },
});

/** Message Microsoft Graph tel que l'API le renverrait pour cette saisie. */
export function messageGraph(saisie: SaisieDeCourriel): Record<string, unknown> {
  return {
    id: saisie.id,
    subject: saisie.objet,
    from: adresseGraph(saisie.expediteur),
    replyTo: saisie.repondreA === null ? [] : [adresseGraph(saisie.repondreA)],
    body: { contentType: 'text', content: saisie.corps },
    receivedDateTime: new Date(saisie.recuLe).toISOString(),
    internetMessageHeaders: saisie.diffusionDeMasse
      ? [{ name: 'List-Id', value: 'lettre.exemple.fr' }]
      : [{ name: 'Message-ID', value: `<${saisie.id}@exemple.fr>` }],
  };
}

/** Fausse API Graph : renvoie tous les messages connus, sans filtrer ni trier. */
export function fausseApiGraph(messages: readonly unknown[], statut = 200) {
  const requetes: RequeteRecue[] = [];
  const fetch: typeof globalThis.fetch = (entree, init) => {
    requetes.push({
      url: new URL(entree instanceof Request ? entree.url : entree),
      enTetes: new Headers(init?.headers),
    });
    return Promise.resolve(
      statut === 200
        ? Response.json({ value: messages })
        : Response.json({ error: 'refus' }, { status: statut }),
    );
  };
  return { fetch, requetes };
}
