/* eslint-disable max-nested-callbacks */
import { test, expect, describe, vi } from 'vitest'
import { isReactive, reactive, effectScope } from 'vue'
import { TaskState, BareTask, useTask } from './lib'

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

    expect(result).toEqual(defineState({ kind: 'ok', result: 42 }))
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

    expect(task.state).toEqual(defineState({ kind: 'ok', result: 42 }))
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
})
