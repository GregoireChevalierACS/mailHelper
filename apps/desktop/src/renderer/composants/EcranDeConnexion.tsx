import { FOURNISSEURS, type Fournisseur } from '@mailhelper/application';
import { NOM_DE_LA_MESSAGERIE } from '../messages.js';

interface Proprietes {
  readonly enCours: Fournisseur | null;
  readonly erreur: string | null;
  readonly onConnecter: (fournisseur: Fournisseur) => void;
}

export function EcranDeConnexion({ enCours, erreur, onConnecter }: Proprietes) {
  return (
    <main className="connexion">
      <h1>MailHelper</h1>
      <p>
        Résume vos courriels récents, repère ceux qui attendent une réponse et vous en propose. Rien
        n’est jamais envoyé sans vous.
      </p>
      <div className="actions">
        {FOURNISSEURS.map((fournisseur) => (
          <button
            key={fournisseur}
            type="button"
            className="principal"
            disabled={enCours !== null}
            onClick={() => {
              onConnecter(fournisseur);
            }}
          >
            {enCours === fournisseur
              ? `Connexion à ${NOM_DE_LA_MESSAGERIE[fournisseur]}…`
              : `Se connecter à ${NOM_DE_LA_MESSAGERIE[fournisseur]}`}
          </button>
        ))}
      </div>
      {enCours !== null && (
        <p role="status">Terminez la connexion dans la fenêtre de votre navigateur.</p>
      )}
      {erreur !== null && <p role="alert">{erreur}</p>}
      <p className="discret">
        Accès en lecture seule. Le contenu des courriels est transmis au service d’analyse Claude
        (Anthropic) pour être résumé.
      </p>
    </main>
  );
}
