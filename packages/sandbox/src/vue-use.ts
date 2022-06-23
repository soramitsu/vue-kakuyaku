import { useAsyncState } from '@vueuse/core'
import axios from 'axios'
import { reactive, watch } from 'vue'

function setup1() {
  const { state, error, isLoading, isReady, execute } = useAsyncState(axios.get('/users'), null, {
    immediate: false,
    delay: 600,
    resetOnExecute: true,
    onError(e) {
      console.error(e)
    },
  })

  execute(500)
}

function setup2() {
  const params = reactive({ a: 0, b: 'foo' })

  const { execute, state } = useAsyncState(async () => axios.get(`/users/${params.a}/${params.b}`), null)

  watch(params, () => execute())
}

function setup2_1() {
  const { execute } = useAsyncState(async (a: number, b: string) => fetch(`/users/${a}/${b}`), null)

  const params = reactive({ a: 0, b: 'foo' })

  watch(params, ({ a, b }) => execute(300, a, b))

  // OOPS! No type errors!
  execute(500, 'foo', false)
}

// callback
function setup3() {
  const { isLoading, error, execute } = useAsyncState(async (body: unknown) => {
    await axios.post('/users/new', body)
    return null
  }, null)

  function createUser(user: { name: string }) {
    execute(0, user)
  }
}

// pros
// later execute
// execute with delay
// no state Ref<null | T> - можно указать свой тип Option<T> например

// cons
// нужно указать initial state обязательно
// execute() передаёт аргументы, но без типов
// confusing, если нужен просто callback
