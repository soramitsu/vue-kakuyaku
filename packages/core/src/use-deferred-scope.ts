import { EffectScope, Ref, effectScope, getCurrentScope, shallowReadonly, shallowRef } from 'vue'

export interface ScopeExpose<E> {
  expose: E
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
