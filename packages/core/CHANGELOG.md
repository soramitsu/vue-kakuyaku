# @vue-kakuyaku/core

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
