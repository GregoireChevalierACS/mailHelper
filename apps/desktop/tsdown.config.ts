import { defineConfig, type UserConfig } from 'tsdown';

// Tout est embarqué dans le livrable, sauf Electron lui-même : l'installeur ne contient alors
// aucun node_modules (voir electron-builder.yml, qui empaquette dist/ seul).
const toutEmbarquer: UserConfig['deps'] = {
  alwaysBundle: [/.*/u],
  neverBundle: ['electron'],
  onlyBundle: false,
};

export default defineConfig([
  {
    entry: { main: 'src/main/main.ts' },
    outDir: 'dist/main',
    format: 'esm',
    platform: 'node',
    deps: toutEmbarquer,
    inputOptions: { resolve: { conditionNames: ['source', 'import', 'default'] } },
    dts: false,
    clean: true,
  },
  {
    // Un preload en bac à sable (sandbox: true) ne peut charger qu'un script CommonJS autonome.
    entry: { preload: 'src/preload/preload.ts' },
    outDir: 'dist/preload',
    format: 'cjs',
    platform: 'node',
    deps: toutEmbarquer,
    dts: false,
    clean: true,
  },
]);
