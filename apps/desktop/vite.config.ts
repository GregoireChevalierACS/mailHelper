import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  // Chargée en file:// par Electron : chemins relatifs obligatoires.
  base: './',
  plugins: [react()],
  // Les paquets du dépôt sont lus depuis leurs sources TypeScript : pas de build préalable.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
});
