// Composition root de la fenêtre : branche l'interface sur l'API exposée par le preload.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { creerLePont, type ApiDuPreload } from './pont.js';
import './styles.css';

declare global {
  interface Window {
    readonly mailHelper: ApiDuPreload;
  }
}

const racine = document.getElementById('racine');
if (racine === null) throw new Error('élément #racine introuvable dans index.html');

createRoot(racine).render(
  <StrictMode>
    <App pont={creerLePont(window.mailHelper)} />
  </StrictMode>,
);
