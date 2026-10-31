export {
  creerAdresseCourriel,
  creerCorrespondant,
  partieLocale,
  type AdresseCourriel,
  type Correspondant,
  type ErreurDAdresse,
  type SaisieDeCorrespondant,
} from './AdresseCourriel.js';
export {
  consoliderLAnalyse,
  NOMBRE_MAXIMAL_DE_PROPOSITIONS,
  URGENCES,
  type Analyse,
  type AnalyseProposee,
  type AttenteDeReponse,
  type ErreurDAnalyse,
  type PropositionDeReponse,
  type Urgence,
} from './Analyse.js';
export {
  preparerLeBrouillon,
  type BrouillonDeReponse,
  type ErreurDeBrouillon,
} from './BrouillonDeReponse.js';
export {
  apercu,
  creerCourriel,
  destinataireDeReponse,
  LONGUEUR_MAXIMALE_ANALYSEE,
  texteAAnalyser,
  type Courriel,
  type ErreurDeCourriel,
  type IdDeCourriel,
  type SaisieDeCourriel,
  type TexteAAnalyser,
} from './Courriel.js';
export { estUneAdresseSansLecteur, motifDeNonReponse } from './EnvoiAutomatique.js';
export {
  creerInstant,
  heuresAvant,
  MILLISECONDES_PAR_HEURE,
  type ErreurDInstant,
  type Instant,
} from './Instant.js';
export { objetDeReponse } from './ObjetDeReponse.js';
export { ordonnerParPriorite, rangDePriorite, type CleDeTri } from './Priorite.js';
export { err, ok, type Result } from './Result.js';
