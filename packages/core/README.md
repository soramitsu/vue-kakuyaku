# `@vue-kakuyaku/core`

Toolkit to handle async operations in Vue.

This is the core library of `vue-kakuyaku` project.

## Features

- Focus on the best TypeScript support
  - Promise results are wrapped into strong `Result` types
- Minimal opt-in API
- Suitable for both "fetching data" and "doing side-effect" cases
- Utilities:
  - Retry-on-error
  - Stale-if-error state
  - `EffectScope` utilities to setup promise-based tasks **reactively/lazily**
  - Shorthand watchers for task results
- Abortation support

## Installation

```bash
npm install @vue-kakuyaku/core
```

## Docs

### `Task<T>`

Task is an abstraction around:

- async operation (e.g. returns a `Promise<T>`)
- without any parameters
- (optional) abortable & repeatable

Simplified types shape:

```ts
interface Task<T> {
  state: TaskState<T>
  run: () => Promise<BareTaskRunReturn<T>>
  abort: () => void
}

type TaskState<T> =
  | { kind: 'uninit' }
  | { kind: 'pending' }
  | BareTaskRunReturn<T>

type BareTaskRunReturn<T> = { kind: 'aborted' } | TaskResult<T>

type TaskResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'err'; error: unknown }
```

### Basic functionality with `useTask()`

Setting up & controlling a task:

```ts
const task = useTask(async () => {
  // whatever
  return 42
})

// run;
// also aborts pending run
task.run()

// you could await for exactly this run
const result = await task.run()

// or abort pending run manually
task.abort()
```

Using task state:

```ts
const isPending = computed(() => task.state.kind === 'pending')
```

### Delayed pending (shortest TODO)

```ts
const delayedPending = useDelayedPending(task)
const taskWithDelayedPending = useDelayedPendingTask(task)
```

## Why the name?

"Kakuyaku" (確約) means "Promise" in Japanese.
