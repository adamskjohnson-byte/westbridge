import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// ESLint checks TypeScript source using the supported flat configuration.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
)