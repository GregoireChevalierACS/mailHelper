import { creerCourriel, type Courriel, type SaisieDeCourriel } from '@mailhelper/domain';
import type { CritereDeRecherche, LotDeCourriels } from '@mailhelper/application';

export class ErreurDeMessagerie extends Error {
  override readonly name = 'ErreurDeMessagerie';
}

/** Lit une réponse JSON d'une API de messagerie, en échouant sur tout statut d'erreur. */
export async function lireLeJson(reponse: Response): Promise<unknown> {
  // Le corps d'une erreur peut citer la requête : seul le statut est rapporté.
  if (!reponse.ok) throw new ErreurDeMessagerie(`HTTP ${String(reponse.status)}`);
  return reponse.json();
}

/**
 * Applique le contrat de la boîte de réception aux saisies lues dans l'API, quoi que l'API ait
 * renvoyé : les courriels illisibles sont comptés, les autres filtrés par date, triés du plus
 * récent au plus ancien et limités en nombre.
 */
export function enLotDeCourriels(
  saisies: readonly (SaisieDeCourriel | null)[],
  critere: CritereDeRecherche,
): LotDeCourriels {
  const courriels: Courriel[] = [];
  let illisibles = 0;
  for (const saisie of saisies) {
    const courriel = saisie === null ? null : creerCourriel(saisie);
    if (courriel?.ok === true) {
      courriels.push(courriel.value);
    } else {
      illisibles += 1;
    }
  }
  return {
    courriels: courriels
      .filter((courriel) => courriel.recuLe >= critere.depuis)
      .sort((a, b) => b.recuLe - a.recuLe)
      .slice(0, critere.limite),
    illisibles,
  };
}

/** Traite les éléments par paquets, pour rester sous les limites de débit des API. */
export async function parPaquets<T, R>(
  elements: readonly T[],
  taille: number,
  traiter: (element: T) => Promise<R>,
): Promise<R[]> {
  const resultats: R[] = [];
  for (let debut = 0; debut < elements.length; debut += taille) {
    resultats.push(...(await Promise.all(elements.slice(debut, debut + taille).map(traiter))));
  }
  return resultats;
}
