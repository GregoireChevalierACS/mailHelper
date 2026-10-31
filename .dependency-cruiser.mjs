// Règles d'architecture vérifiées en CI sur le graphe complet des dépendances.
// ESLint (no-restricted-imports) ne voit qu'un fichier à la fois ; ici, on voit les cycles et les
// dépendances transitives.

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'domaine-pur',
      comment:
        'Le domaine ne dépend que de lui-même : ni paquet npm, ni module Node, ni autre paquet du dépôt.',
      severity: 'error',
      // Les tests, eux, ont droit à leurs outils (vitest, fast-check).
      from: { path: '^packages/domain/src', pathNot: '\\.test\\.tsx?$|/testing/' },
      to: {
        pathNot: '^packages/domain/src',
      },
    },
    {
      name: 'application-sans-infrastructure',
      comment:
        "La couche application ne connaît que le domaine. Les adapters (Gmail, Graph, Claude, fenêtre) dépendent d'elle, pas l'inverse.",
      severity: 'error',
      from: { path: '^packages/application/src', pathNot: '\\.test\\.tsx?$|/testing/' },
      to: {
        // zod décrit le contrat d'échange (réponse du LLM, messages entre processus) : seule
        // bibliothèque autorisée ici, choisie explicitement (ADR 0004).
        pathNot: ['^packages/application/src', '^packages/domain/src', 'node_modules/zod/'],
      },
    },
    {
      name: 'api-publique-seulement',
      comment:
        "Un paquet n'importe un autre paquet du dépôt que par ses points d'entrée (index.ts, et testing/index.ts réservé aux tests), jamais par ses fichiers internes.",
      severity: 'error',
      from: { path: '^(packages|apps)/([^/]+)/' },
      to: {
        path: '^packages/([^/]+)/src/(?!(testing/)?index\\.ts$)',
        pathNot: '^packages/$2/',
      },
    },
    {
      name: 'llm-confine',
      comment: "Seul l'adapter llm du processus principal parle au modèle de langage.",
      severity: 'error',
      from: { pathNot: '^apps/desktop/src/main/(llm/|main\\.ts$)' },
      to: { path: 'node_modules/@anthropic-ai/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'electron-confine',
      comment:
        "Electron n'est touché que par les composition roots (main.ts, preload.ts) : les adapters reçoivent ce dont ils ont besoin par injection, et restent testables.",
      severity: 'error',
      from: { pathNot: '^apps/desktop/src/(main/main|preload/preload)\\.ts$' },
      to: { path: '^electron$|node_modules/electron/' },
    },
    {
      name: 'fenetre-isolee',
      comment:
        "La fenêtre tourne isolée (contextIsolation, sandbox) : elle n'importe ni le processus principal, ni le preload, ni Node.",
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer', pathNot: '\\.test\\.tsx?$|/testing/' },
      to: {
        path: '^apps/desktop/src/(main|preload)/|^node:|^(fs|path|os|crypto|child_process|http)$',
      },
    },
    {
      name: 'pas-de-cycle',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'production-independante-des-tests',
      comment: 'Le code livré ne doit jamais importer un fichier de test ou une fixture.',
      severity: 'error',
      from: { pathNot: '\\.test\\.tsx?$|/testing/' },
      to: { path: '\\.test\\.tsx?$|/testing/' },
    },
    {
      name: 'production-sans-dependance-de-dev',
      comment:
        'Exception : Electron est une dépendance de développement par construction (electron-builder fournit lui-même son exécutable au livrable).',
      severity: 'error',
      from: { path: '^(packages|apps)/[^/]+/src', pathNot: '\\.test\\.tsx?$|/testing/' },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: '^electron$|node_modules/electron/',
      },
    },
    {
      name: 'pas-de-fourre-tout',
      comment:
        'Pas de fichier utils, helpers ou common : un nom vague cache une responsabilité mal définie.',
      severity: 'error',
      from: {},
      // Seulement notre code : les paquets npm nomment leurs dossiers comme ils l'entendent.
      to: { path: '/(utils?|helpers?|common|misc)(\\.ts|/)', pathNot: 'node_modules/' },
    },
    {
      name: 'pas-d-orphelin',
      comment: "Un module que personne n'importe est du code mort.",
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.test\\.tsx?$',
          '\\.config\\.(ts|mjs)$',
          '/index\\.ts$',
          '\\.d\\.ts$',
          '/main\\.tsx?$',
          '/preload\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|release|coverage|reports|\\.stryker-tmp)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      // Mêmes conditions que les tests : un paquet du dépôt se résout vers ses sources.
      conditionNames: ['source', 'import', 'types', 'default'],
      exportsFields: ['exports'],
    },
  },
};
