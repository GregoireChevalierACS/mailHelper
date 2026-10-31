// Préfixes de réponse des principales messageries : anglais et français (RE, Ré), allemand (AW),
// scandinave (SV), néerlandais (Antw), éventuellement numérotés (« RE[2]: »).
const PREFIXE_DE_REPONSE = /^(?:re|ré|aw|sv|antw)\s*(?:\[\d+\])?\s*:\s*/iu;

/**
 * Objet de la réponse : « RE: » suivi de l'objet d'origine débarrassé de ses préfixes de réponse,
 * pour ne jamais produire « RE: RE: RE: ». Les préfixes de transfert (TR, Fwd) sont conservés,
 * comme le font Outlook et Gmail.
 */
export function objetDeReponse(objet: string): string {
  let reste = objet.trim();
  while (PREFIXE_DE_REPONSE.test(reste)) {
    reste = reste.replace(PREFIXE_DE_REPONSE, '');
  }
  return reste === '' ? 'RE:' : `RE: ${reste}`;
}
