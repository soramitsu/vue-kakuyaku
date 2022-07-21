import {
  EffectScope,
  Ref,
  WatchOptions,
  WatchStopHandle,
  computed,
  effectScope,
  getCurrentScope,
  markRaw,
  reactive,
  ref,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  toRef,
  unref,
  watch,
} from 'vue'
import { MaybeRef, useIntervalFn } from '@vueuse/core'
import { Except } from 'type-fest'

export function delay(ms: number): Promise<void> {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((r) => setTimeout(r, ms))
}

export function deferred<T>(): Deferred<T> {
  let methods
  let state = 'pending'
  const promise = new Promise<T>((resolve, reject): void => {
    methods = {
      async resolve(value: T | PromiseLike<T>) {
        await value
        state = 'fulfilled'
        resolve(value)
      },
      reject(reason: unknown) {
        state = 'rejected'
        reject(reason)
      },
    }
  })
  Object.defineProperty(promise, 'state', { get: () => state })
  return Object.assign(promise, methods) as Deferred<T>
}

export interface Deferred<T> extends Promise<T> {
  readonly state: 'pending' | 'fulfilled' | 'rejected'
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason: unknown) => void
}

// export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>;

// export function deadline<T>(promise: Promise<T>, delay: number): Promise<T>;

export type PromiseStateAtomic<T> = PromiseStateInvariantEmpty | PromiseStateInvariantPending | PromiseResultAtomic<T>

export type PromiseResultAtomic<T> = PromiseStateInvariantFulfilled<T> | PromiseStateInvariantRejected

export interface PromiseStateInvariantPending {
  pending: true
  fulfilled: null
  rejected: null
}

export interface PromiseStateInvariantFulfilled<T> {
  pending: false
  fulfilled: { value: T }
  rejected: null
}

export interface PromiseStateInvariantRejected {
  pending: false
  fulfilled: null
  rejected: { reason: unknown }
}

export interface PromiseStateInvariantEmpty {
  pending: false
  fulfilled: null
  rejected: null
}

export interface UsePromiseReturn<T> {
  state: PromiseStateAtomic<T>
  set: (promise: Promise<T>) => void
  clear: () => void
}

export type WheneverPromiseOptions = Except<WatchOptions, 'deep'>

export function wheneverFulfilled<T>(
  state: PromiseStateAtomic<T>,
  fn: (value: T) => void,
  options?: WheneverPromiseOptions,
): WatchStopHandle {
  return watch(
    () => state.fulfilled,
    (x) => x && fn(x.value),
    options,
  )
}

export function wheneverRejected(
  state: PromiseStateAtomic<unknown>,
  fn: (reason: unknown) => void,
  options?: WheneverPromiseOptions,
): WatchStopHandle {
  return watch(
    () => state.rejected,
    (x) => x && fn(x.reason),
    options,
  )
}

export function wheneverDone<T>(
  state: PromiseStateAtomic<T>,
  fn: (result: PromiseResultAtomic<T>) => void,
  options?: WheneverPromiseOptions,
): WatchStopHandle {
  return watch(
    () => state.rejected || state.fulfilled,
    (x) => x && fn(state as PromiseResultAtomic<T>),
    options,
  )
}

export function usePromise<T>(): UsePromiseReturn<T> {
  let active: null | Promise<T> = null
  const state = shallowReactive<PromiseStateAtomic<T>>({
    pending: false,
    fulfilled: null,
    rejected: null,
  })

  function set(promise: Promise<T>) {
    active = promise

    state.pending = true
    state.fulfilled = null
    state.rejected = null

    promise
      .then((value) => {
        if (promise === active) {
          state.pending = false
          state.fulfilled = markRaw({ value })
        }
      })
      .catch((reason) => {
        console.log('caught', reason)
        if (promise === active) {
          state.pending = false
          state.rejected = markRaw({ reason })
        } else {
          // to not silent it
          throw reason
        }
      })
  }

  function clear() {
    active = null
    state.pending = false
    state.fulfilled = state.rejected = null
  }

  return { state, set, clear }
}

export interface PromiseStaleState<T> {
  fulfilled: null | { value: T }
  rejected: null | { reason: unknown }
  pending: boolean
  fresh: boolean
}

export function useStaleState<T>(state: PromiseStateAtomic<T>): PromiseStaleState<T> {
  const staleState: PromiseStaleState<T> = shallowReactive({
    fulfilled: null,
    rejected: null,
    pending: false,
    fresh: false,
  })

  watch(state, (updatedState) => {
    if (updatedState.pending) {
      staleState.pending = true
      staleState.fresh = false
    } else {
      staleState.pending = false
      if (updatedState.fulfilled) {
        staleState.fulfilled = updatedState.fulfilled
        staleState.rejected = null
        staleState.fresh = true
      } else if (updatedState.rejected) {
        staleState.rejected = updatedState.rejected
      }
    }
  })

  return staleState
}

export function useScopeWithAdvancedKey<K extends string | number | symbol, P, S>(
  key: Ref<null | { key: K; payload: P }>,
  fn: (payload: P) => S,
): Ref<null | { expose: S; key: K; payload: P }> {
  const { scope, setup, dispose } = useDeferredScope<{ expose: S; key: K; payload: P }>()

  watch(
    () => key.value?.key,
    (actualKey) => {
      if (!actualKey) {
        dispose()
      } else {
        setup(() => {
          const { payload } = key.value!
          const expose = fn(payload)
          return { expose, payload, key: actualKey }
        })
      }
    },
    { immediate: true },
  )

  return computed(() => scope.value?.expose ?? null)
}

/**
 * # Notes
 *
 * `this` context is not preserved (todo?)
 */
export function useTask<T>(
  fn: () => Promise<T>,
  options?: {
    /**
     * @default false
     */
    immediate: boolean
  },
): { state: PromiseStateAtomic<T>; run: () => void; clear: () => void } {
  const { state, set, clear } = usePromise<T>()
  const run = () => set(fn())
  options?.immediate && run()
  return { state, run, clear }
}

type FlatMode = 'all' | 'fulfilled' | 'rejected'

interface PromiseStateInvariantFulfilledFlat<T, M extends FlatMode> {
  pending: false
  fulfilled: M extends 'all' | 'fulfilled' ? T : { value: T }
  rejected: null
}

interface PromiseStateInvariantRejectedFlat<M extends FlatMode> {
  pending: false
  fulfilled: null
  rejected: M extends 'all' | 'rejected' ? unknown : { reason: unknown }
}

type PromiseStateAtomicFlat<T, M extends FlatMode> =
  | PromiseStateInvariantEmpty
  | PromiseStateInvariantPending
  | PromiseStateInvariantFulfilledFlat<T, M>
  | PromiseStateInvariantRejectedFlat<M>

export function flattenState<T>(state: PromiseStateAtomic<T>): PromiseStateAtomicFlat<T, 'fulfilled'>

export function flattenState<T, M extends FlatMode = 'fulfilled'>(
  state: PromiseStateAtomic<T>,
  mode: M,
): PromiseStateAtomicFlat<T, M>

export function flattenState<T, M extends FlatMode>(
  state: PromiseStateAtomic<T>,
  mode?: M,
): PromiseStateAtomicFlat<T, M> {
  // TODO implement with Proxy?

  const definitelyMode = (mode ?? 'fulfilled') as M

  return reactive({
    pending: computed(() => state.pending),
    fulfilled:
      definitelyMode === 'all' || definitelyMode === 'fulfilled'
        ? computed(() => state.fulfilled?.value ?? null)
        : toRef(state, 'fulfilled'),
    rejected:
      definitelyMode === 'all' || definitelyMode === 'rejected'
        ? computed(() => state.rejected?.reason ?? null)
        : toRef(state, 'rejected'),
  }) as PromiseStateAtomicFlat<T, M>
}

/**
 * Used for scopes utilities. Primitive type (same as Vue's `:key`) to distinguish scopes from each other.
 */
export type ScopeKey = string | number | symbol

export type FalsyScopeKey = false | null | undefined

export interface ScopeExpose<T> {
  expose: T
}

export interface ScopeExposeWithKey<T, K extends ScopeKey> extends ScopeExpose<T> {
  key: K
}

export interface ScopeExposeWithComposedKey<T, K extends ScopeKey, P> extends ScopeExposeWithKey<T, K> {
  payload: P
}

export interface ComposedKey<K extends ScopeKey, P> {
  key: K
  payload: P
}

export function useParamScope<E>(key: Ref<boolean>, setup: () => E): Ref<null | ScopeExpose<E>>
export function useParamScope<E, K extends ScopeKey>(key: Ref<K>, setup: (key: K) => E): Ref<ScopeExposeWithKey<E, K>>
export function useParamScope<E, K extends ScopeKey>(key: Ref<K>, setup: (key: K) => E): Ref<ScopeExposeWithKey<E, K>>
export function useParamScope<E, K extends ScopeKey>(
  key: Ref<FalsyScopeKey | K>,
  setup: (key: K) => E,
): Ref<null | ScopeExposeWithKey<E, K>>
export function useParamScope<E, K extends ScopeKey, P>(
  key: Ref<ComposedKey<K, P>>,
  setup: (payload: P) => E,
): Ref<ScopeExposeWithComposedKey<E, K, P>>
export function useParamScope<E, K extends ScopeKey, P>(
  key: Ref<FalsyScopeKey | ComposedKey<K, P>>,
  setup: (payload: P) => E,
): Ref<null | ScopeExposeWithComposedKey<E, K, P>>

export function useParamScope<E, K extends ScopeKey, P>(
  key: Ref<FalsyScopeKey | true | K | ComposedKey<K, P>>,
  setup: (keyOrPayload?: K | P) => E,
): Ref<null | ScopeExpose<E> | ScopeExposeWithKey<E, ScopeKey>> {
  const deferred = useDeferredScope<ScopeExpose<E> | ScopeExposeWithKey<E, ScopeKey>>()

  watch(
    key,
    (actualKey) => {
      if (!actualKey) {
        deferred.dispose()
      } else {
        deferred.setup(() => {
          return actualKey === true
            ? {
                expose: setup(),
              }
            : typeof actualKey === 'object'
            ? {
                expose: setup(actualKey.payload),
                ...actualKey,
              }
            : {
                key: actualKey,
                expose: setup(actualKey),
              }
        })
      }
    },
    { immediate: true },
  )

  return computed(() => deferred.scope.value?.expose ?? null)
}

export interface DeferredScope<T> {
  scope: Readonly<Ref<null | ScopeExpose<T>>>
  setup: (fn: () => T) => void
  dispose: () => void
}

/**
 * Setup a scope, but later
 *
 * ## Examples
 *
 * ```ts
 * const submitAction = useDeferredScope<TaskMultiState<void>>();
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
export function useDeferredScope<T>(): DeferredScope<T> {
  const main = getCurrentScope() || effectScope()
  let scope: EffectScope | null = null
  const scopeSetupReturn = shallowRef<null | ScopeExpose<T>>(null)

  function setup(fn: () => T): void {
    dispose()

    main.run(() => {
      scope = effectScope()
      scope.run(() => {
        scopeSetupReturn.value = { expose: fn() }
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
  state: PromiseStateAtomic<unknown>,
  retry: () => void,
  options?: ErrorRetryOptions,
): {
  reset: () => void
  retries: Ref<number>
} {
  const lastResult = shallowRef<null | PromiseResultAtomic<unknown>>(null)
  wheneverDone(
    state,
    (result) => {
      lastResult.value = result
    },
    { immediate: true },
  )

  const retriesCount = ref(0)

  function resetCounter() {
    retriesCount.value = 0
  }

  const refreshInterval = useIntervalFn(
    () => {
      retriesCount.value++
      retry()
    },
    options?.interval ?? DEFAULT_ERR_RETRY_INTERVAL,
    {
      immediate: false,
    },
  )

  watch(
    () => !!lastResult.value?.rejected && retriesCount.value < (unref(options?.count) ?? DEFAULT_ERR_RETRY_COUNT),
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
