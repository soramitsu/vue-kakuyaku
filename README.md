# vue-swr-composable

Stale-while-revalidate data caching pattern for Vue 3.

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
pnpm build

# publish all public packages
pnpm publish-all
```
