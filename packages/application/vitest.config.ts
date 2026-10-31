import { defineProject } from 'vitest/config';

// Les tests lisent les sources du domaine (condition d'export « source ») : pas de build préalable.
const conditionsSource = { conditions: ['source'] };

export default defineProject({
  resolve: conditionsSource,
  ssr: { resolve: conditionsSource },
  test: { name: 'application', include: ['src/**/*.test.ts'] },
});
