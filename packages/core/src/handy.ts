export function deferred<T>(): Deferred<T> {
  let methods
  let state = 'pending'
  const promise = new Promise<T>((resolve, reject): void => {
    methods = {
      async resolve(value: T | PromiseLike<T>) {
        await value
        state = 'fulfilled'
        resolve(value)
      },
      reject(reason: unknown) {
        state = 'rejected'
        reject(reason)
      },
    }
  })
  Object.defineProperty(promise, 'state', { get: () => state })
  return Object.assign(promise, methods) as Deferred<T>
}

export interface Deferred<T> extends Promise<T> {
  readonly state: 'pending' | 'fulfilled' | 'rejected'
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason: unknown) => void
}

export function delay(ms: number): Promise<void> {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((r) => setTimeout(r, ms))
}

// export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>;

// export function deadline<T>(promise: Promise<T>, delay: number): Promise<T>;
