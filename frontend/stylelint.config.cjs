module.exports = {
  ignoreFiles: ['**/node_modules/**', '**/dist/**'],
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-order'],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'order/properties-order': [
      [
        'display',
        'flex-direction',
        'justify-content',
        'align-items',
        'width',
        'height',
        'max-width',
        'padding',
        'margin',
        'border',
        'background',
        'color',
        'font',
        'text-align',
      ],
      { unspecified: 'bottom' },
    ],
  },
}
