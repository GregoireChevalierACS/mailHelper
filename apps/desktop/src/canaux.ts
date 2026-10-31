// Noms des canaux IPC, partagés par le processus principal et le preload. Fichier sans aucune
// dépendance : le preload en bac à sable doit rester minuscule.
export const CANAUX = {
  connecter: 'mailhelper:connecter',
  synthetiser: 'mailhelper:synthetiser',
  repondre: 'mailhelper:repondre',
} as const;

export type Canal = keyof typeof CANAUX;
