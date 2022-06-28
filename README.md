# vue-kakuyaku

Toolkip to handle async operations in Vue.

## Why the name?

"Kakuyaku" (確約) means "Promise" in Japanese.

## Project structure

You are at monorepo root now. See available packages at `./packages/*`.

## CI

Main scripts:

```bash
# install packages
pnpm i

# ensure proper formatting
pnpm format:check

# run lints & tests
pnpm test:ci

# build & verify API report
pnpm build:ci

# publish all public packages
pnpm publish-all
```
