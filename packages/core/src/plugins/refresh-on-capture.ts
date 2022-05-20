import { UseResourcePlugin } from '../types'

export function pluginRefreshOnCapture(): UseResourcePlugin<any, any> {
  return ({ resource }) => {
    if (resource.state.data) {
      resource.refresh()
    }
  }
}

if (import.meta.vitest) {
  const { test, expect, vi } = import.meta.vitest

  test("it doesn't call `refresh()` if there is no data initially", () => {
    const fn = vi.fn()

    pluginRefreshOnCapture()({ resource: { state: { data: null } as any, refresh: fn } } as any)

    expect(fn).not.toBeCalled()
  })

  test('it calls `refresh()` if there is data initially', () => {
    const fn = vi.fn()

    pluginRefreshOnCapture()({ resource: { state: { data: { some: null } } as any, refresh: fn } } as any)

    expect(fn).toBeCalledWith()
  })
}
