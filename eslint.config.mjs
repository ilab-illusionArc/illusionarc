// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/.vercel/**',
      '**/coverage/**'
    ]
  },

  {
    rules: {
      /* ---------------- General ---------------- */
      'no-debugger': 'warn',
      'no-alert': 'warn',

      // Allow console (you can change to 'warn' if you want)
      'no-console': 'off',

      // Prefer const when possible
      'prefer-const': 'warn',

      // Don’t block builds because of unused vars, but warn
      // Allow unused vars/args if they start with "_"
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      /* ---------------- TypeScript (if enabled by Nuxt ESLint) ---------------- */
      // Prefer TS version of unused-vars when present
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],

      // Keep this off because TS already covers many cases and it can be noisy in Nuxt
      '@typescript-eslint/no-explicit-any': 'off',

      // Useful safety checks (not too strict)
      '@typescript-eslint/no-non-null-assertion': 'off',

      /* ---------------- Vue ---------------- */
      // Allow single-word component names (Nuxt pages/components often use this)
      'vue/multi-word-component-names': 'off',

      // In Vue templates, unused vars can happen (slots, v-for aliases, etc.)
      'vue/no-unused-vars': 'warn',

      // Common Nuxt/Vue patterns
      'vue/no-mutating-props': 'warn',
      'vue/require-default-prop': 'off',
      'vue/require-prop-types': 'off',

      // Prevent weird template issues
      'vue/no-parsing-error': 'error'
    }
  }
)
