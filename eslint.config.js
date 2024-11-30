// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    rules: {
      'no-undef': 'error',
      'no-console': 'warn',
      'style/object-property-newline': ['error', {
        allowMultiplePropertiesPerLine: false,
      }],
      'style/object-curly-newline': ['error', {
        consistent: false,
        minProperties: 1,
      }],
      'antfu/consistent-list-newline': ['warn'],
      'style/newline-per-chained-call': ['error'],
      'style/max-statements-per-line': ['warn'],
      'style/one-var-declaration-per-line': ['error'],
      'style/indent': ['error', 2],
      'unused-imports/no-unused-imports': 'error',
    },
    formatters: true,
  },
)
