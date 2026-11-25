import type { SaisieDeCorrespondant } from '@mailhelper/domain';

export interface EnTete {
  readonly name: string;
  readonly value: string;
}

export function valeurDeLEnTete(enTetes: readonly EnTete[], nom: string): string | null {
  const minuscule = nom.toLowerCase();
  return enTetes.find((enTete) => enTete.name.toLowerCase() === minuscule)?.value ?? null;
}

/**
 * Envoi en nombre : lettre d'information (List-Unsubscribe, List-Id), liste de diffusion
 * (Precedence), ou message généré par un automate (Auto-Submitted, RFC 3834).
 */
export function estUneDiffusionDeMasse(enTetes: readonly EnTete[]): boolean {
  if (valeurDeLEnTete(enTetes, 'List-Unsubscribe') !== null) return true;
  if (valeurDeLEnTete(enTetes, 'List-Id') !== null) return true;
  const precedence = valeurDeLEnTete(enTetes, 'Precedence')?.trim().toLowerCase();
  if (precedence === 'bulk' || precedence === 'list' || precedence === 'junk') return true;
  const automatique = valeurDeLEnTete(enTetes, 'Auto-Submitted')?.trim().toLowerCase();
  return automatique !== undefined && automatique !== 'no';
}

/**
 * Premier correspondant d'un en-tête d'adresse : « Claire Martin <claire@exemple.fr> »,
 * « "Martin, Claire" <claire@exemple.fr> » ou « claire@exemple.fr, autre@exemple.fr ».
 * La validité de l'adresse est jugée par le domaine.
 */
export function lireUnCorrespondant(valeur: string): SaisieDeCorrespondant {
  const chevrons = /^\s*("(?:[^"\\]|\\.)*"|[^<]*?)\s*<([^>]*)>/u.exec(valeur);
  if (chevrons === null) {
    const virgule = valeur.indexOf(',');
    return { nom: null, adresse: virgule === -1 ? valeur : valeur.slice(0, virgule) };
  }
  // Les deux groupes participent toujours à une correspondance (le premier peut être vide).
  const brut = String(chevrons[1]);
  const nom = brut.startsWith('"') ? brut.slice(1, -1).replace(/\\(.)/gu, '$1') : brut;
  return { nom: nom === '' ? null : nom, adresse: String(chevrons[2]) };
}
