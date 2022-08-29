---
'@vue-kakuyaku/core': minor
---

**feat!**: if promise in `usePromise()` is canceled, it's error is silented; previously it was re-thrown in the emptyness to be treated as "uncaught rejection"
