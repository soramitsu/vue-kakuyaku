/* eslint-disable max-nested-callbacks */
import { test, expect, describe, vi } from 'vitest'
import { isReactive, reactive, effectScope, watch } from 'vue'
import { TaskState, BareTask, useTask, useStaleIfErrorState } from './lib'

function defineState<T extends TaskState<any>>(state: T): T {
  return state
}

const IMPOSSIBLE_PROMISE = new Promise(() => {})

describe('BareTask', () => {
  test("doesn't run a task on start", () => {
    const fn = vi.fn()

    // eslint-disable-next-line no-new
    new BareTask(fn)

    expect(fn).not.toBeCalled()
  })

  test('returns Ok on succeeded run', async () => {
    const task = new BareTask(async () => 42)
    const result = await task.run()

    expect(result).toEqual(defineState({ kind: 'ok', data: 42 }))
  })

  test('returns Err on failed run', async () => {
    const ERR = new Error('got you')

    const task = new BareTask(async () => {
      throw ERR
    })
    const result = await task.run()

    expect(result).toEqual(defineState({ kind: 'err', error: ERR }))
  })

  test('returns Aborted when abort is called', async () => {
    const task = new BareTask(() => IMPOSSIBLE_PROMISE)

    const resultPromise = task.run()
    task.abort()
    const result = await resultPromise

    expect(result).toEqual(defineState({ kind: 'aborted' }))
  })

  test('returns Aborted when run is called while being pending', async () => {
    const task = new BareTask(() => IMPOSSIBLE_PROMISE)

    const resultPromise = task.run()
    task.run()
    const result = await resultPromise

    expect(result).toEqual(defineState({ kind: 'aborted' }))
  })

  test('onAbort() fires when abort is called', () => {
    const fn = vi.fn()

    const task = new BareTask((onAbort) => {
      onAbort(fn)
      return IMPOSSIBLE_PROMISE
    })
    task.run()
    task.abort()

    expect(fn).toBeCalledTimes(1)
  })

  test('onAbort() fires when run is called while being pending', () => {
    const fn = vi.fn()

    const task = new BareTask((onAbort) => {
      onAbort(fn)
      return IMPOSSIBLE_PROMISE
    })
    task.run()
    task.run()

    expect(fn).toBeCalledTimes(1)
  })

  test.todo('onAbort() on first execution is not called when second abortation is happened')
})

describe('useTask', () => {
  test('returns a reactive object', () => {
    const task = useTask(async () => 42)

    expect(isReactive(task)).toBe(true)
  })

  test('initial state is uninit', () => {
    const task = useTask(async () => 42)

    expect(task.state).toEqual(defineState({ kind: 'uninit' }))
  })

  test('task state is "ok" when ok', async () => {
    const task = useTask(async () => 42)
    await task.run()

    expect(task.state).toEqual(defineState({ kind: 'ok', data: 42 }))
  })

  test('task state is "err" when errored', async () => {
    const ERR = new Error('got it')

    const task = useTask(async () => {
      throw ERR
    })
    await task.run()

    expect(task.state).toEqual(defineState({ kind: 'err', error: ERR }))
  })

  test('task state is "pending" when `.run()` is called again (data race test)', async () => {
    const task = useTask(() => IMPOSSIBLE_PROMISE)
    const firstRun = task.run()

    expect(task.state).toEqual(defineState({ kind: 'pending' }))

    task.run()

    const firstResult = await firstRun
    expect(firstResult).toEqual(defineState({ kind: 'aborted' }))
    expect(task.state).toEqual(defineState({ kind: 'pending' }))
  })

  test('task state is "aborted" when `.abort()` is called', async () => {
    const task = useTask(() => IMPOSSIBLE_PROMISE)
    const run = task.run()
    task.abort()
    await run

    expect(task.state).toEqual(defineState({ kind: 'aborted' }))
  })

  test('onAbort is called when `.abort()` is called', async () => {
    const abort = vi.fn()

    const task = useTask((onAbort) => {
      onAbort(abort)
      return IMPOSSIBLE_PROMISE
    })
    const run = task.run()
    task.abort()
    await run

    expect(abort).toBeCalledTimes(1)
  })

  test('task ok result is marked as raw', async () => {
    const task = useTask(async () => ({ foo: 'bar' }))
    await task.run()

    expect(task.state.kind === 'ok').toBe(true)
    expect(isReactive(reactive(task.state))).toBe(false)
  })

  test('task err result is marked as raw', async () => {
    const task = useTask(async () => {
      throw new Error('ops')
    })
    await task.run()

    expect(task.state.kind === 'err').toBe(true)
    expect(isReactive(reactive(task.state))).toBe(false)
  })

  test('task is aborted on scope dispose', () => {
    const abort = vi.fn()

    const scope = effectScope()
    scope.run(() => {
      const task = useTask((onAbort) => {
        onAbort(abort)
        return IMPOSSIBLE_PROMISE
      })
      task.run()
    })
    scope.stop()

    expect(abort).toBeCalledTimes(1)
  })

  describe('state triggers avoidance', () => {
    test('when re-run happens while pending & there is a sync watcher on state, it is not called', async () => {
      const syncWatcher = vi.fn()
      const task = useTask(() => IMPOSSIBLE_PROMISE)
      watch(
        () => task.state,
        () => syncWatcher(),
        { flush: 'sync' },
      )

      task.run()
      expect(syncWatcher).toBeCalledTimes(1)

      task.run()
      expect(syncWatcher).toBeCalledTimes(1)
    })
  })
})

describe('useStaleIfErrorState()', () => {
  test('initial task state', () => {
    const state = useStaleIfErrorState(useTask(async () => 42))

    expect(state).toMatchInlineSnapshot(`
      {
        "error": null,
        "fresh": false,
        "pending": false,
        "result": null,
      }
    `)
  })

  test('state when task becomes pending for the first time', () => {
    const task = useTask(async () => IMPOSSIBLE_PROMISE)
    const state = useStaleIfErrorState(task)

    task.run()

    expect(state).toMatchInlineSnapshot(`
      {
        "error": null,
        "fresh": false,
        "pending": true,
        "result": null,
      }
    `)
  })

  test('state when task is ok for the first time', async () => {
    const task = useTask(async () => 42)
    const state = useStaleIfErrorState(task)

    await task.run()

    expect(state).toMatchInlineSnapshot(`
      {
        "error": null,
        "fresh": true,
        "pending": false,
        "result": {
          "some": 42,
        },
      }
    `)
  })

  test('state when task errors after the first ok', async () => {
    let count = 0
    const task = useTask(async () => {
      if (count++ === 0) {
        return 42
      }
      throw new Error('hey')
    })
    const state = useStaleIfErrorState(task)

    await task.run()
    await task.run()

    expect(state).toMatchInlineSnapshot(`
      {
        "error": {
          "some": [Error: hey],
        },
        "fresh": false,
        "pending": false,
        "result": {
          "some": 42,
        },
      }
    `)
  })

  test('state when task oks after ok and error', async () => {
    let count = 0
    const task = useTask(async () => {
      count++
      if (count === 1) {
        return 42
      } else if (count === 2) {
        throw new Error('hey')
      }
      return 43
    })
    const state = useStaleIfErrorState(task)

    await task.run()
    await task.run()
    await task.run()

    expect(state).toMatchInlineSnapshot(`
      {
        "error": null,
        "fresh": true,
        "pending": false,
        "result": {
          "some": 43,
        },
      }
    `)
  })
})

describe.todo('"Whenever task..."')

describe('useDanglingScope()', () => {
  test.todo('setup function return value appears after first setup')

  test.todo('first set up scope disposes on dispose() call')

  test.todo('first set up scope disposes on a new setup()')

  test.todo('set up scope disposes on main scope dispose')

  test.todo('scope setup return changes on a new setup()')

  test.todo('scope setup return becomes a null on dispose()')

  test.todo('scope ref is readonly for sure')
})
