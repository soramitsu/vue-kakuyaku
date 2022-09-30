# @vue-kakuyaku/core

## 0.4.0

### Minor Changes

- 8b135ad: **refactor!**: update behavior of `useParamScope()`.

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

## 0.3.0

### Minor Changes

- 824a07f: **feat**: improve `useParamScope()`

  - allow scope key to be a `WatchSource`
  - in case of composed key, also passes a key into setup function: `setup(payload, key)`

- 824a07f: **feat!**: make `flattenState` result read-only
- 824a07f: **feat!**: if promise in `usePromise()` is canceled, it's error is silented; previously it was re-thrown in the emptyness to be treated as "uncaught rejection"

### Patch Changes

- 824a07f: **fix**: remove debug `console.log`
- 824a07f: **chore**: remove `useScopeWithAdvancedKey` artifact

## 0.2.0

### Minor Changes

- d61b3df: **refactor!:** use almost completely new design; less boilerplate; stabilization and documentation in feature releases

## 0.1.1

### Patch Changes

- 0b9126e: **fix**: include `.d.ts` declaration into package
