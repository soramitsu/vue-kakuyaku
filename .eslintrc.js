module.exports = {
  extends: ['alloy', 'alloy/typescript'],
  rules: {
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/'],
      },
    ],
    'no-use-before-define': 'off',
    'sort-imports': [
      'warn',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: false,
      },
    ],
  },
  overrides: [
    // not relevalt for now
    {
      files: ['packages/core/cypress/component/**/*.ts'],
      plugins: ['cypress'],
      extends: ['plugin:cypress/recommended'],
      env: {
        'cypress/globals': true,
      },
    },
  ],
}
