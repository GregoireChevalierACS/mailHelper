import type { DonneesDeFiche } from '@mailhelper/application';
import { libelleDeLAttente, messageDAnalyse } from '../messages.js';

const FORMAT_DE_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

interface Proprietes {
  readonly fiche: DonneesDeFiche;
  readonly onRepondre: (fiche: DonneesDeFiche, texte: string) => void;
}

function classeDeLAttente(analyse: DonneesDeFiche['analyse']): string {
  if (!analyse.ok) return 'pastille echec';
  if (analyse.attente.kind === 'aucune') return 'pastille aucune';
  return `pastille attendue ${analyse.attente.urgence}`;
}

export function FicheDeCourriel({ fiche, onRepondre }: Proprietes) {
  const { analyse } = fiche;
  const idDuTitre = `objet-${fiche.id}`;

  return (
    <article className="fiche" aria-labelledby={idDuTitre}>
      <header>
        <h2 id={idDuTitre}>{fiche.objet === '' ? '(sans objet)' : fiche.objet}</h2>
        <p className="meta">
          <span title={fiche.expediteur.adresse}>
            {fiche.expediteur.nom ?? fiche.expediteur.adresse}
          </span>
          {' · '}
          <time dateTime={new Date(fiche.recuLe).toISOString()}>
            {FORMAT_DE_DATE.format(fiche.recuLe)}
          </time>
        </p>
        <span className={classeDeLAttente(analyse)}>{libelleDeLAttente(analyse)}</span>
      </header>

      {analyse.ok ? (
        <>
          <p className="resume">{analyse.resume}</p>
          {analyse.attente.motif !== '' && <p className="motif">{analyse.attente.motif}</p>}
          {analyse.propositions.length > 0 && (
            <div className="propositions" role="group" aria-label="Réponses proposées">
              {analyse.propositions.map((proposition) => (
                <button
                  key={proposition.texte}
                  type="button"
                  className="proposition"
                  onClick={() => {
                    onRepondre(fiche, proposition.texte);
                  }}
                >
                  <span className="intention">{proposition.intention}</span>
                  <span className="texte">{proposition.texte}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="avertissement">{messageDAnalyse(analyse.probleme)}</p>
          <p className="apercu">{fiche.apercu}</p>
        </>
      )}

      <button
        type="button"
        className="secondaire"
        onClick={() => {
          onRepondre(fiche, '');
        }}
      >
        Rédiger ma propre réponse
      </button>
    </article>
  );
}
