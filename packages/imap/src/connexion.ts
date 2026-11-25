import { ImapFlow } from 'imapflow';
import { ErreurDeMessagerie } from '@mailhelper/messagerie';

/** Identifiants d'une boîte IMAP. Le mot de passe est le plus souvent un mot de passe d'application. */
export interface ConnexionImap {
  readonly hote: string;
  readonly port: number;
  /** TLS dès la connexion (port 993). Sans lui, le serveur de test GreenMail, en clair. */
  readonly securise: boolean;
  readonly utilisateur: string;
  readonly motDePasse: string;
}

/**
 * Ouvre une connexion, exécute l'action, puis la ferme quoi qu'il arrive. Une connexion par
 * opération : un relevé toutes les quelques minutes ne justifie pas de la garder ouverte.
 */
export async function avecUneConnexion<T>(
  connexion: ConnexionImap,
  action: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: connexion.hote,
    port: connexion.port,
    secure: connexion.securise,
    auth: { user: connexion.utilisateur, pass: connexion.motDePasse },
    logger: false,
  });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.logout();
  }
}

export type UsageDeDossier = '\\Sent' | '\\Drafts';

/**
 * Chemin du dossier qui a cet usage (RFC 6154). imapflow le déduit aussi du nom (« Sent »,
 * « Drafts », « Brouillons »…) quand le serveur ne l'annonce pas, ce qui couvre les hébergeurs
 * courants.
 */
export async function cheminDuDossier(
  client: ImapFlow,
  usage: UsageDeDossier,
): Promise<string | null> {
  const dossiers = await client.list();
  return dossiers.find((dossier) => dossier.specialUse === usage)?.path ?? null;
}

export async function cheminObligatoire(client: ImapFlow, usage: UsageDeDossier): Promise<string> {
  const chemin = await cheminDuDossier(client, usage);
  if (chemin === null) throw new ErreurDeMessagerie(`Aucun dossier ${usage} dans cette boîte.`);
  return chemin;
}
