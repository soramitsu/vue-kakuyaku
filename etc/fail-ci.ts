import ci from 'ci-info'
import consola from 'consola'

if (ci.isCI) {
  consola.error('You cannot run me in CI >:(')
  process.exit(1)
} else {
  consola.success('CI is not detected :>')
}
