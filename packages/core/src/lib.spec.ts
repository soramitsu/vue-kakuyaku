/* eslint-disable max-nested-callbacks */
import { until } from '@vueuse/core'
import { describe, expect, test } from 'vitest'
import { deferred, usePromise } from './lib'

const IMPOSSIBLE_PROMISE = new Promise(() => {})

describe('usePromise()', () => {
  test('initial state is empty', () => {
    const { state } = usePromise()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": false,
        "rejected": null,
      }
    `)
  })

  test('"pending" is true after unresolved promise is set', () => {
    const { state, set } = usePromise()

    set(IMPOSSIBLE_PROMISE)

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": true,
        "rejected": null,
      }
    `)
  })

  test('"fulfilled" is set after fulfillment', async () => {
    const { state, set } = usePromise<number>()

    const promise = deferred<number>()
    set(promise)
    promise.resolve(42)
    await until(() => state.pending).toBe(false)

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": {
          "value": 42,
        },
        "pending": false,
        "rejected": null,
      }
    `)
  })

  test('"rejected" is set after rejection', async () => {
    const { state, set } = usePromise()

    const promise = deferred()
    set(promise)
    promise.reject('boo')
    await until(() => state.pending).toBe(false)

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": false,
        "rejected": {
          "reason": "boo",
        },
      }
    `)
  })

  test('state is empty after clearance', () => {
    const { set, clear, state } = usePromise()

    set(IMPOSSIBLE_PROMISE)
    clear()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": false,
        "rejected": null,
      }
    `)
  })

  test.todo('test data races etc')
})

describe.todo('"Whenever promise..."')

describe('useDeferredScope()', () => {
  test.todo('setup function return value appears after first setup')

  test.todo('first set up scope disposes on dispose() call')

  test.todo('first set up scope disposes on a new setup()')

  test.todo('set up scope disposes on main scope dispose')

  test.todo('scope setup return changes on a new setup()')

  test.todo('scope setup return becomes a null on dispose()')

  test.todo('scope ref is readonly for sure')
})
