/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  ignorePatterns: ['coverage/**', 'dist/**'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'import/order': [
      'warn',
      {
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always',
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
      },
    ],
    'unused-imports/no-unused-imports': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // Type safety guardrails (warn = signal sans bloquer CI sur code existant)
    '@typescript-eslint/consistent-type-imports': ['warn', {
      prefer: 'type-imports',
      fixStyle: 'separate-type-imports'
    }],
    '@typescript-eslint/no-explicit-any': ['warn', {
      ignoreRestArgs: false,
      fixToUnknown: false
    }],
    '@typescript-eslint/ban-ts-comment': 'warn', // Prefer @ts-expect-error over @ts-ignore
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/rules-of-hooks': 'warn', // Hooks rules (conditionals)
    'react-refresh/only-export-components': 'warn', // HMR best practices
    'no-empty': 'warn',
  },
  overrides: [
    {
      // E2E tests: allow 'any' for Playwright page.evaluate() which lacks proper typing
      files: ['**/e2e/**/*.ts', '**/e2e/**/*.spec.ts', 'e2e/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
      }
    },
    {
      // Unit tests: allow some flexibility for test helpers and fixtures
      files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx', 'tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error
        '@typescript-eslint/no-unused-vars': 'warn',  // Warn instead of error (test code)
      }
    },
    {
      // Library boundaries: WASM/Web Worker/Debug interfaces lack proper types
      files: [
        'src/core/booleans/pathopsAdapter.ts',  // PathKit WASM module (no types)
        'src/core/geo/facade.ts',               // Web Worker communication (any)
        'src/lib/debug/pipelineTrace.ts',       // Debug window.__debugGap (any)
        'src/lib/env.ts',                       // window.import.meta.env (any)
        'src/lib/featureFlags.ts',              // localStorage feature flags (any)
        'src/lib/spatial/indexRBush.ts',        // RBush library (partial types)
        'src/main.tsx',                         // Bootstrap + window globals (any)
        'src/setupTests.ts',                    // Test setup mocks (any)
        'src/sync/bridge.ts',                   // postMessage API (any)
        'src/workers/**/*.ts'                   // Web Workers (any)
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Warn but document (see PR template)
      }
    },
    {
      // State management: legacy disabled features use 'as any' with comments
      files: ['src/state/useSceneStore.ts', 'src/state/ui.guards.ts', 'src/state/ui.types.ts', 'src/store/editorStore.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Justified with inline comments
      }
    },
    {
      // Main app: widening for ResizeHandle union acceptance
      files: ['src/App.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn', // Documented (string & {}) union pattern
      }
    }
  ]
};
