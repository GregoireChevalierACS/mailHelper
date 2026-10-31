// Pont entre la fenêtre isolée et le processus principal : trois appels, rien d'autre. Aucune API
// d'Electron ni de Node n'est exposée à la page.
import { contextBridge, ipcRenderer } from 'electron';
import { CANAUX } from '../canaux.js';

contextBridge.exposeInMainWorld('mailHelper', {
  connecter: (charge: unknown): Promise<unknown> => ipcRenderer.invoke(CANAUX.connecter, charge),
  synthetiser: (charge: unknown): Promise<unknown> =>
    ipcRenderer.invoke(CANAUX.synthetiser, charge),
  repondre: (charge: unknown): Promise<unknown> => ipcRenderer.invoke(CANAUX.repondre, charge),
});
