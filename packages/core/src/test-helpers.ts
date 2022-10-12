/**
 * Got from here:
 * https://github.com/gvergnaud/type-level-typescript-workshop/blob/1969c6f3c957944838f1be5d4fcc3817e1030135/helpers.ts
 */
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

export type Expect<T extends true> = T
