import { partieLocale, type AdresseCourriel } from './AdresseCourriel.js';
import { destinataireDeReponse, type Courriel } from './Courriel.js';

// Parties locales des boîtes qui ne lisent pas les réponses, avec ou sans séparateur et suffixe
// (« no-reply », « noreply+factures », « ne_pas_repondre »…).
const BOITE_SANS_LECTEUR =
  /^(?:no|do[-_.]?not|ne[-_.]?pas)[-_.]?(?:reply|repondre|répondre)(?:[-_.+].*)?$|^(?:mailer[-_.]?daemon|postmaster|bounces?|notifications?)(?:[-_.+].*)?$/iu;

export const estUneAdresseSansLecteur = (adresse: AdresseCourriel): boolean =>
  BOITE_SANS_LECTEUR.test(partieLocale(adresse));

/**
 * Règle déterministe qui l'emporte sur l'avis du modèle de langage : un courriel qui la satisfait
 * n'attend jamais de réponse, quoi qu'en dise le LLM.
 */
interface RegleDeNonReponse {
  readonly concerne: (courriel: Courriel) => boolean;
  readonly motif: string;
}

const REGLES: readonly RegleDeNonReponse[] = [
  {
    concerne: (courriel) => estUneAdresseSansLecteur(destinataireDeReponse(courriel).adresse),
    motif: "Envoi automatique : l'adresse de réponse n'est lue par personne.",
  },
  {
    concerne: (courriel) => courriel.diffusionDeMasse,
    motif: "Envoi en nombre (lettre d'information, notification) : aucune réponse attendue.",
  },
];

/** Motif de la première règle qui exclut toute réponse, ou `null` si la décision revient au modèle. */
export function motifDeNonReponse(courriel: Courriel): string | null {
  return REGLES.find((regle) => regle.concerne(courriel))?.motif ?? null;
}
