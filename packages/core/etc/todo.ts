import { MaybeRef } from '@vueuse/core'
import { EffectScope, Ref } from 'vue'
import { Task } from '../src/lib'

interface ScopesPool {
  spawn: (setup: (dispose: () => void, scope: EffectScope) => void) => void
  pool: Set<EffectScope>
}

declare function useScopesPool(): ScopesPool

declare function useDelayedPending(task: Task<unknown>): Ref<boolean>

declare function useDelayedPendingTask<T>(task: Task<T>, delay: MaybeRef<number>): Task<T>
