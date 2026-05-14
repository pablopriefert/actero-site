import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  // Browser / React code (frontend) — uses browser globals, JSX, React rules
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]|^motion$',
        argsIgnorePattern: '^_|^[A-Z]',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'react-hooks/refs': 'off',
    },
  },
  // Node.js code (Vercel serverless API, tests, build config) — needs node globals.
  // Without this override every `process`/`Buffer`/`__dirname` reference flags as
  // `no-undef` because the browser bundle config doesn't expose them.
  {
    files: ['api/**/*.js', 'tests/**/*.js', 'vite.config.js', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]|^motion$',
        argsIgnorePattern: '^_|^[A-Z]',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
    },
  },
])
