import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'import.meta.vitest': 'undefined',
  },
  build: {
    target: 'esnext',
    lib: {
      entry: 'src/lib.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `vue-kakuyaku.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core'],
    },
    minify: false,
  },
})
