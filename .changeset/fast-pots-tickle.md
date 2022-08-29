---
'@vue-kakuyaku/core': minor
---

**feat**: improve `useParamScope()`

- allow scope key to be a `WatchSource`
- in case of composed key, also passes a key into setup function: `setup(payload, key)`
