import { fixupPluginRules } from '@eslint/compat';
import importPlugin from 'eslint-plugin-import';
import n from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import globals from 'globals';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

/**
 * ESLint Flat Config for wolf-dice-bot
 *
 * This config is optimized for:
 * - Node.js backend (wolf.live chat bot)
 * - ES Modules (ESM)
 * - Async/await patterns
 * - MongoDB/Mongoose usage
 *
 * Plugin purposes:
 * - eslint-plugin-n: Node.js-specific rules (deprecated APIs, path handling)
 * - eslint-plugin-import: Import/export validation and organization
 * - eslint-plugin-promise: Async/Promise best practices
 */
export default [
  // Ignore patterns
  {
    ignores: ['node_modules/**', 'mongo_init/**']
  },

  // Main configuration
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },

    plugins: {
      import: fixupPluginRules(importPlugin),
      n,
      promise
    },

    rules: {
      // ═══════════════════════════════════════════════════════════════════
      // ERROR PREVENTION - Catch bugs before runtime
      // ═══════════════════════════════════════════════════════════════════

      // Prevent accidental globals (like missing `const` in create.js:7)
      'no-undef': 'error',

      // Disallow unused variables (clean code)
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ],

      // Require const/let, prevent implicit globals
      'no-var': 'error',

      // Prefer const when variable is never reassigned
      'prefer-const': 'error',

      // Prevent reassigning function parameters
      'no-param-reassign': ['error', { props: false }],

      // Prevent accidental comparisons to self
      'no-self-compare': 'error',

      // Catch unreachable code
      'no-unreachable': 'error',

      // Detect invalid typeof comparisons
      'valid-typeof': 'error',

      // Prevent duplicate keys in objects
      'no-dupe-keys': 'error',

      // Require super() in constructors
      'constructor-super': 'error',

      // ═══════════════════════════════════════════════════════════════════
      // ASYNC/PROMISE SAFETY - Critical for this async-heavy codebase
      // ═══════════════════════════════════════════════════════════════════

      // Require return in Promise executors
      'no-async-promise-executor': 'error',

      // Prevent await inside loops (usually inefficient)
      // Disabled: This bot legitimately uses await in loops for game flow
      // "no-await-in-loop": "off",

      // Disallow returning await (redundant)
      'no-return-await': 'error',

      // promise plugin rules
      'promise/param-names': 'error',
      'promise/no-return-wrap': 'error',
      'promise/always-return': 'off', // Too strict for event handlers
      'promise/catch-or-return': 'off', // We use try/catch instead
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-new-statics': 'error',

      // ═══════════════════════════════════════════════════════════════════
      // NODE.JS SPECIFIC - From eslint-plugin-n
      // ═══════════════════════════════════════════════════════════════════

      // Ensure callback errors are handled
      'n/handle-callback-err': ['error', '^(err|error)$'],

      // Prevent deprecated Node.js APIs
      'n/no-deprecated-api': 'error',

      // Prevent string concatenation with __dirname (use path.join)
      'n/no-path-concat': 'error',

      // Treat process.exit() as throw (for control flow analysis)
      'n/process-exit-as-throw': 'error',

      // Prevent sync methods in async context (performance)
      'n/no-sync': 'warn',

      // These are for CommonJS - keeping for migration period
      'n/no-exports-assign': 'error',
      'n/no-new-require': 'error',
      'n/no-callback-literal': 'error',

      // ═══════════════════════════════════════════════════════════════════
      // IMPORT/EXPORT - Module organization
      // ═══════════════════════════════════════════════════════════════════

      // Prevent invalid exports
      'import/export': 'error',

      // Imports should come first
      'import/first': 'error',

      // No duplicate imports from same module
      'import/no-duplicates': 'error',

      // Prevent absolute paths in imports
      'import/no-absolute-path': 'error',

      // Warn on unresolved imports (helps catch typos)
      'import/no-unresolved': 'off', // Disabled: struggles with wolf.js

      // ═══════════════════════════════════════════════════════════════════
      // CODE STYLE - Minimal rules (let Prettier handle formatting)
      // ═══════════════════════════════════════════════════════════════════

      // Enforce strict equality (except for null checks)
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Require curly braces for multi-line blocks
      curly: ['error', 'multi-line'],

      // Prefer dot notation (obj.prop over obj['prop'])
      'dot-notation': 'error',

      // Use object shorthand where possible
      'object-shorthand': ['warn', 'properties'],

      // Consistent array callbacks (return in map/filter/etc)
      'array-callback-return': ['error', { allowImplicit: false }],

      // Default case should be last in switch
      'default-case-last': 'error',

      // Prefer template literals over string concatenation
      'prefer-template': 'warn',

      // Use camelCase naming
      camelcase: [
        'warn',
        {
          properties: 'never',
          ignoreGlobals: true,
          allow: ['^UNSAFE_']
        }
      ]
    }
  },
  prettierRecommended
];
