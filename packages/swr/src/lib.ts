import { TaskFn, Task, FalsyScopeKey, ScopeKey, TaskState, TaskStaleIfErrorState } from '@vue-async/core'
import { Ref, watch, shallowRef } from 'vue'

export type Maybe<T> = null | {
  some: T
}

// export interface StateExpanded<T> {
//   result: Maybe<T>
//   error: Maybe<unknown>
//   //   fresh: boolean
//   pending: boolean
// }

export type Storage<T> = Pick<Map<ScopeKey, TaskStaleIfErrorState<T>>, 'get' | 'set'>

export function expandState<T>(state: TaskState<T>): StateExpanded<T> {
  return {
    result: state.kind === 'ok' ? { some: state.result } : null,
    error: state.kind === 'err' ? { some: state.error } : null,
    pending: state.kind === 'pending',
    // fresh: state.kind === 'ok',
  }
}

function useStorage<T>(state: TaskStaleIfErrorState<T>, storage: Storage<T>): Ref<TaskStaleIfErrorState<T>> {}

export function useStaleWhileRevalidate<T>(
  { task, key }: { task: Task<T>; key: ScopeKey },
  storage: Storage<StateExpanded<T>> = new Map(),
): {
  state: Ref<StateExpanded<T>>
  refresh: (abort?: boolean) => void
} {
  const state = shallowRef<StateExpanded<T>>(null as any)

  watch(
    () => storage.get(key),
    (stateInStorage) => {
      if (stateInStorage) {
        state.value = stateInStorage
      } else {
        state.value = expandState(task.state)
        storage.set(key, state.value)
      }
    },
    { immediate: true },
  )

  watch(
    () => task.state,
    (val) => {
      if (state.value) {
        if (val.kind === 'err') {
          state.value.error = { some: val.error }
          state.value.pending = false
        } else if (val.kind === 'ok') {
          state.value.result = { some: val.result }
          state.value.error = null
          state.value.pending = false
        } else if (val.kind === 'pending') {
          state.value.pending = true
        }
      }
    },
    { immediate: true, flush: 'sync' },
  )

  function refresh(abort?: boolean) {
    task.run(abort)
  }

  return { state, refresh }
}

// export function useStaleWhileRevalidate<T>(
//   data: ActionFn<T> | Ref<FalsyValue | ActionFn<T> | KeyedActionFn<T>>,
//   params?: UseAsyncParams & { storage: Storage<StateExpanded<T>> },
// ): {
//   handle: Ref<null | {
//     raw: AsyncHandle<T>
//     state: StateExpanded<T>
//     refresh: (abort?: boolean) => void
//   }>
// } {
//   const { handle: raw } = useAsync(data, params)
// }
