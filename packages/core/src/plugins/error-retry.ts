import { MaybeRef, useIntervalFn } from '@vueuse/core'
import { ref, unref, watch } from 'vue'
import { UseResourcePlugin } from '../types'

export interface ErrorRetryParams {
  /**
   * How many times to retry
   *
   * @default 5
   */
  count?: MaybeRef<number>
  /**
   * How often to retry
   *
   * @default 5_000
   */
  interval?: MaybeRef<number>
}

const DEFAULT_INTERVAL = 5_000
const DEFAULT_COUNT = 5

/**
 * Creates a SWR plugin which will retry fetch in case if error occured
 */
export function pluginErrorRetry(params?: ErrorRetryParams): UseResourcePlugin<any, any> {
  return ({ resource }) => {
    const retriesCount = ref(0)

    const refreshInterval = useIntervalFn(
      () => {
        retriesCount.value++
        resource.refresh()
      },
      params?.interval ?? DEFAULT_INTERVAL,
      {
        immediate: false,
      },
    )

    watch(
      () => !!resource.state.error && retriesCount.value < (unref(params?.count) ?? DEFAULT_COUNT),
      (doRetries) => {
        if (doRetries) {
          refreshInterval.resume()
        } else {
          retriesCount.value = 0
          refreshInterval.pause()
        }
      },
      { immediate: true },
    )
  }
}
