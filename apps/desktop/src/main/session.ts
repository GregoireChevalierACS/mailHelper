import {
  creerLesCasDUsage,
  type Analyseur,
  type BoiteDeReception,
  type CasDUsage,
  type Fournisseur,
  type Horloge,
  type OuvreurDeReponse,
  type PressePapiers,
  type ResultatDeConnexion,
} from '@mailhelper/application';

/** Ce qu'une messagerie apporte une fois l'utilisateur connecté : de quoi lire, de quoi répondre. */
export interface MessagerieConnectee {
  readonly boite: BoiteDeReception;
  readonly ouvreur: OuvreurDeReponse;
}

/** Connexion à une messagerie ; `null` quand elle n'est pas configurée sur ce poste. */
export type Connecteur = (() => Promise<MessagerieConnectee>) | null;

export interface DependancesDeLaSession {
  readonly connecteurs: Readonly<Record<Fournisseur, Connecteur>>;
  readonly analyseur: Analyseur;
  readonly pressePapiers: PressePapiers;
  readonly horloge: Horloge;
}

/** État de l'application : déconnectée, puis branchée sur une messagerie choisie par l'utilisateur. */
export function creerLaSession(dependances: DependancesDeLaSession) {
  let casDUsage: CasDUsage | null = null;

  return {
    async connecter(fournisseur: Fournisseur): Promise<ResultatDeConnexion> {
      const connecteur = dependances.connecteurs[fournisseur];
      if (connecteur === null) return { ok: false, probleme: 'configuration-incomplete' };
      let messagerie: MessagerieConnectee;
      try {
        messagerie = await connecteur();
      } catch {
        return { ok: false, probleme: 'connexion-refusee' };
      }
      casDUsage = creerLesCasDUsage({ ...dependances, ...messagerie });
      return { ok: true, fournisseur };
    },

    casDUsage(): CasDUsage | null {
      return casDUsage;
    },
  };
}

export type Session = ReturnType<typeof creerLaSession>;
