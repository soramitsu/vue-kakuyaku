@Library('jenkins-library' ) _

def pipeline = new org.js.LibPipeline(steps: this,
  buildDockerImage: 'docker.soramitsu.co.jp/build-tools/node:16-ubuntu-cypress',
  packageManager: 'pnpm',
  testCmds: ['pnpm format:check', 'pnpm test:ci'],
  buildCmds: ['pnpm build:ci'],
  pushCmds: ['pnpm publish-all'],
  npmRegistries: [:],
  npmLoginEmail:'admin@soramitsu.co.jp',
  sonarProjectName: 'vue-swr-composable',
  sonarProjectKey: 'jp.co.soramitsu:vue-swr-composable')
pipeline.runPipeline()