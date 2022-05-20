import { mount } from '@cypress/vue'
import { reactive, ref } from 'vue'
import { pluginErrorRetry } from '../../src/plugins/error-retry'
import { Resource } from '../../src/types'

it('when error appears, it calls not-force refresh', () => {
  mount({
    setup() {
      const called = ref(false)

      const resource: Resource<any> = reactive({
        state: {
          data: null,
          error: null,
          pending: false,
          fresh: false,
        },
        key: 'some',
        refresh: (force) => {
          if (force) throw new Error('force is unexpected')
          called.value = true
        },
        reset: () => {},
      })

      pluginErrorRetry({ interval: 50 })({
        resource,
        store: null as any,
      })

      function createError() {
        resource.state.error = { some: 'something' }
      }

      return {
        createError,
        called,
      }
    },
    template: `
      <p>Called: {{ called }}</p>
      <button @click="createError">Error</button>
    `,
  })

  cy.contains('Called: false')
  cy.contains('Error').click()
  cy.contains('Called: true')
})

it('when error disappear after first retry, it stops retries')

it('when error disappear after N retry, it stops retries')

it('when error appear **again**, it retries again')

describe('Calls count', () => {
  it('calls refresh specified N times on error')

  it('calls refresh 5 times by default')

  it('when error appears again, error retries count is the same')
})

describe('Call interval', () => {
  it('uses specified interval')

  it('uses 5000 interval by default')
})
