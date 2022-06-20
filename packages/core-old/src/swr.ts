import {
  EffectScope,
  Ref,
  WatchSource,
  computed,
  effectScope,
  getCurrentScope,
  markRaw,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  unref,
  watch,
} from 'vue'
import { whenever } from '@vueuse/core'
import {
  ANONYMOUS_RESOURCE,
  FetchFnOnAbort,
  KeyedFetchFn,
  Option,
  Resource,
  ResourceFetchConfig,
  ResourceKey,
  ResourceState,
  ResourceStore,
  UseResourceParams,
  UseResourcePluginSetupContext,
  UseResourceReturn,
} from './types'
import { createAmnesiaStore } from './amnesia'

function resourceEmptyState<T>(): ResourceState<T> {
  return {
    data: null,
    error: null,
    fresh: false,
    pending: false,
  }
}

const FETCH_TASK_ABORTED = Symbol('Aborted')

export function useSwr<T, S extends ResourceStore<T>>(params: UseResourceParams<T, S>): UseResourceReturn<T> {
  const fetch = normalizeFetch(params.fetch)
  const resource = shallowRef<null | Resource<T>>(null)
  const store = (params.store ?? createAmnesiaStore()) as S

  useSourceScope<ResourceKey>(
    () => {
      const keyedFetch = fetch.value
      return keyedFetch && { some: keyedFetch.key }
    },
    (keyStatic) => {
      const state = computed(() => store.get(keyStatic))

      function reset() {
        store.set(keyStatic, resourceEmptyState())
      }

      whenever(
        () => !state.value,
        () =>
          // promise is required here because of some strange vue behavior
          Promise.resolve().then(reset),
        { immediate: true },
      )

      // Resource fetch triggering scope when ownership is confirmed

      useSourceScope(
        () => state.value && { some: state.value },
        (state) => {
          const currentFetchTask = ref<null | { promise: Promise<void>; abort: () => void }>(null)

          function abortFetchTaskIfThereIsSome() {
            state.pending = false
            currentFetchTask.value?.abort()
            currentFetchTask.value = null
          }

          const triggerExecuteFetch = computed<boolean>(() => !state.pending && !state.fresh)
          whenever(
            triggerExecuteFetch,
            () => {
              // maybe state changed
              abortFetchTaskIfThereIsSome()

              const { abort, onAbort } = initFetchAbort()
              const promise = executeFetch({
                fetch: fetch.value!,
                state,
                onAbort,
                // eslint-disable-next-line max-nested-callbacks
              }).finally(() => {
                if (promise === currentFetchTask.value?.promise) {
                  currentFetchTask.value = null
                }
              })

              currentFetchTask.value = { promise, abort }
            },
            { immediate: true },
          )

          function refresh(force?: boolean): void {
            state.fresh = false

            if (force) {
              abortFetchTaskIfThereIsSome()
            }
          }

          let res = readonly<Resource<T>>({
            state,
            key: keyStatic,
            refresh,
            reset,
          }) as Resource<T>

          resource.value = res

          const pluginCtx: UseResourcePluginSetupContext<T, S> = {
            resource: res,
            store,
          }

          for (const plugin of params.use ?? []) {
            try {
              plugin(pluginCtx)
            } catch (err) {
              console.error('Plugin (%o) setup failed: %o', plugin, err)
            }
          }

          onScopeDispose(() => {
            abortFetchTaskIfThereIsSome()
            resource.value = null
          })
        },
      )
    },
  )

  return { resource }
}

/**
 * Normalizes variative configuration to keyed fetch
 */
function normalizeFetch<T>(fetch: ResourceFetchConfig<T>): Ref<null | KeyedFetchFn<T>> {
  return computed(() => {
    const value = unref(fetch)

    if (!value) return null

    if (typeof value === 'function')
      return {
        key: ANONYMOUS_RESOURCE,
        fn: value,
      }

    return value
  })
}

function useSourceScope<T>(source: WatchSource<Option<T>>, setup: (value: T) => void) {
  const main = getCurrentScope() || effectScope()
  let scope: null | EffectScope = null

  watch(
    source,
    (value) => {
      if (scope) {
        scope.stop()
        scope = null
      }
      if (value) {
        main.run(() => {
          scope = effectScope()
          scope.run(() => setup(value.some))
        })
      }
    },
    { immediate: true },
  )
}

interface ExecuteFetchParams<T> {
  fetch: KeyedFetchFn<T>
  state: ResourceState<T>
  onAbort: FetchFnOnAbort
}

/**
 * Run fetch and update state accordingly to progress. May be aborted.
 *
 * On abortation does not commit any results to the store.
 */
async function executeFetch<T>({ fetch, state, onAbort }: ExecuteFetchParams<T>): Promise<void> {
  state.pending = true
  let result: typeof FETCH_TASK_ABORTED | T

  try {
    result = await new Promise((resolve, reject) => {
      onAbort(() => {
        resolve(FETCH_TASK_ABORTED)
      })

      fetch.fn(onAbort).then(resolve).catch(reject)
    })

    if (result === FETCH_TASK_ABORTED) return

    state.data = someMarkRaw(result)
    state.fresh = true
    state.error = null
    state.pending = false
  } catch (err) {
    state.error = someMarkRaw(err)
    state.fresh = true
    state.pending = false
  }
}

interface FetchAbort {
  onAbort: FetchFnOnAbort
  abort: () => void
}

function initFetchAbort(): FetchAbort {
  const hooks: (() => void)[] = []

  return {
    onAbort: (fn) => hooks.push(fn),
    abort: () => {
      for (const fn of hooks) {
        try {
          fn()
        } catch (err) {
          console.error('Fetch abortation hook error:', err)
        }
      }
    },
  }
}

function someMarkRaw<T>(some: T): Option<T> {
  return markRaw({ some })
}
