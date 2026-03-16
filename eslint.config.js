import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'replace-colors.js', 'replace-colors.cjs', 'invert-colors.js']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['api/**', 'replace-colors.cjs'],
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
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
    },
  },
  {
    files: ['api/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.node },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
])
