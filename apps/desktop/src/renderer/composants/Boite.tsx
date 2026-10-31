import type { DonneesDeFiche, Fournisseur, ResultatDeSynthese } from '@mailhelper/application';
import { useEffect, useState } from 'react';
import {
  MESSAGE_DE_PANNE,
  messageDeReponse,
  messageDeSynthese,
  NOM_DE_LA_MESSAGERIE,
} from '../messages.js';
import type { Pont } from '../pont.js';
import { DialogueDeReponse } from './DialogueDeReponse.js';
import { FicheDeCourriel } from './FicheDeCourriel.js';

export const FENETRES = [
  { heures: 8, libelle: '8 dernières heures' },
  { heures: 24, libelle: '24 dernières heures' },
  { heures: 72, libelle: '3 derniers jours' },
  { heures: 168, libelle: '7 derniers jours' },
] as const;

export const LIMITE = 30;

/** Une demande de synthèse : chaque actualisation en crée une nouvelle, même à période égale. */
interface Demande {
  readonly fenetreEnHeures: number;
  readonly numero: number;
}

type Synthese =
  | { readonly kind: 'chargement' }
  | { readonly kind: 'resultat'; readonly resultat: ResultatDeSynthese }
  | { readonly kind: 'panne' };

/** Synthèse reçue, avec la demande à laquelle elle répond. */
interface Recue {
  readonly demande: Demande;
  readonly synthese: Synthese;
}

interface Reponse {
  readonly fiche: DonneesDeFiche;
  readonly texteInitial: string;
  readonly enCours: boolean;
  readonly erreur: string | null;
}

interface Proprietes {
  readonly pont: Pont;
  readonly fournisseur: Fournisseur;
}

function Contenu({
  synthese,
  onRepondre,
}: {
  readonly synthese: Synthese;
  readonly onRepondre: (fiche: DonneesDeFiche, texte: string) => void;
}) {
  if (synthese.kind === 'chargement') {
    return <p role="status">Lecture et résumé des courriels…</p>;
  }
  if (synthese.kind === 'panne') return <p role="alert">{MESSAGE_DE_PANNE}</p>;
  const { resultat } = synthese;
  if (!resultat.ok) return <p role="alert">{messageDeSynthese(resultat.probleme)}</p>;

  const attendues = resultat.fiches.filter(
    (f) => f.analyse.ok && f.analyse.attente.kind === 'attendue',
  );
  return (
    <>
      <p role="status">
        {resultat.fiches.length === 0
          ? 'Aucun courriel sur cette période.'
          : `${String(resultat.fiches.length)} courriel(s), dont ${String(attendues.length)} attendent une réponse.`}
        {resultat.illisibles > 0 &&
          ` ${String(resultat.illisibles)} courriel(s) illisible(s) ignoré(s).`}
      </p>
      <div className="fiches">
        {resultat.fiches.map((fiche) => (
          <FicheDeCourriel key={fiche.id} fiche={fiche} onRepondre={onRepondre} />
        ))}
      </div>
    </>
  );
}

export function Boite({ pont, fournisseur }: Proprietes) {
  const [demande, setDemande] = useState<Demande>({ fenetreEnHeures: 24, numero: 0 });
  const [recue, setRecue] = useState<Recue | null>(null);
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Le chargement se déduit : la dernière synthèse reçue ne répond pas à la demande en cours.
  // Une réponse tardive à une demande périmée est ignorée, au lieu d'écraser la plus récente.
  const synthese: Synthese = recue?.demande === demande ? recue.synthese : { kind: 'chargement' };

  useEffect(() => {
    let actuelle = true;
    pont.synthetiser({ fenetreEnHeures: demande.fenetreEnHeures, limite: LIMITE }).then(
      (resultat) => {
        if (actuelle) setRecue({ demande, synthese: { kind: 'resultat', resultat } });
      },
      () => {
        if (actuelle) setRecue({ demande, synthese: { kind: 'panne' } });
      },
    );
    return () => {
      actuelle = false;
    };
  }, [pont, demande]);

  async function confirmer(reponse: Reponse, texte: string) {
    setReponse({ ...reponse, enCours: true, erreur: null });
    try {
      const resultat = await pont.repondre({ idDuCourriel: reponse.fiche.id, texte });
      if (resultat.ok) {
        setReponse(null);
        setConfirmation(
          `Réponse à ${reponse.fiche.reponse.a.adresse} ouverte dans ${NOM_DE_LA_MESSAGERIE[fournisseur]}. Le texte est aussi dans le presse-papiers (Ctrl+V).`,
        );
      } else {
        setReponse({ ...reponse, enCours: false, erreur: messageDeReponse(resultat.probleme) });
      }
    } catch {
      setReponse({ ...reponse, enCours: false, erreur: MESSAGE_DE_PANNE });
    }
  }

  return (
    <main className="boite">
      <header className="barre">
        <h1>Courriels récents · {NOM_DE_LA_MESSAGERIE[fournisseur]}</h1>
        <label>
          Période{' '}
          <select
            value={demande.fenetreEnHeures}
            onChange={(evenement) => {
              setDemande({
                fenetreEnHeures: Number(evenement.target.value),
                numero: demande.numero + 1,
              });
            }}
          >
            {FENETRES.map((fenetre) => (
              <option key={fenetre.heures} value={fenetre.heures}>
                {fenetre.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondaire"
          disabled={synthese.kind === 'chargement'}
          onClick={() => {
            setDemande({ ...demande, numero: demande.numero + 1 });
          }}
        >
          Actualiser
        </button>
      </header>

      {confirmation !== null && (
        <p className="confirmation" role="status">
          {confirmation}
        </p>
      )}

      <Contenu
        synthese={synthese}
        onRepondre={(fiche, texte) => {
          setConfirmation(null);
          setReponse({ fiche, texteInitial: texte, enCours: false, erreur: null });
        }}
      />

      {reponse !== null && (
        <DialogueDeReponse
          fiche={reponse.fiche}
          texteInitial={reponse.texteInitial}
          messagerie={NOM_DE_LA_MESSAGERIE[fournisseur]}
          erreur={reponse.erreur}
          enCours={reponse.enCours}
          onConfirmer={(texte) => {
            void confirmer(reponse, texte);
          }}
          onAnnuler={() => {
            setReponse(null);
          }}
        />
      )}
    </main>
  );
}
