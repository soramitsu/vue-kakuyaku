/* eslint-disable @typescript-eslint/no-invalid-void-type */
/* eslint-disable max-nested-callbacks */
import { until } from '@vueuse/core'
import { describe, expect, test, vi } from 'vitest'
import { effectScope, isReadonly, nextTick, onScopeDispose, ref } from 'vue'
import { deferred, flattenState, useDeferredScope, useParamScope, usePromise } from './lib'

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

describe('useDeferredScope()', () => {
  test('setup function return value appears after first setup', () => {
    const { setup, scope } = useDeferredScope<number>()

    setup(() => 42)

    expect(scope.value?.expose).toBe(42)
  })

  test('first set up scope disposes after dispose() call', () => {
    const { setup, scope, dispose } = useDeferredScope()
    const disposed = vi.fn()

    setup(() => {
      onScopeDispose(disposed)
    })
    dispose()

    expect(scope.value).toBeNull()
    expect(disposed).toBeCalled()
  })

  test('first set up scope disposes after a new setup()', () => {
    const { setup, scope } = useDeferredScope<number>()
    const disposed = vi.fn()

    setup(() => {
      onScopeDispose(disposed)
      return 42
    })
    setup(() => 43)

    expect(scope.value?.expose).toBe(43)
    expect(disposed).toBeCalled()
  })

  test('set up scope disposes after the main scope disposal', () => {
    const main = effectScope()
    const disposed = vi.fn()

    main.run(() => {
      const { setup } = useDeferredScope()
      setup(() => {
        onScopeDispose(disposed)
      })
    })
    main.stop()

    expect(disposed).toBeCalled()
  })

  test('scope ref is readonly for sure', () => {
    const { scope } = useDeferredScope()

    expect(isReadonly(scope)).toBe(true)
  })
})

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

describe('useParamScope', () => {
  test('when composed key is updated to the same key, scope is still', async () => {
    const fnSetup = vi.fn()
    const fnDispose = vi.fn()

    const counter = ref(0)

    useParamScope(
      () => {
        const val = counter.value
        return { key: 'hey', payload: 42 }
      },
      () => {
        fnSetup()
        onScopeDispose(fnDispose)
      },
    )

    expect(fnSetup).toBeCalledTimes(1)

    counter.value++
    await nextTick()

    expect(fnSetup).toBeCalledTimes(1)
    expect(fnDispose).toBeCalledTimes(0)
  })

  test('when key is true, nothing is passed into setup', () => {
    const fn = vi.fn()

    useParamScope(() => true, fn)

    expect(fn).toBeCalledWith()
  })

  test('when key is string, only key is passed into setup', () => {
    const fn = vi.fn()

    useParamScope(() => 'hey', fn)

    expect(fn).toBeCalledWith('hey')
  })

  test('when key is composed, payload and key are passed into setup', () => {
    const fn = vi.fn()
    const PAYLOAD = { foo: 'bar' }

    useParamScope(() => ({ key: '123', payload: PAYLOAD }), fn)

    expect(fn).toBeCalledWith(PAYLOAD, '123')
  })
})
