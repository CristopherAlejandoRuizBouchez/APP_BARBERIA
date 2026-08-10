// ESLint flat config.
// Next 16 eliminó el comando `next lint`; se usa el CLI de ESLint directamente.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'src/lib/supabase/tipos-db.ts', // generado por la CLI de Supabase
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // Los importes de entorno deben pasar por lib/env.ts, que los valida.
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'No leas process.env directamente. Importa `env` desde @/lib/env, que lo valida con Zod.',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // lib/env.ts es el único lugar autorizado para leer process.env.
  // env-parseo.ts NO lo lee: recibe un objeto plano, por eso se puede probar.
  {
    files: ['src/lib/env.ts', '*.config.{ts,mjs,js}', 'e2e/**'],
    rules: { 'no-restricted-properties': 'off' },
  },

  prettierConfig
);
