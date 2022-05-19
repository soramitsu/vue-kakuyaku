import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['packages/core/src/**/*.ts'],
  },
})
