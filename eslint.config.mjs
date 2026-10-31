import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Ce que le domaine n'a pas le droit d'importer. dependency-cruiser vérifie le graphe complet
// en CI ; cette règle donne le même retour dès l'écriture, dans l'éditeur.
const IMPORTS_INTERDITS_DANS_LE_DOMAINE = [
  {
    group: ['@mailhelper/*', '**/apps/**', '**/application/**'],
    message: 'Le domaine ne dépend de rien : ni de la couche application, ni des apps.',
  },
  {
    group: ['react', 'react-*', 'react/*', 'electron', 'zod', '@anthropic-ai/*'],
    message:
      'Pas de framework, de SDK ni de bibliothèque de validation dans le domaine (ports et adapters).',
  },
  {
    group: ['node:*', 'fs', 'path', 'os', 'crypto', 'process', 'http', 'child_process'],
    message: "Le domaine est pur : pas d'accès au système (il doit aussi tourner dans la fenêtre).",
  },
];

// Le domaine est déterministe : même entrée, même sortie. Le temps passe par le port Horloge.
const SOURCES_DE_NON_DETERMINISME = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'Pas de new Date() dans le domaine : utiliser le port Horloge.',
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Pas de Date.now() dans le domaine : utiliser le port Horloge.',
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'Pas de Math.random() dans le domaine : le résultat doit être reproductible.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/release/**',
      '**/coverage/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Un cast est un mensonge fait au compilateur : interdit, sauf désactivation explicite
      // et justifiée (voir eslint-comments/require-description).
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: IMPORTS_INTERDITS_DANS_LE_DOMAINE }],
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SOURCES_DE_NON_DETERMINISME],
    },
  },
  {
    // Fenêtre : règles des hooks React, et aucun accès à Node ni à Electron (le pont passe
    // exclusivement par le preload).
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'node:*', '**/main/**', '**/preload/**', '@anthropic-ai/*'],
              message:
                'La fenêtre est isolée : elle ne parle au processus principal que par window.mailHelper.',
            },
          ],
        },
      ],
    },
  },
  {
    // Fichiers de configuration et scripts en JavaScript : pas de typage à exploiter.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
