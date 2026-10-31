import { defineConfig } from 'vitest/config';

const TOUT = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default defineConfig({
  test: {
    // Chaque paquet décrit son projet dans son propre vitest.config.ts (réutilisé par Stryker).
    projects: ['packages/*', 'apps/*'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      // Composition roots et pont Electron : vérifiés au lancement de l'application, pas en
      // unitaire (ils ne font que brancher des modules déjà testés).
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/testing/**',
        '**/*.d.ts',
        'apps/desktop/src/main/main.ts',
        'apps/desktop/src/preload/preload.ts',
        'apps/desktop/src/renderer/main.tsx',
      ],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Le domaine décide qui reçoit la réponse et quand en proposer une : rien n'y échappe.
        'packages/domain/src/**': TOUT,
        // La couche application valide ce que renvoie le LLM et orchestre : chaque branche compte.
        'packages/application/src/**': TOUT,
        // Les adapters traduisent Gmail, Graph, Claude et OAuth : chaque branche est un cas réel.
        'apps/desktop/src/main/**': TOUT,
        // L'interface est testée par ses comportements (Testing Library).
        'apps/desktop/src/renderer/**': TOUT,
      },
    },
  },
});
