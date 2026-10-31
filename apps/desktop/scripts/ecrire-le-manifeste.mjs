// Écrit dist/package.json, le seul manifeste empaqueté par electron-builder (directories.app).
// Tout le code est déjà embarqué par tsdown et vite : ce manifeste ne déclare aucune dépendance,
// et l'installeur ne contient donc aucun node_modules.
import { readFile, writeFile } from 'node:fs/promises';

const source = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const manifeste = {
  name: 'mailhelper',
  productName: 'MailHelper',
  version: source.version,
  description: source.description,
  author: source.author,
  type: 'module',
  main: 'main/main.mjs',
};

await writeFile(
  new URL('../dist/package.json', import.meta.url),
  `${JSON.stringify(manifeste, null, 2)}\n`,
);
