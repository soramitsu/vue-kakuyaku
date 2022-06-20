import { reactive, watchEffect } from 'vue'

class Test {
  num = 4

  #num = 5

  public constructor() {
    watchEffect(() => console.log('num:', this.num))
    watchEffect(() => console.log('#num:', this.#num))
  }

  inc() {
    this.num++
    this.#num++
  }
}

new Test().inc()
reactive(new Test()).inc()
