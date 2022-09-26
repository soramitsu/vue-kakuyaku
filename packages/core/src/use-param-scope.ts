import { Ref, WatchSource, computed, isRef, watch } from 'vue'
import { ScopeExpose, useDeferredScope } from './use-deferred-scope'

/**
 * Used for scopes utilities. Primitive type (same as Vue's `:key`) to distinguish scopes from each other.
 */
export type ScopeKey = string | number | symbol

export type FalsyScopeKey = false | null | undefined

export interface ComposedKey<K extends ScopeKey, P> {
  key: K
  payload: P
}

export type UniScopeKey = ScopeKey | ComposedKey<ScopeKey, any>

export type SpreadKey<U extends UniScopeKey> = U extends ComposedKey<infer K, infer P>
  ? { key: K; payload: P }
  : { key: U }

export type KeyOnly<U extends UniScopeKey> = U extends ComposedKey<infer K, any> ? K : U

function getKeyOnly<U extends UniScopeKey>(key: U): KeyOnly<U> {
  if (typeof key === 'string') return key as KeyOnly<U>
  return (key as any).key as KeyOnly<U>
}

function spreadKey<U extends UniScopeKey>(key: U): SpreadKey<U> {
  if (typeof key === 'object') return key as any
  return { key } as any
}

function falsyKeyToMaybe<U extends UniScopeKey>(value: U | FalsyScopeKey): null | { some: U } {
  if (value === null || value === undefined || value === false) return null
  return { some: value }
}

export type KeyedScopeExpose<E, U extends UniScopeKey> = ScopeExpose<E> & SpreadKey<U>

export function useParamScope<E, K extends UniScopeKey | FalsyScopeKey>(
  key: WatchSource<K>,
  setup: (resolvedKey: K & UniScopeKey) => E,
): Ref<K extends UniScopeKey ? KeyedScopeExpose<E, K> : null> {
  const deferred = useDeferredScope<ScopeExpose<E> | KeyedScopeExpose<E, UniScopeKey>>()

  const filteredKey = computed(() => {
    const value = isRef(key) ? key.value : key()
    const maybe = falsyKeyToMaybe(value)
    return maybe
  })

  watch(
    () => {
      const value = filteredKey.value
      if (!value) return null
      const onlyKey = getKeyOnly(value.some)
      return onlyKey
    },
    (onlyKey) => {
      if (!onlyKey) {
        deferred.dispose()
      } else {
        deferred.setup(() => {
          const fullKey = filteredKey.value!.some

          const expose = setup(fullKey as any)
          return { expose, ...spreadKey(fullKey) }
        })
      }
    },
    { immediate: true },
  )

  return computed(() => deferred.scope.value?.expose ?? null) as any
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest

  test.each([
    [false, null],
    [null, null],
    [undefined, null],
    ['foo', { some: 'foo' }],
    [{ key: 'jey' }, { some: { key: 'jey' } }],
  ] as [UniScopeKey | FalsyScopeKey, null | { some: UniScopeKey }][])(
    `%o is %o after falsy filter`,
    (before, after) => {
      expect(falsyKeyToMaybe(before)).toEqual(after)
    },
  )
}
