# @vue-swr-composable/core

[Stale-while-revalidate](https://datatracker.ietf.org/doc/html/rfc5861#section-3) data caching pattern for Vue 3.

## Features

- ✨ Minimal functional API. No singletons, no side effects.
- 💎 Declarative data fetching with pending and error states
- 📦 Transport-agnostic
- 💢 Stale-if-error
- 🔀 Parametrized resources with reactive keys
- 💾 Customazible storage
- 🔧 TypeScript ready
  - 📃 Doc comments included
- ⚪️ `null` data is also supported!
- 🚫 Fetch abortation

### Plugins

Some logic is quite simple to be moved into lightweight plugins:

- 🔄 **Refresh On Capture** - refreshes resource when composable is initialized again and resource is already presented in the store.
- ☝️ **Error Retry** - refetch resource in case its fetch is errored. Retries N times with M interval.

### Not yet implemented extensions

- Request deduplication
- Revalidation on focus
- Resource time-to-live

### Not tested / implemented

- SSR support

---

PRs are welcome!

## Quick example

```vue
<script setup>
const { resource } = useSwr({
  fetch: () => fetchSomething(),
})
</script>

<template>
  <p v-if="resource.state.data">
    Data: {{ resource.state.data.some }}
  </p>
  <p v-if="resource.state.error">
    Error: {{ resource.state.error.some }}
  </p>
  <p v-if="resource.state.pending">Pending...</p>
  <button @click="resource.refresh()">Refresh</button>
</template>
```

Parametrized fetch:

```ts
useSwr({
  // just an async function
  fetch: async () => 42,

  // dynamic resource with possible `null` state
  fetch: computed(() => {
    if (!isResourceActive.value) return null

    // Keyed resource
    return {
      key: `user-${id.value}`,
      fn: () => fetchUser(id.value),
    }

    // ..or anonymous
    return () => fetchUsers()
  }),

  // keyed, but static resource
  // useful when store is shared
  fetch: {
    key: 'foo',
    fn: async () => 42,
  },
})
```

## Install

```bash
npm i @vue-swr-composable/core
```

## Known limitations

- Composable will not work properly if there is a multiple ownership over a resource. It means that if you use shared storage and two composables with the same key are trying to work with the associated resource, they will conflict:

  ```ts
  const store = createAmnesiaStore()

  useSwr({
    fetch: async () => 42,
    store,
  })

  useSwr({
    fetch: async () => 43,
    store,
  })
  ```

  To handle such a situation composable should be much more complex and implement some kind of ownership and "mutual exclusion" pattern to avoid data races and source-of-truth inconsistency. Currently this library ignores this problem at all, so you should be careful to avoid such a conflict by yourself.

## Storage

It is responsible to store states of different resources by their keys. You can implement your own storage if you want e.g. a `localStorage` caching mechanism.

By default, each `useSwr()` uses its own `AmnesiaStore` instance. It is an in-memory map without any logic.

## Cookbook

### Enabling plugins

```ts
import {
  pluginErrorRetry,
  pluginRefreshOnCapture,
  useSwr,
} from '@vue-swr-composable/core'

const retryInterval = ref(10_000)

useSwr({
  fetch: async () => 42,
  use: [
    pluginErrorRetry({
      count: 5,
      interval: retryInterval,
    }),
    pluginRefreshOnCapture(),
    // pass your own
    ({ resource }) => {
      watchEffect(() => {
        console.log(
          'resrouce %o fresh state: %o',
          resource.key,
          resource.state.fresh,
        )
      })
    },
  ],
})
```

### Make resource outlive component's scope

Define shared store somewhere:

```ts
const store = createAmnesiaStore()
```

Then use it anywhere you need:

```ts
export default defineComponent({
  setup() {
    const { resource } = useSwr({
      fetch: () => fetchUsers(),
      store,
      //  ^ pass the store here
    })

    return { resource }
  },
})
```

SWR composable will re-use persisted state.

### Activate / deactivate resource

Practical case: you want to fetch users, but you want to do it only after you have an authorization token.

```ts
const token = ref<null | string>(null)

const { resource } = useSwr({
  fetch: computed(() => {
    if (!token.value) return null
    return () => fetchUsers({ token: token.value })
  }),
})
```

Composable will be not activated until `fetch` computed resolves to function or object. Until that, `resource.value` will be `null`.
