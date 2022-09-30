/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable max-nested-callbacks */
import { until } from '@vueuse/core'
import { describe, expect, test } from 'vitest'
import { isReadonly, nextTick } from 'vue'
import { flattenState, usePromise } from './use-promise-and-co'
import { deferred } from './handy'

const IMPOSSIBLE_PROMISE = new Promise<any>(() => {})

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

  test('when promise is resolved after clearance, state is empty', async () => {
    const { set, clear, state } = usePromise<void>()
    const promise = deferred<void>()

    set(promise)
    clear()
    promise.resolve()

    await nextTick()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": false,
        "rejected": null,
      }
    `)
  })

  test('when promise is rejected after clearance, state is empty', async () => {
    const { set, clear, state } = usePromise<void>()
    const promise = deferred<void>()

    set(promise)
    clear()
    promise.reject(new Error('error'))

    await nextTick()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": false,
        "rejected": null,
      }
    `)
  })

  test('when promise is resolved after setting a new one, state is pending', async () => {
    const { set, state } = usePromise<void>()
    const promise = deferred<void>()

    set(promise)
    set(IMPOSSIBLE_PROMISE)
    promise.resolve()

    await nextTick()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": true,
        "rejected": null,
      }
    `)
  })

  test('when promise is rejected after setting a new one, state is pending', async () => {
    const { set, state } = usePromise<void>()
    const promise = deferred<void>()

    set(promise)
    set(IMPOSSIBLE_PROMISE)
    promise.reject(new Error('ignore me'))

    await nextTick()

    expect(state).toMatchInlineSnapshot(`
      {
        "fulfilled": null,
        "pending": true,
        "rejected": null,
      }
    `)
  })
})

describe.todo('"Whenever promise..."')

describe('flattenState()', () => {
  test('it is read-only', () => {
    expect(isReadonly(flattenState({ pending: true, fulfilled: null, rejected: null }))).toBe(true)
  })

  describe('mode: all', () => {
    test('pending', () => {
      expect(
        flattenState(
          {
            pending: true,
            fulfilled: null,
            rejected: null,
          },
          'all',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": true,
          "rejected": null,
        }
      `)
    })

    test('fulfilled', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: { value: 412 },
            rejected: null,
          },
          'all',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": 412,
          "pending": false,
          "rejected": null,
        }
      `)
    })

    test('rejected', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: null,
            rejected: { reason: 'none' },
          },
          'all',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": false,
          "rejected": "none",
        }
      `)
    })
  })

  describe('mode: fulfilled', () => {
    test('pending', () => {
      expect(
        flattenState(
          {
            pending: true,
            fulfilled: null,
            rejected: null,
          },
          'fulfilled',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": true,
          "rejected": null,
        }
      `)
    })

    test('fulfilled', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: { value: 412 },
            rejected: null,
          },
          'fulfilled',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": 412,
          "pending": false,
          "rejected": null,
        }
      `)
    })

    test('rejected', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: null,
            rejected: { reason: 'none' },
          },
          'fulfilled',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": false,
          "rejected": {
            "reason": "none",
          },
        }
      `)
    })

    test('this mode is used by default', () => {
      expect(flattenState({ pending: false, fulfilled: { value: 42 }, rejected: null }).fulfilled).toBe(42)
    })
  })

  describe('mode: rejected', () => {
    test('pending', () => {
      expect(
        flattenState(
          {
            pending: true,
            fulfilled: null,
            rejected: null,
          },
          'rejected',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": true,
          "rejected": null,
        }
      `)
    })

    test('fulfilled', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: { value: 412 },
            rejected: null,
          },
          'rejected',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": {
            "value": 412,
          },
          "pending": false,
          "rejected": null,
        }
      `)
    })

    test('rejected', () => {
      expect(
        flattenState(
          {
            pending: false,
            fulfilled: null,
            rejected: { reason: 'none' },
          },
          'rejected',
        ),
      ).toMatchInlineSnapshot(`
        {
          "fulfilled": null,
          "pending": false,
          "rejected": "none",
        }
      `)
    })
  })
})
