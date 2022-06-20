import { computed, reactive, ref, watch, Ref, onScopeDispose, shallowRef } from 'vue'
import { Task, useErrorRetry, useInertState, useScope, useTask, useDanglingScope, TaskInertState } from './lib'
import { useStaleWhileRevalidate, StateExpanded, Storage } from '../../swr/src/lib'

async function delay(ms: number): Promise<void> {
  // ...
}

function doing_async_action() {
  const task = useTask(async () => {
    await delay(500)
  })
  const inert = useInertState(task)

  const pending = computed<boolean>(() => inert.pending)

  function onClick() {
    task.run()
  }
}

function conditional_immediate_data_fetching() {
  const shouldFetch = ref(false)

  const maybeTask = useScope(shouldFetch, () => {
    const task = useTask(async () => {
      await delay(20)
      return 20
    })
    task.run()
    return task
  })

  const maybeNumber = computed<number | null>(() => {
    const state = maybeTask.value?.setup.state
    if (state?.kind === 'ok') return state.result
    return null
  })
}

function reactive_key() {
  const key = ref('foo')

  const keyed = useScope(key, (key) => useTask(async () => key + Math.random()))

  const initKey: string | number | symbol = keyed.value.key
  const initPending: boolean = keyed.value.setup.state.kind === 'pending'
}

function retry_on_error() {
  function useErrorRetry(task: Task<any>) {
    function doRetry() {
      task.run()
      // and retry...
    }

    function stopRetry() {
      // ...
    }

    watch(
      () => task.state.kind === 'err',
      (val) => {
        if (val) doRetry()
        else stopRetry()
      },
      { immediate: true, flush: 'sync' },
    )
  }

  const handle = useTask(async () => Math.random())
  useErrorRetry(handle)
}

/**
 * SWR means we need to stale old data while fetching for a new one
 */
function impl_swr() {
  const key = ref('foo')
  const storage: Storage<StateExpanded<any>> = reactive(new Map())

  const scope = useScope(
    computed(() => Math.random() > 42 && key.value),
    (key) => {
      const task = useTask(async () => key)
      const { state } = useStaleWhileRevalidate<string>({ task, key }, storage)

      const isPending = computed<boolean>(() => state.value.pending)
      const fetchedData = computed<string | null>(() => state.value.result?.some ?? null)

      return { isPending, fetchedData }
    },
  )

  const isPending = computed<boolean>(() => scope.value?.setup.isPending.value ?? false)
  const fetchedData = computed<string | null>(() => scope.value?.setup.fetchedData.value ?? null)
}

/**
 * We need to perform a side effect far after component initialization. We need to pass parameters
 * into async function. We might also need to error-retry this task, or to stale it's error
 *
 * But we need to statically know
 * task state to display it in component's template
 */
function submit_form() {
  async function doSubmit(age: number, sex: 'm' | 'f'): Promise<void> {
    // ...
  }

  const dangling = useDanglingScope<{ task: Task<void>; inert: TaskInertState<void> }>()

  const danglingTask = computed<Task<void> | undefined>(() => dangling.scope.value?.setup.task)
  const isPending = computed(() => dangling.scope.value?.setup.inert.pending ?? false)

  function clickSubmit(params: { age: number; sex: 'm' | 'f' }) {
    dangling.setup(() => {
      const task = useTask(() => doSubmit(params.age, params.sex))
      const inert = useInertState(task)
      useErrorRetry(task)
      return { task, inert }
    })
  }
}
