import { Ref, ShallowRef } from 'vue'

/**
 * Data that may exist or may not.
 *
 * Nesting actual data inside of inner object allows to avoid "empty" type overlap with `T`
 */
export type Option<T> = null | {
  some: T
}

/**
 * Reactive resource SWR state
 */
export interface ResourceState<T> {
  /**
   * Last fetched data
   */
  data: Option<T>
  /**
   * Last fetch error
   */
  error: Option<unknown>
  /**
   * Is fetching currently pending or not
   */
  pending: boolean
  /**
   * Indicates whether resource is fresh or not
   */
  fresh: boolean

  /**
   * TODO doc
   */
  // busy: boolean
}

export interface UseResourceReturn<T> {
  /**
   * Reactive resource. It may be null, if resource key is reactive and falsy.
   */
  resource: ShallowRef<null | Resource<T>>
}

/**
 * Resource state, key and controls.
 *
 * ## Resource key
 *
 * Key is usually needed when you fetch something according to some reactive (or not) parameters. In
 * that case you should construct unique key relative to these parameters and return it with
 * a fetch function. It will create a separate resource in the same resource store, so you can
 * toggle between them without loosing their state.
 *
 * If you have a reactive keyed fetch, and it is re-computed to the same keyed fetch, then update of the fetch function
 * itself is ignored.
 *
 * ## Data refreshing
 *
 * When resource data is outdated, you might refresh it. The resource data will be stale,
 * but the process of its refreshing will be started.
 *
 * This process may be aborted in several cases:
 *
 * - Resource is reset by {@link Resource.reset} or by resetting state at the store
 * - Resource is refreshed *forcefully* while being pending
 * - Composable *reactive* key is changed to another one
 * - Composable scope is disposed
 */
export interface Resource<T> {
  /**
   * Reactive object with resource state.
   */
  state: ResourceState<T>
  key: ResourceKey
  /**
   * Mark **current** resource as not fresh.
   *
   * @param force - if resource is already pending, should it be aborted
   *  and re-fetched [default: `false`]
   */
  refresh: (force?: boolean) => void
  /**
   * Reset **current** resource
   */
  reset: () => void
}

/**
 * Primitive key to distinguish parametrized resources between each other.
 */
export type ResourceKey = string | number | symbol

/**
 * Special key that is used when resource key is not specified explicitly
 */
export const ANONYMOUS_RESOURCE = Symbol('Anonymous')

export interface ResourceStore<T> {
  /**
   * *Reactive* resource getter. If `null` is returned, then resource will be resetted with {@link ResourceStore.set}.
   */
  get: (key: ResourceKey) => ResourceState<T> | null
  /**
   * Resource state setter
   */
  set: (key: ResourceKey, state: ResourceState<T> | null) => void
}

export type FetchFn<T> = (onAbort: FetchFnOnAbort) => Promise<T>

export type FetchFnOnAbort = (fn: () => void) => void

export interface UseResourceParams<T, S extends ResourceStore<T>> {
  /**
   * Static or reactive resource fetching configuration
   */
  fetch: ResourceFetchConfig<T>
  /**
   * Optional custom store. By default, amnesia store is used.
   */
  store?: S
  /**
   * Plugins list
   */
  use?: UseResourcePlugin<T, S>[]
}

/**
 * Setup function. Use {@link vue#onScopeDispose} for cleanup.
 */
export type UseResourcePlugin<T, S extends ResourceStore<T>> = (context: UseResourcePluginSetupContext<T, S>) => void

/**
 * TODO add more options like `onAbort()` etc?
 */
export interface UseResourcePluginSetupContext<T, S extends ResourceStore<T>> {
  resource: Resource<T>
  store: S
}

/**
 * Resource fetching configuration.
 *
 * It may be:
 *
 * - Just a fetch function that resolves to resource data.
 *   In that case it's key considered as {@link ANONYMOUS_RESOURCE}.
 * - Static, but keyed async function.
 * - Reactive resource fetch function, keyed or anonymous.
 *   Also it may be a falsy value in case you need to reactively disable composable at all.
 */
export type ResourceFetchConfig<T> =
  | FetchFn<T>
  | KeyedFetchFn<T>
  | Ref<null | undefined | false | FetchFn<T> | KeyedFetchFn<T>>

export interface KeyedFetchFn<T> {
  key: ResourceKey
  fn: FetchFn<T>
}
