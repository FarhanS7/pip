import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['node_modules/**', 'worker/node_modules/**', 'out/**', 'dist/**', 'release/**', '**/.wrangler/**', 'worker/worker-configuration.d.ts'] },
  {
    files: ['src/**/*.{ts,tsx}', 'worker/src/**/*.ts', 'test/**/*.ts', '*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Existing untyped bridges are replaced in B07/B09/B15. New files stay strict.
    files: ['src/renderer/overlay/App.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error'
    }
  }
)
