import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/lib.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `lib.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core'],
    },
    minify: false,
  },
})
