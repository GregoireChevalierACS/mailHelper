import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

const conditionsSource = { conditions: ['source'] };

export default defineProject({
  plugins: [react()],
  resolve: conditionsSource,
  ssr: { resolve: conditionsSource },
  test: {
    name: 'desktop',
    // Processus principal en Node ; les tests de la fenêtre déclarent jsdom en tête de fichier.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testing/preparation.ts'],
  },
});
