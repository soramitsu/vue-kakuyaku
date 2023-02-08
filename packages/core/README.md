# `@vue-kakuyaku/core`

Toolkit to handle async operations in Vue.

This is the core library of `vue-kakuyaku` project.

## Features

- Focus on the best TypeScript support
- Minimal opt-in API
- Suitable for both "fetching data" and "doing side effect" cases
- Utilities:
  - [Retry-on-error](#retry-on-error-with-useerrorretry)
  - [Stale-if-error](#stale-if-error-with-usestalestate) state
  - [Shorthand watchers](#watcher-shorthands-for-the-state) for task results
  - [Non-parametrised](#set-up-an-async-action-in-separate-scope-with-usedeferredscope) and [reactively parametrised](#reactively-parametrised-scope-with-useparamscope) scopes to model async operations stronger

## Installation

```bash
npm install @vue-kakuyaku/core
```

## Docs

### Atomic Promise State

The core primitive type of the library is `PromiseStateAtomic<T>`. It describes all possible states of a Promise at a given time in **type-safe** and **exclusive** manner.

`PromiseStateAtomic<T>` is a set of mutually exclusive invariants:

```ts
type PromiseStateAtomic<T> =
  // uninit
  | { rejected: null; fulfilled: null; pending: false }
  // pending
  | { rejected: null; fulfilled: null; pending: true }
  // fulfilled
  | { rejected: null; fulfilled: { value: T }; pending: false }
  // rejected
  | { rejected: { reason: unknown }; fulfilled: null; pending: false }
```

Compared to other libraries that work with promises, `PromiseStateAtomic<T>` is **type-safe** for the following reasons:

- Empty `fulfilled` and `rejected` states are deterministically distinguished from their existence, even if the promise resolves/rejects with a nullable value.
- `rejected.reason` is an `unknown`, not an `Error` or unsafe `any`, which is how JavaScript works: anything could be `throw`n.

`PromiseStateAtomic<T>` is **exclusive** because at any given moment promise is either pending, rejected, fulfilled or empty, and not a mix of them. Thus, TypeScript narrows types on assertions:

```ts
declare const state: PromiseStateAtomic<string>

if (state.pending) {
  // No error: TypeScript narrows the types of
  // `rejected` and `fulfilled`
  const a: null = state.rejected || state.fulfilled
}
```

Let's proceed to the utilities built around `PromiseStateAtomic<T>`.

### Basics with `usePromise()`

This composable gives a basic reactive model over any promise you put into it:

```ts
import { computed } from 'vue'

async function getString() {
  return '42'
}

const { state, set, clear } = usePromise<string>()

// `state` is a reactive object
// initially it is an empty state
const isPending = computed(() => state.pending)

// passing a `Promise<string>`
set(getString())

// forget the currently tracked promise if there is any
clear()
```

`usePromise<T>()` composable returns:

- Reactive **`state`** which is `PromiseStateAtomic<T>`
- Method to **set** a promise (`set(promise: Promise<T>)`) so its state will be reflected in `state`
- Method to **clear** (`clear()`) the composable to the initial empty state.

**Note**: if a new promise is `set` while the previous one is pending, the result of the previous is ignored.

### Repetitive action with `useTask()`

This composable is almost like `usePromise()`, but it accepts an async _non-parametrised_ function in it to repeat it over and over again. It is useful when the action is not based on any input parameters (at least within a [scope](#set-up-an-async-action-in-separate-scope-with-usedeferredscope)).

```ts
const { state, run, clear } = useTask(async () => {
  await delay(300)
  return 42
})

// this callback does not accept any parameters
run()
```

The task could be run immediately if the options are passed:

```ts
const task1 = useTask(fn, {
  immediate: true,
})

// equivalent to

const task2 = useTask(fn)
task2.run()
```

You might ask: why not accept parameters in `run(...args)` and forward them into the async function? TypeScript is not good at extracting parameter types, especially for overloaded functions. This means that if there are reactive parameters, it is better to use scopes.

### Watcher shorthands for the state

There are the following shorthands:

- `wheneverFulfilled`
- `wheneverRejected`
- `wheneverDone`

They are just simple wrappers around Vue's `watch`.

```ts
declare const state: PromiseStateAtomic<{ foo: 'bar' }>

wheneverFulfilled(state, ({ foo }) => {
  console.log('Guess what "foo" is:', foo)
})

wheneverRejected(
  state,
  (reason) => {
    console.error('Whoops:', reason)
  },
  {
    // default `watch` options
    flush: 'sync',
  },
)

wheneverDone(state, (result) => {
  if (result.rejected) {
    // TS narrowing works here as well
    console.error(result.rejected.reason)
  } else {
    console.log(result.fulfilled.value)
  }
})
```

Each watcher accepts `options` which are identical to the options that `watch` accepts.

### Flatten the state with `flattenState()`

Sometimes there is a need to reduce verbosity while accessing `PromiseStateAtomic<T>`'s `fulfilled` and `rejected` fields:

```ts
declare const state: PromiseStateAtomic<{ bar: 'baz' }>

if (state.fulfilled) {
  const baz = state.fulfilled.value.bar
}
```

In this example, there is no need for `fulfilled` to be `null | { value: { bar: 'baz' } }` in order to distinguish empty fulfilled state from the existing one. It would be enough to use `null | { bar: 'baz' }`.

For such a case, the state could be reactively flattened when there is no need for nested `fulfilled.value` and `rejected.reason` fields:

```ts
const flattenedState = flattenState(state)

if (flattenedState.fulfilled) {
  const baz = state.fulfilled.bar
}
```

You can pass `mode` argument to control which fields are flattened:

```ts
// `all`, `fulfilled` (default) and `rejected` are accepted
flattenState(state, 'all')
```

### Retry on error with `useErrorRetry()`

This composable watches for the promise's state. If it is `rejected`, the composable invokes the callback (assuming that it will trigger the state to refresh) for a given number of times with a given interval.

```ts
const { state, run } = useTask(
  async () => {
    if (Math.random() > 0.5) throw new Error('bad luck')
  },
  { immediate: true },
)

useErrorRetry(state, () => run(), {
  // default - 5
  count: 10,
  // default - 5000
  interval: 300,
})
```

### Stale if error with `useStaleState()`

This composable is a tiny and lightweight implementation of [stale-while-revalidate](https://web.dev/stale-while-revalidate/) pattern. In short, it is about caching and using successful result while they are revalidating, even with failures.

```ts
declare const state: PromiseStateAtomic<string>

const staleState = useStaleState(state)
```

The atomic `state` is converted to the `staleState` that is of type `PromiseStaleState<T>`:

```ts
interface PromiseStaleState<T> {
  fulfilled: null | { value: T }
  rejected: null | { reason: unknown }
  pending: boolean
  fresh: boolean
}
```

When the _atomic_ state becomes _fulfilled_, the _stale_ state updates its `fulfilled` value and removes the last rejection reason if there was any. When the _atomic_ state becomes _rejected_, the _stale_ state only updates the rejection reason without touching the last `fulfilled` value.

`PromiseStaleState<T>` type is not [_exclusive_](#atomic-promise-state): the stale state might have a fulfilled value, a rejection reason and be pending **at the same time**. You might think of it as of a `PromiseStateAtomic<T>` with memory about its previous executions.

This utility might be useful in simple scenarios. However, it cannot be compared to libraries such as [`Kong/swrv`](https://github.com/Kong/swrv) or [`ConsoleTVs/vswr`](https://github.com/ConsoleTVs/vswr), which implement SWR pattern in a much more comprehensive way. However, these libraries have their own drawbacks. Thus, `@vue-kakuyaku/swr` is planned to be a competitive solution.

### Set up an async action in separate scope with `useDeferredScope()`

When it comes to modeling async actions within a component (or any other reactive scope), it might become a mess if action's lifetime is not the same as the component's one. It might be initialised on some event, or discarded on another. You might need to set up reactive stuff around this action (such as timers, retrying, showing notifications etc) during the **component's** setup stage.

Luckily for us, Vue provides [API](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md) for creating our own scopes! With them, we can isolate async actions and their reactive stuff within a dedicated scope which we can set up and dispose at any time. `useDeferredScope<T>()` does exactly this.

Check this example to see how it works:

```ts
interface Params {
  username: string
  password: string
}

const {
  // it is a `Ref<null | { expose: T }>, where `expose` is
  // what is returned from the scope's setup function
  scope: loginScope,

  setup: loginSetup,
  dispose: cleanLogin,
} = useDeferredScope<{
  isOk: Ref<boolean>
  retry: () => void
  // sometimes we want to know the exact params of the last login
  params: Params
}>()

function doLogin(params: Params) {
  // if the scope is already set up, it will be disposed
  loginSetup(() => {
    // during this function we can setup any reactive logic and
    // be sure that it will be cleared automatically on scope dispose

    const { state, run } = useTask(() => httpLogin(params), {
      immediate: true,
    })

    const isOk = computed(() => !!state.fulfilled)

    return { isOk, params, retry: run }
  })
}

const isLoginOk = computed(
  () => loginScope.value?.expose.isOk ?? false,
)

function retryLogin() {
  loginScope.value?.expose.retry()
}
```

> We follow [existing Vue semantics](https://vuejs.org/api/options-state.html#expose) around the `expose` keyword.

This utility is a bit low-level. One of the very common cases when this utility is not very useful is when you need to set up an async action based on reactive parameters. The next section provides a solution for this scenario.

### Reactively parametrised scope with `useParamScope()`

Consider the following common scenario: you have a reactive `userId` and you need to fetch user data for the given ID. Additionally, you might need to set up some reactive logic around it.

Here is how it might look when you use `useParamScope()`:

```ts
const userId = ref(1)

const scope = useParamScope(
  // reactive key - a ref or a getter
  userId,

  // setup function, that accepts the resolved key for the scope
  (staticUserId) => {
    const { state, run } = useTask(
      () => fetch(`/users/${staticUserId}`),
      { immediate: true },
    )

    useErrorRetry(state, run)
    const staleState = useStaleState(state)

    return staleState
  },
)

const userData = computed(() => scope.value.expose.fulfilled?.value)
```

Whenever the reactive (and **primitive**, i.e. `number | string | symbol | boolean`, such as [Vue's `key` attr](https://vuejs.org/api/built-in-special-attributes.html#key) (except `boolean`)) key is changed, the existing scope is disposed, and the new one is set up.

The key might be **composed**, i.e. have a non-primitive **payload** associated with the primitive value:

```ts
const params = reactive({ length: 5, width: 1 })

const scope = useParamScope(
  () => ({
    // `key` is the source of truth for tracking changes
    // if `payload` is changed on re-computation, but `key` is not,
    // the change will be ignored
    key: `${params.length}-${params.width}`,
    payload: { ...params },
  }),
  ({ payload: params }) => {
    // ...
  },
)
```

The key might be `boolean` if you only need to toggle the scope's existence:

```ts
const enabled = ref(false)

useParamScope(enabled, () => {
  useIntervalFn(() => console.log('I am alive!!!'), 300)
})
```

### Miscellaneous

**`delay(ms: number)`**:

```ts
await delay(500)
```

**`deferred()`**:

```ts
const promise = deferred<number>()

promise.then((x) => {
  console.log('Number:', x)
})

promise.resolve(42)
```

## Why the name?

"Kakuyaku" (確約) means "Promise" in Japanese.
