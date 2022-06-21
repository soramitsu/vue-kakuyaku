import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    // includeSource: ['packages/core-new/src/**/*.ts'],
  },
})
