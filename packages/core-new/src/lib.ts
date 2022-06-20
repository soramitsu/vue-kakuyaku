import { Ref, watch, shallowRef, onScopeDispose, markRaw, shallowReactive, ref, unref } from 'vue'
import { MaybeRef, useIntervalFn } from '@vueuse/core'

export type TaskFn<T> = (onAbort: OnAbortFn) => Promise<T>

export type OnAbortFn = (fn: () => void) => void

export type FalsyScopeKey = false | null | undefined

export type ScopeKey = string | number | symbol

export type TaskState<T> = TaskStateUninit | TaskStatePending | TaskStateOk<T> | TaskStateErr

export interface Tagged<T extends string> {
  readonly kind: T
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskStateUninit extends Tagged<'uninit'> {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskStatePending extends Tagged<'pending'> {}

export interface TaskStateOk<T> extends Tagged<'ok'> {
  readonly result: T
}
export interface TaskStateErr extends Tagged<'err'> {
  readonly error: unknown
}

export const ANONYMOUS_SCOPE = Symbol('Anonymous')

function stateRaw<T extends TaskState<any>>(state: T): T {
  return markRaw(state)
}

const TASK_RUN_ABORT = Symbol('Aborted')
const STATE_UNINIT = Object.freeze(stateRaw({ kind: 'uninit' }))
const STATE_PENDING = Object.freeze(stateRaw({ kind: 'pending' }))

class AbortHandle {
  public readonly onAbort: OnAbortFn
  private hooks: (() => void)[] = []

  public constructor() {
    this.onAbort = (fn) => {
      this.hooks.push(fn)
    }
  }

  public abort() {
    for (const fn of this.hooks) {
      try {
        fn()
      } catch (err) {
        console.error('Async action abort hook errored:', err)
      }
    }
  }
}

/**
 * Basic abstraction around **redoable headless async operation**.
 *
 * **Async operation** - async function or function that returns a Promise.
 *
 * **Headless** means that this operation doesn't require any arguments.
 *
 * **Redoability** allows to build usefull utilities around a task, like error retry.
 */
export interface Task<T> {
  state: TaskState<T>
  run: () => void
  abort: () => void
}

export interface ScopeSetup<T> {
  setup: T
}

export interface KeyedScopeSetup<T, K extends ScopeKey> extends ScopeSetup<T> {
  key: K
}

export function useScope<T>(cond: Ref<boolean>, setup: () => T): Ref<null | ScopeSetup<T>>
export function useScope<T, K extends ScopeKey>(key: Ref<K>, setup: (key: K) => T): Ref<KeyedScopeSetup<T, K>>
export function useScope<T, K extends ScopeKey>(
  condKey: Ref<FalsyScopeKey | K>,
  setup: (key: K) => T,
): Ref<null | KeyedScopeSetup<T, K>>

export function useScope<T>(
  key: Ref<FalsyScopeKey | true | ScopeKey>,
  setup: (key?: ScopeKey) => T,
): Ref<null | ScopeSetup<T> | KeyedScopeSetup<T, ScopeKey>> {}

/**
 * Setup a task
 */
export function useTask<T>(fn: TaskFn<T>): Task<T> {
  interface Active {
    promise: Promise<void>
    abort: AbortHandle
  }
  let active: null | Active = null

  const task: Task<T> = shallowReactive({
    state: STATE_UNINIT,
    run,
    abort: doAbort,
  })

  function run(abort = true) {
    abort && doAbort()

    const abortHandle = new AbortHandle()
    const thisPromise = new Promise<T | typeof TASK_RUN_ABORT>((resolve, reject) => {
      task.state = STATE_PENDING
      abortHandle.onAbort(() => resolve(TASK_RUN_ABORT))
      fn(abortHandle.onAbort).then(resolve).catch(reject)
    })
      .then((result) => {
        if (active?.promise === thisPromise) {
          if (result === TASK_RUN_ABORT) {
            task.state = STATE_UNINIT
          } else {
            task.state = stateRaw({ kind: 'ok', result })
          }
        }
      })
      .catch((error) => {
        if (active?.promise === thisPromise) {
          task.state = stateRaw({ kind: 'err', error })
        }
      })
    active = { promise: thisPromise, abort: abortHandle }
  }

  function doAbort() {
    if (active) {
      active.abort.abort()
      active = null
    }
  }

  onScopeDispose(doAbort)

  return task
}

export interface DanglingScope<T> {
  scope: Ref<null | ScopeSetup<T>>
  setup: (fn: () => T) => void
  dispose: () => void
}

export function useDanglingScope<T>(): DanglingScope<T> {}

export type Maybe<T> = null | { some: T }

export interface TaskInertState<T> {
  result: Maybe<T>
  error: Maybe<unknown>
  pending: boolean
}

function stateToInert<T>(state: TaskState<T>): TaskInertState<T> {
  return {
    result: state.kind === 'ok' ? { some: state.result } : null,
    error: state.kind === 'err' ? { some: state.error } : null,
    pending: state.kind === 'pending',
  }
}

export function useInertState<T>(task: Task<T>): TaskInertState<T> {
  const state: TaskInertState<T> = shallowReactive(stateToInert(task.state))

  watch(
    () => task.state,
    (val) => {
      if (val.kind === 'pending') {
        state.pending = true
      } else {
        state.pending = false

        if (val.kind === 'err') {
          state.error = markRaw({ some: val.error })
        } else if (val.kind === 'ok') {
          state.result = markRaw({ some: val.result })
          state.error = null
        }
      }
    },
    { flush: 'sync' },
  )

  return state
}

export function useLastTaskResult<T>(task: Task<T>): Ref<null | TaskStateOk<T> | TaskStateErr> {
  const result = shallowRef<null | TaskStateOk<T> | TaskStateErr>(null)

  watch(
    () => task.state,
    (state) => {
      if (state.kind === 'ok' || state.kind === 'err') {
        result.value = state
      }
    },
    { immediate: true, flush: 'sync' },
  )

  return result
}

export interface ErrorRetryParams {
  /**
   * How many times to retry
   *
   * @default 5
   */
  count?: MaybeRef<number>
  /**
   * How often to retry
   *
   * @default 5_000
   */
  interval?: MaybeRef<number>
}

const DEFAULT_ERR_RETRY_INTERVAL = 5_000
const DEFAULT_ERR_RETRY_COUNT = 5

export function useErrorRetry(task: Task<any>, params?: ErrorRetryParams): void {
  const lastResult = useLastTaskResult(task)
  const retriesCount = ref(0)

  const refreshInterval = useIntervalFn(
    () => {
      retriesCount.value++
      task.run()
    },
    params?.interval ?? DEFAULT_ERR_RETRY_INTERVAL,
    {
      immediate: false,
    },
  )

  watch(
    () => lastResult.value?.kind === 'err' && retriesCount.value < (unref(params?.count) ?? DEFAULT_ERR_RETRY_COUNT),
    (doRetries) => {
      if (doRetries) {
        refreshInterval.resume()
      } else {
        retriesCount.value = 0
        refreshInterval.pause()
      }
    },
    { immediate: true },
  )
}
