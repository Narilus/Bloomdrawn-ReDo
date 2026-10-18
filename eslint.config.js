import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import globals from 'globals';

// Import boundaries from docs/ARCHITECTURE.md ("Project layout"). Each folder lists
// what it may NOT import; arrows only point inward toward the engine.
const forbid = (target, ...from) => ({
  target: `./src/${target}`,
  from: from.map((f) => (f === 'tools' ? './tools' : `./src/${f}`)),
  message: `${target} must not import from ${from.join(', ')} (see docs/ARCHITECTURE.md).`,
});
const boundaryZones = [
  forbid('engine', 'game', 'content', 'stage', 'app', 'save', 'tools'),
  forbid('game', 'content', 'stage', 'app', 'save', 'tools'),
  forbid('content', 'game', 'stage', 'app', 'save', 'tools'),
  forbid('save', 'content', 'stage', 'app', 'tools'),
];

// Pure folders: deterministic, no browser or clock access, randomness only from seeded streams.
const pureGlobals = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'performance', 'crypto', 'Date',
].map((name) => ({ name, message: 'Pure code must not use ambient browser, clock or random inputs.' }));

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'coverage', 'reference'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { zones: boundaryZones }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/engine/**', 'src/game/**', 'src/content/**'],
    rules: {
      'no-restricted-globals': ['error', ...pureGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use a named seeded stream from state.' },
      ],
    },
  },
  {
    files: ['src/app/**/*.tsx', 'src/stage/**/*.tsx', 'tools/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
