import type { Fournisseur } from '@mailhelper/application';
import { useState } from 'react';
import { Boite } from './composants/Boite.js';
import { EcranDeConnexion } from './composants/EcranDeConnexion.js';
import { MESSAGE_DE_PANNE, messageDeConnexion } from './messages.js';
import type { Pont } from './pont.js';

export function App({ pont }: { readonly pont: Pont }) {
  const [connecte, setConnecte] = useState<Fournisseur | null>(null);
  const [enCours, setEnCours] = useState<Fournisseur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function connecter(fournisseur: Fournisseur) {
    setEnCours(fournisseur);
    setErreur(null);
    try {
      const resultat = await pont.connecter(fournisseur);
      if (resultat.ok) {
        setConnecte(resultat.fournisseur);
      } else {
        setErreur(messageDeConnexion(resultat.probleme));
      }
    } catch {
      setErreur(MESSAGE_DE_PANNE);
    }
    setEnCours(null);
  }

  if (connecte !== null) return <Boite pont={pont} fournisseur={connecte} />;
  return (
    <EcranDeConnexion
      enCours={enCours}
      erreur={erreur}
      onConnecter={(fournisseur) => {
        void connecter(fournisseur);
      }}
    />
  );
}
