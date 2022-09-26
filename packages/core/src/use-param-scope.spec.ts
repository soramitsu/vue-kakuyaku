import { describe, expect, test, vi } from 'vitest'
import { Ref, nextTick, onScopeDispose, ref } from 'vue'
import { KeyedScopeExpose, useParamScope } from './use-param-scope'

function assertType<T>(value: T): void {}

assertType<Ref<null>>(
  useParamScope(
    () => null,
    () => {},
  ),
)

assertType<Ref<null>>(
  useParamScope(
    () => null,
    () => 42,
  ),
)

assertType<Ref<null | KeyedScopeExpose<number, number>>>(
  useParamScope(
    () => (Math.random() > 4 ? false : 4),
    () => 42,
  ),
)

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
})
