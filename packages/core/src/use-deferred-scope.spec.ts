/* eslint-disable max-nested-callbacks */
import { describe, expect, test, vi } from 'vitest'
import { effectScope, isReadonly, onScopeDispose } from 'vue'
import { useDeferredScope } from './use-deferred-scope'

describe('useDeferredScope()', () => {
  test('setup function return value appears after first setup', () => {
    const { setup, scope } = useDeferredScope<number>()

    setup(() => 42)

    expect(scope.value?.expose).toBe(42)
  })

  test('first set up scope disposes after dispose() call', () => {
    const { setup, scope, dispose } = useDeferredScope()
    const disposed = vi.fn()

    setup(() => {
      onScopeDispose(disposed)
    })
    dispose()

    expect(scope.value).toBeNull()
    expect(disposed).toBeCalled()
  })

  test('first set up scope disposes after a new setup()', () => {
    const { setup, scope } = useDeferredScope<number>()
    const disposed = vi.fn()

    setup(() => {
      onScopeDispose(disposed)
      return 42
    })
    setup(() => 43)

    expect(scope.value?.expose).toBe(43)
    expect(disposed).toBeCalled()
  })

  test('set up scope disposes after the main scope disposal', () => {
    const main = effectScope()
    const disposed = vi.fn()

    main.run(() => {
      const { setup } = useDeferredScope()
      setup(() => {
        onScopeDispose(disposed)
      })
    })
    main.stop()

    expect(disposed).toBeCalled()
  })

  test('scope ref is readonly for sure', () => {
    const { scope } = useDeferredScope()

    expect(isReadonly(scope)).toBe(true)
  })
})
