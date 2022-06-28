import {
  Ref,
  watch,
  shallowRef,
  onScopeDispose,
  markRaw,
  shallowReactive,
  ref,
  unref,
  getCurrentScope,
  EffectScope,
  WatchStopHandle,
  WatchOptions,
  computed,
  effectScope,
  shallowReadonly,
} from 'vue'
import { MaybeRef, useIntervalFn } from '@vueuse/core'

/**
 * Function that is wrapped into a {@link Task}.
 *
 * Accepts `onAbort
 */
export type TaskFn<T> = (onAbort: OnAbortFn) => Promise<T>

export type OnAbortFn = (fn: () => void) => void

/**
 * Atomic task state. Represented as an algebraic enumerated type to be more type-strong.
 */
export type TaskState<T> = TaskStateUninit | TaskStatePending | Result<T> | TaskStateAborted

/**
 * Used to build algebraic enumerated types
 */
export interface Tagged<T extends string> {
  readonly kind: T
}

/**
 * Task is not yet initialized
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskStateUninit extends Tagged<'uninit'> {}

/**
 * Task is pending
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskStatePending extends Tagged<'pending'> {}

/**
 * Task is aborted
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TaskStateAborted extends Tagged<'aborted'> {}

/**
 * Ok or Err
 */
export type Result<T> = ResultOk<T> | ResultErr

/**
 * Task succeeded. Stores its execution result.
 */
export interface ResultOk<T> extends Tagged<'ok'> {
  readonly data: T
}

/**
 * Task errored. Stores its error.
 */
export interface ResultErr extends Tagged<'err'> {
  readonly error: unknown
}

function stateRaw<T extends TaskState<any>>(state: T): T {
  return markRaw(state)
}

function defineState<T extends TaskState<any>>(state: T): T {
  return state
}

const STATE_UNINIT_RAW = Object.freeze(stateRaw({ kind: 'uninit' }))

const STATE_PENDING_RAW = Object.freeze(stateRaw({ kind: 'pending' }))

const STATE_ABORTED = Object.freeze(defineState({ kind: 'aborted' }))

const STATE_ABORTED_RAW = Object.freeze(stateRaw({ kind: 'aborted' }))

/**
 * Simplified version of [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
 */
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
        console.error('Abortation hook errored:', err)
      }
    }
  }
}

export type BareTaskRunReturn<T> = TaskStateAborted | Result<T>

/**
 * State**less** abstraction around redoable headless async operation.
 */
export class BareTask<T> {
  #active: null | { abortHandle: AbortHandle; promise: Promise<unknown> } = null
  #fn: TaskFn<T>

  public constructor(fn: TaskFn<T>) {
    this.#fn = fn
  }

  public run(): Promise<BareTaskRunReturn<T>> {
    this.abort()

    const abortHandle = new AbortHandle()

    const promise = new Promise<BareTaskRunReturn<T>>((resolve) => {
      abortHandle.onAbort(() => resolve(STATE_ABORTED))
      this.#fn(abortHandle.onAbort)
        .then((data) => resolve({ kind: 'ok', data }))
        .catch((error) => resolve({ kind: 'err', error }))
    })

    this.#active = { promise, abortHandle }

    return promise
  }

  public abort() {
    if (this.#active) {
      this.#active.abortHandle.abort()
      this.#active = null
    }
  }
}

/**
 * State**full** abstraction around redoable headless async operation.
 *
 * What does it mean:
 *
 * - **async operation** - a function that returns a Promise (same as `async` function)
 * - **headless** - operation doesn't require any parameters
 * - **redoable** - operation could be re-run, which allows to build useful utilities around it
 *
 * `Task` stores its current, *atomic* state only. It doesn't store it's last result or error even if
 * it is pending at the moment. You can achieve it with utilities like {@link useStaleIfErrorState} or {@link useLastTaskResult}.
 */
export interface Task<T> {
  /**
   * Atomic task state
   */
  state: TaskState<T>
  run: () => Promise<BareTaskRunReturn<T>>
  abort: () => void
}

/**
 * Setup a task with reactive state and disposition on scope dispose.
 *
 * Receives the only one argument - {@link TaskFn `TaskFn<T>`}.
 *
 * Task is aborted when:
 *
 * - {@link Task.run `.run()`} is called while task is pending
 * - {@link Task.abort `.abort()`} is called
 * - task's scope is disposed
 *
 * ## Examples
 *
 * ### Making a side-effect
 *
 * ```ts
 * const task = useTask(async () => {
 *   await delay(200)
 *   if (Math.random() > 0.42) throw new Error('oops')
 * })
 *
 * function doSomething() {
 *   task.run()
 * }
 *
 * const error = computed(() =>
 *   task.state.kind === 'err'
 *     ? task.state.error
 *     : null
 * )
 * ```
 *
 * ### Loading something - handling abortation
 *
 * ```ts
 * interface User {
 *   name: string
 * }
 *
 * const task = useTask<User[]>(async (onAbort) => {
 *   const controller = new AbortController();
 *   onAbort(() => controller.abort())
 *   return fetch('/users', { signal: controller.signal })
 * })
 *
 * task.run()
 *
 * const isPending = computed(() => task.state.kind === 'pending')
 * const users = computed<null | User[]>(() =>
 *   task.state.kind === 'ok'
 *     ? task.state.result
 *     : null
 * )
 * ```
 *
 * ## Useful utilities
 *
 * - {@link useLastTaskResult}
 * - {@link useStaleIfErrorState}
 * - {@link useErrorRetry}
 * - {@link useScope} - when you need to conditionaly **setup** a task
 * - {@link useDanglingScope} - when you need to setup a task, but later, e.g. on some event
 * - {@link BareTask} - when you don't need task reactive state, but want to have redoability, abortation
 *   and {@link Result<T>}
 */
export function useTask<T>(fn: TaskFn<T>): Task<T> {
  const bare = new BareTask(fn)
  const abort = bare.abort.bind(bare)

  let lastRun: null | Promise<unknown> = null

  const task: Task<T> = shallowReactive({
    state: STATE_UNINIT_RAW,
    run,
    abort: abort,
  })

  function run(): Promise<BareTaskRunReturn<T>> {
    abort()
    setTaskStateWithEqualityCheck(task, STATE_PENDING_RAW)

    const thisPromise = bare.run().then((result) => {
      if (lastRun === thisPromise) {
        setTaskStateWithEqualityCheck(task, result.kind === 'aborted' ? STATE_ABORTED_RAW : markRaw(result))
      }

      return result
    })

    lastRun = thisPromise
    return thisPromise
  }

  onScopeDisposeIfThereAny(abort)

  return task
}

function onScopeDisposeIfThereAny(fn: () => void): void {
  getCurrentScope() && onScopeDispose(fn)
}

function setTaskStateWithEqualityCheck<T>(task: Task<T>, newState: TaskState<T>): void {
  if (!statesEqual(task.state, newState)) {
    task.state = newState
  }
}

function statesEqual<T>(one: TaskState<T>, other: TaskState<T>): boolean {
  return (
    one.kind === other.kind &&
    (one.kind !== 'ok' || one.data === (other as ResultOk<T>).data) &&
    (one.kind !== 'err' || one.error === (other as ResultErr).error)
  )
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest

  describe('statesEqual', () => {
    const CASES: [TaskState<any>, TaskState<any>, boolean][] = [
      [{ kind: 'aborted' }, { kind: 'aborted' }, true],
      [{ kind: 'aborted' }, { kind: 'uninit' }, false],
      [{ kind: 'pending' }, { kind: 'ok', data: null }, false],
      [{ kind: 'ok', data: null }, { kind: 'ok', data: null }, true],
      [{ kind: 'ok', data: { foo: 'bar' } }, { kind: 'ok', data: { foo: 'bar' } }, false],
      [{ kind: 'ok', data: { foo: 'bar' } }, { kind: 'err', error: new Error('fasd') }, false],
      [{ kind: 'err', error: 'hey' }, { kind: 'err', error: new Error('fasd') }, false],
      [{ kind: 'err', error: 'hey' }, { kind: 'err', error: 'hey' }, true],
    ]

    test.each(CASES)('%o == %o: %o', (one, other, expectedEquality) => {
      expect(statesEqual(one, other)).toBe(expectedEquality)
      expect(statesEqual(other, one)).toBe(expectedEquality)
    })
  })
}

/**
 * Used for scopes utilities. Primitive type (same as Vue's `:key`) to distinguish scopes from each other.
 */
export type ScopeKey = string | number | symbol

export type FalsyScopeKey = false | null | undefined

export interface ScopeSetup<T> {
  setup: T
}

export interface KeyedScopeSetup<T, K extends ScopeKey> extends ScopeSetup<T> {
  key: K
}

/**
 * Uses [`EffectScope` API](https://vuejs.org/api/reactivity-advanced.html#effectscope)
 * to setup a scope conditionally or binded to a key.
 *
 * Useful when:
 *
 * - you need to setup a task conditionally
 * - you need to setup a task according to some key
 *
 * note: actually it works not only with tasks.
 *
 * ## Examples
 *
 * ### Fetch data on some condition
 *
 * ```ts
 * const shouldFetch = ref(false)
 *
 * const scope = useScope(shouldFetch, () => {
 *   const task = useTask(async () => fetch('/users'))
 *
 *   // do any convenient stuff around the task
 *   useErrorRetry(task)
 *   const state = usePassiveState(task)
 *   const users = computed(() => state.result?.some)
 *   const pending = computed(() => state.pending)
 *   task.run()
 *
 *   // return anything you are comfort with
 *   return { users, pending }
 * })
 *
 * // no scope until `shouldFetch` is false
 * scope.value === null
 *
 * // enabling scope
 * shouldFetch.value = true
 *
 * // *reactivity magic happens...*
 *
 * // Voila! The scope with all internal stuff is set up
 * console.log(scope.value.setup.pending.value)
 * console.log(scope.value.setup.users.value)
 * ```
 *
 * ### Fetch user by id
 *
 * ```ts
 * const userId = ref(41)
 *
 * const scope = useScope(
 *   userId,
 *   // you can access the key that is associated with the scope that is being setup
 *   (resolvedUserId) => {
 *     const task = useTask(async () => fetch(`/users/${resolvedUserId}`));
 *     return task
 *   }
 * )
 *
 * // when key always exists, `scope.value` is never a null
 * console.log(scope.value.setup.state) // outputs task's current state
 * console.log(scope.value.key) // outputs active scope's key
 *
 * ## See Also
 *
 * - {@link useDanglingScope} - if you need to setup a scope, binded to current one, **but later**.
 * ```
 */
export function useScope<T>(cond: Ref<boolean>, setup: () => T): Ref<null | ScopeSetup<T>>
export function useScope<T, K extends ScopeKey>(key: Ref<K>, setup: (key: K) => T): Ref<KeyedScopeSetup<T, K>>
export function useScope<T, K extends ScopeKey>(
  condKey: Ref<FalsyScopeKey | K>,
  setup: (key: K) => T,
): Ref<null | KeyedScopeSetup<T, K>>

export function useScope<T>(
  key: Ref<FalsyScopeKey | true | ScopeKey>,
  setup: (key?: ScopeKey) => T,
): Ref<null | ScopeSetup<T> | KeyedScopeSetup<T, ScopeKey>> {
  const dangling = useDanglingScope<ScopeSetup<T> | KeyedScopeSetup<T, ScopeKey>>()

  watch(
    key,
    (actualKey) => {
      if (!actualKey) {
        dangling.dispose()
      } else {
        dangling.setup(() => {
          return actualKey === true
            ? {
                setup: setup(),
              }
            : {
                key: actualKey,
                setup: setup(actualKey),
              }
        })
      }
    },
    { immediate: true },
  )

  return computed(() => dangling.scope.value?.setup ?? null)
}

export interface DanglingScope<T> {
  scope: Readonly<Ref<null | ScopeSetup<T>>>
  setup: (fn: () => T) => void
  dispose: () => void
}

/**
 * Setup a scope, but later
 *
 * ## Examples
 *
 * ```ts
 * const submitAction = useDanglingScope<TaskMultiState<void>>();
 *
 * function submit(age: number, name: string) {
 *   submitAction.setup(() => {
 *     const task = useTask(async () => doAsyncStuff({ age, name }))
 *     const passive = usePassiveState(task)
 *     return passive
 *   })
 * }
 *
 * function cleanAction() {
 *   submitAction.dispose()
 * }
 *
 * watchEffect(() => {
 *   if (submitAction.scope) {
 *     console.log('pending:', submitAction.scope.setup.pending)
 *   }
 * })
 * ```
 */
export function useDanglingScope<T>(): DanglingScope<T> {
  const main = getCurrentScope() || effectScope()
  let scope: EffectScope | null = null
  const scopeSetupReturn = shallowRef<null | ScopeSetup<T>>(null)

  function setup(fn: () => T): void {
    dispose()

    main.run(() => {
      scope = effectScope()
      scope.run(() => {
        scopeSetupReturn.value = { setup: fn() }
      })
    })
  }

  function dispose(): void {
    if (scope) {
      scope.stop()
      scope = scopeSetupReturn.value = null
    }
  }

  return { setup, dispose, scope: shallowReadonly(scopeSetupReturn) }
}

export type Maybe<T> = null | { some: T }

export interface TaskStaleIfErrorState<T> {
  result: Maybe<T>
  error: Maybe<unknown>
  pending: boolean
  fresh: boolean
}

export function useStaleIfErrorState<T>(task: Task<T>): TaskStaleIfErrorState<T> {
  const state: TaskStaleIfErrorState<T> = shallowReactive({
    result: task.state.kind === 'ok' ? { some: task.state.data } : null,
    error: task.state.kind === 'err' ? { some: task.state.error } : null,
    pending: task.state.kind === 'pending',
    fresh: task.state.kind === 'ok',
  })

  watch(
    () => task.state,
    (val) => {
      if (val.kind === 'pending') {
        state.pending = true
        state.fresh = false
      } else {
        state.pending = false

        if (val.kind === 'err') {
          state.error = markRaw({ some: val.error })
        } else if (val.kind === 'ok') {
          state.result = markRaw({ some: val.data })
          state.error = null
          state.fresh = true
        }
      }
    },
    { flush: 'sync' },
  )

  return state
}

export function useLastTaskResult<T>(task: Task<T>): Ref<null | Result<T>> {
  const result = shallowRef<null | Result<T>>(null)

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

export interface ErrorRetryOptions {
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

export function useErrorRetry(
  task: Task<any>,
  options?: ErrorRetryOptions,
): {
  reset: () => void
  retries: Ref<number>
} {
  const lastResult = useLastTaskResult(task)
  const retriesCount = ref(0)

  function resetCounter() {
    retriesCount.value = 0
  }

  const refreshInterval = useIntervalFn(
    () => {
      retriesCount.value++
      task.run()
    },
    options?.interval ?? DEFAULT_ERR_RETRY_INTERVAL,
    {
      immediate: false,
    },
  )

  watch(
    () => lastResult.value?.kind === 'err' && retriesCount.value < (unref(options?.count) ?? DEFAULT_ERR_RETRY_COUNT),
    (doRetries) => {
      if (doRetries) {
        refreshInterval.resume()
      } else {
        resetCounter()
        refreshInterval.pause()
      }
    },
    { immediate: true },
  )

  return { reset: resetCounter, retries: retriesCount }
}

export function wheneverTaskErrors(
  task: Task<unknown>,
  fn: (error: unknown) => void,
  options?: WatchOptions,
): WatchStopHandle {
  return watch(
    () => (task.state.kind === 'err' ? task.state : null),
    (val) => val && fn(val.error),
    wheneverTaskResolvesOptionsWithDefaults(options),
  )
}

export function wheneverTaskSucceeds<T>(
  task: Task<T>,
  fn: (result: T) => void,
  options?: WatchOptions,
): WatchStopHandle {
  return watch(
    () => (task.state.kind === 'ok' ? task.state : null),
    (val) => val && fn(val.data),
    wheneverTaskResolvesOptionsWithDefaults(options),
  )
}

function wheneverTaskResolvesOptionsWithDefaults(options?: WatchOptions): WatchOptions {
  return {
    immediate: true,
    flush: 'sync',
    ...options,
  }
}
