import type { DonneesDeFiche } from '@mailhelper/application';
import { useState } from 'react';

interface Proprietes {
  readonly fiche: DonneesDeFiche;
  readonly texteInitial: string;
  readonly messagerie: string;
  readonly erreur: string | null;
  readonly enCours: boolean;
  readonly onConfirmer: (texte: string) => void;
  readonly onAnnuler: () => void;
}

/**
 * Dernière étape avant d'ouvrir la messagerie : l'utilisateur voit le destinataire et l'objet,
 * relit et modifie le texte, puis confirme. Rien ne part sans ce clic, et rien n'est envoyé.
 */
export function DialogueDeReponse({
  fiche,
  texteInitial,
  messagerie,
  erreur,
  enCours,
  onConfirmer,
  onAnnuler,
}: Proprietes) {
  const [texte, setTexte] = useState(texteInitial);
  const { a, objet } = fiche.reponse;

  return (
    <div
      className="voile"
      onKeyDown={(evenement) => {
        if (evenement.key === 'Escape') onAnnuler();
      }}
    >
      <div className="dialogue" role="dialog" aria-modal="true" aria-labelledby="titre-du-dialogue">
        <h2 id="titre-du-dialogue">Répondre à {a.nom ?? a.adresse}</h2>
        <dl className="entete-de-reponse">
          <dt>À</dt>
          <dd>{a.nom === null ? a.adresse : `${a.nom} <${a.adresse}>`}</dd>
          <dt>Objet</dt>
          <dd>{objet}</dd>
        </dl>
        <label htmlFor="texte-de-la-reponse">Texte de la réponse</label>
        <textarea
          id="texte-de-la-reponse"
          rows={10}
          autoFocus
          value={texte}
          onChange={(evenement) => {
            setTexte(evenement.target.value);
          }}
        />
        <p className="discret">
          Le texte sera copié dans le presse-papiers et une réponse s’ouvrira dans {messagerie}.
          Vous la relirez avant de l’envoyer vous-même.
        </p>
        {erreur !== null && <p role="alert">{erreur}</p>}
        <div className="actions">
          <button type="button" className="secondaire" onClick={onAnnuler}>
            Annuler
          </button>
          <button
            type="button"
            className="principal"
            disabled={enCours || texte.trim() === ''}
            onClick={() => {
              onConfirmer(texte);
            }}
          >
            {enCours ? 'Ouverture…' : 'Copier et ouvrir la réponse'}
          </button>
        </div>
      </div>
    </div>
  );
}
