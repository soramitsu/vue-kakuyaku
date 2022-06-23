import { usePromise } from 'vue-promised'
import axios from 'axios'
import { ref, reactive, watch, computed } from 'vue'

function setup1() {
  const { data, error, isDelayElapsed, isPending, isRejected, isResolved } = usePromise(axios.get('/users'))
}

// side effect
function setup2() {
  const myAction = ref<null | Promise<void>>(null)

  function doAction() {
    myAction.value = axios.post('/hey')
  }

  const PENDING_DELAY = 500
  const { data } = usePromise(myAction, PENDING_DELAY)
}

// fetch with parameter & keep alive data
function setup3() {
  const storage = reactive(new Map<number, unknown>())

  const userId = ref(42)
  const loadedUser = computed(() => storage.get(userId.value))

  const fetchPromise = ref<null | Promise<void>>(null)
  const { isPending } = usePromise(fetchPromise)

  watch(
    userId,
    (id) => {
      fetchPromise.value = fetch(`/users/${id}`).then(async (x) => {
        storage.set(id, await x.json())
      })
    },
    { immediate: true },
  )

  return { loadedUser, isPending }
}

// data - Ref<null | undefined | T> | null-проблема
// error - Ref<Error> | должно быть unknown
// no abort
