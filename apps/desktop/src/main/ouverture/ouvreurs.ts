import type { OuvreurDeReponse } from '@mailhelper/application';
import type { BrouillonDeReponse } from '@mailhelper/domain';

/**
 * Au-delà, Windows tronque l'URL passée au gestionnaire mailto. Le corps est alors omis plutôt
 * que coupé : l'utilisateur le colle depuis le presse-papiers, où il est toujours copié en entier.
 */
export const LONGUEUR_MAXIMALE_D_URL = 2_000;

// RFC 6068 : les espaces s'écrivent %20 (et non « + », que certaines messageries laissent tel quel).
const encoder = (texte: string): string => encodeURIComponent(texte);

/** Fenêtre de rédaction de Gmail dans le navigateur, préremplie. */
export function lienDeRedactionGmail(brouillon: BrouillonDeReponse): string {
  const parametres = `view=cm&fs=1&to=${encoder(brouillon.a.adresse)}&su=${encoder(brouillon.objet)}`;
  const base = `https://mail.google.com/mail/?${parametres}`;
  const complet = `${base}&body=${encoder(brouillon.corps)}`;
  return complet.length <= LONGUEUR_MAXIMALE_D_URL ? complet : base;
}

/** Lien mailto : ouvre la messagerie par défaut de Windows (Outlook en général). */
export function lienMailto(brouillon: BrouillonDeReponse): string {
  const base = `mailto:${encoder(brouillon.a.adresse)}?subject=${encoder(brouillon.objet)}`;
  const complet = `${base}&body=${encoder(brouillon.corps)}`;
  return complet.length <= LONGUEUR_MAXIMALE_D_URL ? complet : base;
}

export function creerUnOuvreur(
  lien: (brouillon: BrouillonDeReponse) => string,
  ouvrirUnLien: (url: string) => Promise<void>,
): OuvreurDeReponse {
  return { ouvrir: (brouillon) => ouvrirUnLien(lien(brouillon)) };
}
