import { computed } from 'vue'
import { useTask, useErrorRetry } from '../src/lib'

const task = useTask(() => fetch('/users').then((x) => x.json()))
useErrorRetry(task, { count: 3, interval: 10_000 })
task.run()

const users = computed(() => (task.state.kind === 'ok' ? task.state.data : null))
const isPending = computed(() => task.state.kind === 'pending')
