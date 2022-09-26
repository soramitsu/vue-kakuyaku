---
'@vue-kakuyaku/core': minor
---

**refactor!**: update behavior of `useParamScope()`.

Now it's type declaration is made of a single function with a lot of conditional types. It makes its typing way shorter.

Callback function that setups a scope now accepts not payload / key, but the exact key returns from the scope key source.

For example, previously it was:

```ts
useParamScope(
  () => 'key',
  (key) => {
    assert(key === 'key')
  },
)

useParamScope(
  () => ({ key: 'foo', payload: 'bar' }),
  (payload, key) => {
    assert(payload === 'bar')
    assert(key === 'foo')
  },
)
```

Now:

```ts
useParamScope(
  () => 'key',
  (key) => {
    assert(key === 'key')
  },
)

useParamScope(
  () => ({ key: 'foo', payload: 'bar' }),
  ({ payload, key }) => {
    assert(payload === 'bar')
    assert(key === 'foo')
  },
)
```
