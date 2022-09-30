import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    includeSource: ['packages/core/src/**/*.ts'],
  },
})
