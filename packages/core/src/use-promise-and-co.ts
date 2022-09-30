import {
  EffectScope,
  Ref,
  WatchOptions,
  WatchSource,
  WatchStopHandle,
  computed,
  effectScope,
  getCurrentScope,
  isRef,
  markRaw,
  readonly,
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
        if (promise === active) {
          state.pending = false
          state.rejected = markRaw({ reason })
        }
        // should we re-throw error further, or just silent it?
        // we do silent, because in this case it is like an abortation
        // of the promise, and any of its results is ignored
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

export type FlatMode = 'all' | 'fulfilled' | 'rejected'

export interface PromiseStateInvariantFulfilledFlat<T, M extends FlatMode> {
  pending: false
  fulfilled: M extends 'all' | 'fulfilled' ? T : { value: T }
  rejected: null
}

export interface PromiseStateInvariantRejectedFlat<M extends FlatMode> {
  pending: false
  fulfilled: null
  rejected: M extends 'all' | 'rejected' ? unknown : { reason: unknown }
}

export type PromiseStateAtomicFlat<T, M extends FlatMode> =
  | PromiseStateInvariantEmpty
  | PromiseStateInvariantPending
  | PromiseStateInvariantFulfilledFlat<T, M>
  | PromiseStateInvariantRejectedFlat<M>

export function flattenState<T>(state: PromiseStateAtomic<T>): PromiseStateAtomicFlat<T, 'fulfilled'>

export function flattenState<T, M extends FlatMode>(state: PromiseStateAtomic<T>, mode: M): PromiseStateAtomicFlat<T, M>

export function flattenState<T, M extends FlatMode>(
  state: PromiseStateAtomic<T>,
  mode?: M,
): PromiseStateAtomicFlat<T, M> {
  // TODO implement with Proxy?

  const definitelyMode = (mode ?? 'fulfilled') as M

  return readonly({
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
