/* eslint-disable @typescript-eslint/no-require-imports */
const { startDevServer } = require('@cypress/vite-dev-server')
const path = require('path')
const { default: uno } = require('unocss/vite')

module.exports = (on, config) => {
  on('dev-server:start', async (options) =>
    startDevServer({
      options,
      viteConfig: {
        plugins: [
          uno({
            include: [path.resolve(__dirname, '../component/**/*')],
          }),
        ],
        resolve: {
          alias: {
            '~lib': path.resolve(__dirname, '../../src/lib.ts'),
            vue: 'vue/dist/vue.esm-bundler.js',
          },
        },
      },
    }),
  )

  return config
}
