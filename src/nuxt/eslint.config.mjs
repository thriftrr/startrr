// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // The codebase style: `function name () {}` and no trailing commas.
    '@stylistic/space-before-function-paren': ['error', 'always'],
    '@stylistic/comma-dangle': ['error', 'never'],
    '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'vue/multi-word-component-names': 'off'
  }
})
