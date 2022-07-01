@Library('jenkins-library' ) _

def pipeline = new org.js.LibPipeline(steps: this,
  buildDockerImage: 'docker.soramitsu.co.jp/build-tools/node:16-ubuntu-cypress',
  packageManager: 'pnpm',
  testCmds: ['pnpm format:check', 'pnpm test:ci'],
  buildCmds: ['pnpm build:ci'],
  npmRegistries: [:],
  npmLoginEmail:'admin@soramitsu.co.jp',
  pushCmds: ['pnpm publish-all'],
  sonarProjectName: 'vue-kakuyaku',
  sonarProjectKey: 'jp.co.soramitsu:vue-kakuyaku')
pipeline.runPipeline()