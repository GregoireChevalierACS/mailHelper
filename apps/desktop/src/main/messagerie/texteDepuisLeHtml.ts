const ENTITES_NOMMEES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  euro: '€',
};

function decoderLesEntites(texte: string): string {
  return texte.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu, (entite, decimal, hexa, nom) => {
    if (typeof decimal === 'string') return String.fromCodePoint(Number(decimal));
    if (typeof hexa === 'string') return String.fromCodePoint(Number.parseInt(hexa, 16));
    return ENTITES_NOMMEES[String(nom).toLowerCase()] ?? entite;
  });
}

/**
 * Texte lisible d'un corps HTML, pour le modèle de langage : ni balises, ni styles, ni scripts.
 * Ce n'est pas un nettoyage de sécurité ; le texte n'est jamais réinjecté dans une page.
 */
export function texteDepuisLeHtml(html: string): string {
  const texte = html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1\s*>/giu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/giu, '\n')
    .replace(/<[^>]*>/gu, '');
  return decoderLesEntites(texte)
    .replace(/[ \t]*\n[ \t]*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}
