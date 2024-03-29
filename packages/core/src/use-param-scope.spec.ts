import { describe, expect, test, vi } from 'vitest'
import { Ref, nextTick, onScopeDispose, ref } from 'vue'
import { ScopeExpose } from './use-deferred-scope'
import { KeyedScopeExpose, useParamScope } from './use-param-scope'
import { PromiseStateAtomic, useTask } from './use-promise-and-co'
import { Equal, Expect } from './test-helpers'

const typeAssertionsScope = false as boolean

if (typeAssertionsScope) {
  const scopeWithNullKey = useParamScope(
    () => null,
    () => {},
  )

  type test1 = Expect<Equal<typeof scopeWithNullKey, Ref<null>>>

  const scopeWithNullKeyButNumberExpose = useParamScope(
    () => null,
    () => 42,
  )

  type test2 = Expect<Equal<typeof scopeWithNullKeyButNumberExpose, Ref<null>>>

  const scopeWithBoolOrNumKey = useParamScope(
    () => (Math.random() > 4 ? false : 4),
    () => 42,
  )

  type test3 = Expect<Equal<typeof scopeWithBoolOrNumKey, Ref<null | KeyedScopeExpose<number, 4>>>>

  const scopeWithBoolKey = useParamScope(
    () => Math.random() > 0.5,
    () => 42,
  )

  type test4 = Expect<Equal<typeof scopeWithBoolKey, Ref<null | ScopeExpose<number>>>>

  const scopeWithTrueKey = useParamScope(
    () => true,
    () => 42,
  )

  type test5 = Expect<Equal<typeof scopeWithTrueKey, Ref<ScopeExpose<number>>>>

  useParamScope(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-inferrable-types
      const value: boolean = false
      if (value) return null

      return {
        key: 'abc',
        payload: { foo: 'bar' },
      }
    },
    ({ payload }) => {
      const { state } = useTask(async () => payload.foo)

      type test1 = Expect<typeof state extends PromiseStateAtomic<string> ? true : false>

      // check state `state` is not `any`
      type test2 = Expect<typeof state extends PromiseStateAtomic<number> ? false : true>
    },
  )
}

describe('useParamScope', () => {
  test('when composed key is updated to the same key, scope is still', async () => {
    const fnSetup = vi.fn()
    const fnDispose = vi.fn()

    const counter = ref(0)

    useParamScope(
      () => {
        return { key: 'hey', payload: counter.value }
      },
      () => {
        fnSetup()
        onScopeDispose(fnDispose)
      },
    )

    expect(fnSetup).toBeCalledTimes(1)

    counter.value++
    await nextTick()
    counter.value++
    await nextTick()
    counter.value++
    await nextTick()

    expect(fnSetup).toBeCalledTimes(1)
    expect(fnDispose).toBeCalledTimes(0)
  })

  test('when key is string, only key is passed into setup', async () => {
    const fn = vi.fn()

    useParamScope(() => 'hey', fn)

    await nextTick()
    expect(fn).toBeCalledWith('hey')
  })

  test('when key is composed, payload and key are passed into setup', () => {
    const fn = vi.fn()
    const PAYLOAD = { foo: 'bar' }

    useParamScope(() => ({ key: '123', payload: PAYLOAD }), fn)

    expect(fn).toBeCalledWith({ key: '123', payload: PAYLOAD })
  })

  test('when key is `true`, then setup fn is called with `true`', () => {
    const fn = vi.fn()

    useParamScope(() => true, fn)

    expect(fn).toBeCalledWith(true)
  })

  test('when key is `true`, then only `expose` is provided', () => {
    const scope = useParamScope(
      () => true,
      () => 42,
    )

    expect(scope.value).toEqual({ expose: 42 })
  })
})
