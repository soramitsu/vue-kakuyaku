import { reactive } from 'vue'
import { ResourceKey, ResourceState, ResourceStore } from './types'

export type AmnesiaStoreStorage<T> = Map<ResourceKey, ResourceState<T> | null>

export interface AmnesiaStore<T> extends ResourceStore<T> {
  storage: AmnesiaStoreStorage<T>
}

export function createAmnesiaStore<T>(): AmnesiaStore<T> {
  const storage = reactive<AmnesiaStoreStorage<T>>(new Map())

  return {
    storage,
    get(key) {
      return storage.get(key) ?? null
    },
    set(key, state) {
      storage.set(key, state)
    },
  }
}
