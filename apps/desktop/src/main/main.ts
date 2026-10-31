// Composition root du processus principal : branche Electron, le système et les adapters testés.
// Seul fichier (avec le preload) autorisé à importer Electron (règle electron-confine).
import Anthropic from '@anthropic-ai/sdk';
import type { Fournisseur } from '@mailhelper/application';
import { creerInstant } from '@mailhelper/domain';
import { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CANAUX, type Canal } from '../canaux.js';
import { lireLaConfiguration, type Configuration } from './configuration.js';
import { creerLaBoiteGmail } from './gmail/boiteGmail.js';
import { creerLesGestionnaires } from './ipc.js';
import { creerLAnalyseurClaude } from './llm/analyseurClaude.js';
import { creerUnCoffreChiffre } from './oauth/coffreChiffre.js';
import type { DependancesOAuth } from './oauth/connexionOAuth.js';
import { fournisseurGoogle, fournisseurMicrosoft } from './oauth/fournisseurs.js';
import { creerUneSessionOAuth } from './oauth/sessionOAuth.js';
import { creerUnOuvreur, lienDeRedactionGmail, lienMailto } from './ouverture/ouvreurs.js';
import { creerLaBoiteOutlook } from './outlook/boiteOutlook.js';
import { creerLaSession, type Connecteur } from './session.js';

const ICI = dirname(fileURLToPath(import.meta.url));
const DOSSIER_DE_LA_FENETRE = join(ICI, '..', 'renderer');

function cheminDuFichierDeConfiguration(): string {
  return join(app.getPath('userData'), 'mailhelper.env');
}

function lireLeFichierDeConfiguration(): Configuration | null {
  try {
    process.loadEnvFile(cheminDuFichierDeConfiguration());
  } catch {
    // Fichier absent : la configuration peut venir des seules variables d'environnement.
  }
  const configuration = lireLaConfiguration(process.env);
  if (configuration.ok) return configuration.value;
  dialog.showErrorBox(
    'MailHelper : configuration incomplète',
    `Variables manquantes ou invalides : ${configuration.error.variables.join(', ')}.\n\n` +
      `Renseignez-les dans ${cheminDuFichierDeConfiguration()} (modèle : .env.example).`,
  );
  return null;
}

const dependancesOAuth: DependancesOAuth = {
  fetch,
  ouvrirLeNavigateur: (url) => shell.openExternal(url),
  maintenant: () => Date.now(),
};

function coffre(fournisseur: Fournisseur) {
  const chemin = join(app.getPath('userData'), `jetons-${fournisseur}.bin`);
  return creerUnCoffreChiffre({
    chiffrer: (texte) => safeStorage.encryptStringAsync(texte),
    // Après une rotation de clé (shouldReEncrypt), le prochain renouvellement réécrit le fichier.
    dechiffrer: async (octets) => (await safeStorage.decryptStringAsync(octets)).result,
    lireLeFichier: () => readFile(chemin).catch(() => null),
    ecrireLeFichier: (octets) => writeFile(chemin, octets),
  });
}

function connecteurs(configuration: Configuration): Record<Fournisseur, Connecteur> {
  const ouvrirUnLien = (url: string) => shell.openExternal(url);
  const { google, microsoft } = configuration;
  return {
    gmail:
      google === null
        ? null
        : async () => {
            const session = creerUneSessionOAuth(
              fournisseurGoogle(google),
              coffre('gmail'),
              dependancesOAuth,
            );
            await session.jeton();
            return {
              boite: creerLaBoiteGmail({ fetch, jeton: () => session.jeton() }),
              ouvreur: creerUnOuvreur(lienDeRedactionGmail, ouvrirUnLien),
            };
          },
    outlook:
      microsoft === null
        ? null
        : async () => {
            const session = creerUneSessionOAuth(
              fournisseurMicrosoft(microsoft),
              coffre('outlook'),
              dependancesOAuth,
            );
            await session.jeton();
            return {
              boite: creerLaBoiteOutlook({ fetch, jeton: () => session.jeton() }),
              // mailto : ouvre la messagerie par défaut du poste, Outlook en général.
              ouvreur: creerUnOuvreur(lienMailto, ouvrirUnLien),
            };
          },
  };
}

function demarrer(configuration: Configuration): void {
  const client = new Anthropic({ apiKey: configuration.anthropic.cleDApi });
  const session = creerLaSession({
    connecteurs: connecteurs(configuration),
    analyseur: creerLAnalyseurClaude((parametres) => client.beta.messages.create(parametres), {
      modele: configuration.anthropic.modele,
      effort: configuration.anthropic.effort,
    }),
    pressePapiers: { copier: (texte) => clipboard.writeText(texte) },
    horloge: {
      maintenant: () => {
        const instant = creerInstant(Date.now());
        if (!instant.ok) throw new Error('horloge système invalide');
        return instant.value;
      },
    },
  });

  const gestionnaires = creerLesGestionnaires(session);
  const origineDeLaFenetre = pathToFileURL(DOSSIER_DE_LA_FENETRE).href;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.keys perd le type des clés d'un objet littéral figé
  for (const canal of Object.keys(CANAUX) as Canal[]) {
    ipcMain.handle(CANAUX[canal], (evenement, charge: unknown) => {
      // Seule notre propre page peut appeler le processus principal.
      if (evenement.senderFrame?.url.startsWith(origineDeLaFenetre) !== true) {
        throw new Error('expéditeur non autorisé');
      }
      return gestionnaires[canal](charge);
    });
  }

  const fenetre = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 500,
    title: 'MailHelper',
    show: false,
    webPreferences: {
      preload: join(ICI, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  fenetre.removeMenu();
  // La fenêtre n'ouvre rien et ne quitte jamais sa page : un lien piégé dans un courriel reste inerte.
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  fenetre.webContents.on('will-navigate', (evenement) => {
    evenement.preventDefault();
  });
  fenetre.once('ready-to-show', () => {
    fenetre.show();
  });
  void fenetre.loadFile(join(DOSSIER_DE_LA_FENETRE, 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('window-all-closed', () => {
    app.quit();
  });
  void app.whenReady().then(() => {
    const configuration = lireLeFichierDeConfiguration();
    if (configuration === null) {
      app.quit();
      return;
    }
    demarrer(configuration);
  });
}
