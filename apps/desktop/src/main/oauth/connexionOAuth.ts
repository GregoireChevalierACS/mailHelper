import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { z } from 'zod';

/** Fournisseur d'identité OAuth 2.0 (Google, Microsoft). */
export interface FournisseurOAuth {
  readonly urlDAutorisation: string;
  readonly urlDeJeton: string;
  readonly clientId: string;
  /** Google en exige un pour les applications de bureau, sans qu'il soit secret (RFC 8252 § 8.5). */
  readonly clientSecret: string | null;
  readonly portees: readonly string[];
  readonly parametresDAutorisation: Readonly<Record<string, string>>;
}

export interface Jetons {
  readonly acces: string;
  readonly renouvellement: string | null;
  /** Instant d'expiration du jeton d'accès, en millisecondes. */
  readonly expireA: number;
}

export interface DependancesOAuth {
  readonly fetch: typeof fetch;
  readonly ouvrirLeNavigateur: (url: string) => Promise<void>;
  readonly maintenant: () => number;
  /** Délai laissé à l'utilisateur pour se connecter dans son navigateur. */
  readonly delaiEnMillisecondes?: number;
}

export class EchecDeConnexion extends Error {
  override readonly name = 'EchecDeConnexion';
}

const schemaDeReponseDeJeton = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
});

const schemaDAdresse = z.object({ port: z.number() });

const enBase64Url = (octets: Buffer): string => octets.toString('base64url');

async function demanderDesJetons(
  fournisseur: FournisseurOAuth,
  parametres: Record<string, string>,
  dependances: DependancesOAuth,
  renouvellementActuel: string | null,
): Promise<Jetons> {
  const corps = new URLSearchParams({ client_id: fournisseur.clientId, ...parametres });
  if (fournisseur.clientSecret !== null) corps.set('client_secret', fournisseur.clientSecret);

  const reponse = await dependances.fetch(fournisseur.urlDeJeton, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: corps.toString(),
  });
  // Le corps d'une erreur peut contenir le code reçu : seul le statut est rapporté.
  if (!reponse.ok) throw new EchecDeConnexion(`jeton refusé (HTTP ${String(reponse.status)})`);

  const lue = schemaDeReponseDeJeton.safeParse(await reponse.json());
  if (!lue.success) throw new EchecDeConnexion('réponse de jeton illisible');
  return {
    acces: lue.data.access_token,
    // Un renouvellement ne renvoie pas toujours de nouveau jeton de renouvellement : on garde l'ancien.
    renouvellement: lue.data.refresh_token ?? renouvellementActuel,
    expireA: dependances.maintenant() + lue.data.expires_in * 1000,
  };
}

const PAGE_DE_RETOUR = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>MailHelper</title>
<body style="font-family:system-ui;padding:2rem">Connexion terminée. Vous pouvez fermer cet onglet et revenir à MailHelper.</body></html>`;

/** Attend la redirection du navigateur sur le serveur local et rend le code d'autorisation. */
function attendreLeCode(serveur: Server, etatAttendu: string, delai: number): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => {
      rejeter(new EchecDeConnexion('délai de connexion dépassé'));
    }, delai);
    serveur.on('close', () => {
      clearTimeout(minuterie);
    });

    serveur.on('request', (requete, reponse) => {
      const url = new URL(String(requete.url), 'http://127.0.0.1');
      const code = url.searchParams.get('code');
      const etat = url.searchParams.get('state');
      if (code === null && url.searchParams.get('error') === null) {
        // Requête parasite (favicon…) : on attend la vraie redirection.
        reponse.writeHead(404).end();
        return;
      }
      reponse.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE_DE_RETOUR);
      clearTimeout(minuterie);
      // Le paramètre state prouve que la redirection répond à notre demande (protection CSRF).
      if (code === null || etat !== etatAttendu) {
        rejeter(new EchecDeConnexion('autorisation refusée ou détournée'));
      } else {
        resoudre(code);
      }
    });
  });
}

/**
 * Connexion OAuth 2.0 d'une application native (RFC 8252) : code d'autorisation avec PKCE et
 * redirection vers un serveur local éphémère, qui n'écoute que sur 127.0.0.1.
 */
export async function autoriser(
  fournisseur: FournisseurOAuth,
  dependances: DependancesOAuth,
): Promise<Jetons> {
  const verificateur = enBase64Url(randomBytes(32));
  const defi = enBase64Url(createHash('sha256').update(verificateur).digest());
  const etat = enBase64Url(randomBytes(16));

  const serveur = createServer();
  await new Promise<void>((resoudre) => serveur.listen(0, '127.0.0.1', resoudre));
  try {
    // address() n'est une chaîne que pour un tube nommé : ici, toujours { port, … }.
    const { port } = schemaDAdresse.parse(serveur.address());
    const redirection = `http://127.0.0.1:${String(port)}/`;

    const url = new URL(fournisseur.urlDAutorisation);
    for (const [cle, valeur] of Object.entries({
      ...fournisseur.parametresDAutorisation,
      client_id: fournisseur.clientId,
      response_type: 'code',
      redirect_uri: redirection,
      scope: fournisseur.portees.join(' '),
      state: etat,
      code_challenge: defi,
      code_challenge_method: 'S256',
    })) {
      url.searchParams.set(cle, valeur);
    }

    // Attendus ensemble : un refus qui arrive pendant l'ouverture du navigateur est bien traité.
    const [code] = await Promise.all([
      attendreLeCode(serveur, etat, dependances.delaiEnMillisecondes ?? 300_000),
      dependances.ouvrirLeNavigateur(url.toString()),
    ]);
    return await demanderDesJetons(
      fournisseur,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirection,
        code_verifier: verificateur,
      },
      dependances,
      null,
    );
  } finally {
    serveur.close();
    serveur.closeAllConnections();
  }
}

export function renouveler(
  fournisseur: FournisseurOAuth,
  renouvellement: string,
  dependances: DependancesOAuth,
): Promise<Jetons> {
  return demanderDesJetons(
    fournisseur,
    {
      grant_type: 'refresh_token',
      refresh_token: renouvellement,
      scope: fournisseur.portees.join(' '),
    },
    dependances,
    renouvellement,
  );
}
