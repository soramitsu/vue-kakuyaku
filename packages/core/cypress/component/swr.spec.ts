/* eslint-disable max-nested-callbacks */
import { mount } from '@cypress/vue'
import { config } from '@vue/test-utils'
import { whenever } from '@vueuse/core'
import { PropType, Ref, computed, defineComponent, inject, nextTick, onScopeDispose, provide, reactive, ref } from 'vue'
import { Resource, ResourceState, createAmnesiaStore, useSwr } from '~lib'

const DisplayOpt = defineComponent({
  props: {
    value: Object,
  },
  template: `
    <code>
      <template v-if="!value">
        None
      </template>
      <template v-else>
        Some({{ value.some }})
      </template>
    </code>
  `,
})

const DANGLING_PROMISE = new Promise(() => {})

const ResourceStateView = defineComponent({
  components: {
    DisplayOpt,
  },
  props: {
    state: {
      type: Object as PropType<ResourceState<any>>,
      required: true,
    },
  },
  template: `
    <div class="grid gap-2">
      <p>Data: <DisplayOpt :value="state.data" /> </p>
      <p>Err: <DisplayOpt :value="state.error" /> </p>
      <p>Pending: {{ state.pending }}</p>
      <p>Fresh: {{ state.fresh }}</p>
      <p>Owners: {{ state.owners }}</p>
    </div>
  `,
})

const ResourceView = defineComponent({
  components: {
    DisplayOpt,
    ResourceStateView,
  },
  props: {
    resource: Object as PropType<null | Resource<any>>,
  },
  template: `
    <div class="p-2 text-sm border rounded grid gap-2">
      <template v-if="!resource">
        No resource
      </template>

      <template v-else>
        <ResourceStateView :state="resource.state" />
        <p>Key: <code>{{ resource.key }}</code></p>
        <div class="space-x-2">
          <button @click="resource.refresh()">
            Refresh
          </button>
          <button @click="resource.reset()">
            Reset
          </button>
        </div>
      </template>
    </div>
  `,
})

interface PromiseControl<T> {
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function useControlledPromise<T>(): {
  control: Ref<null | PromiseControl<T>>
  create: () => Promise<T>
} {
  const control = ref<null | PromiseControl<T>>(null)
  let promiseControlled: Promise<T> | null = null

  return {
    control,
    create: () => {
      const promise = new Promise<T>((res, rej) => {
        control.value = {
          resolve: res,
          reject: rej,
        }
      }).finally(() => {
        if (promiseControlled === promise) {
          control.value = null
        }
      })

      promiseControlled = promise
      return promise
    },
  }
}

before(() => {
  config.global.components = { ResourceView, ResourceStateView }
})

describe('fetch abortation', () => {
  describe('happened...', () => {
    it('when res is refreshed while pending (force: true)', () => {
      mount({
        setup() {
          const aborted = ref(0)
          const { resource } = useSwr({
            fetch: (onAbort) => {
              onAbort(() => {
                aborted.value++
              })

              return DANGLING_PROMISE
            },
          })

          function refresh() {
            resource.value?.refresh(true)
          }

          return { aborted, resource, refresh }
        },
        template: `
          <ResourceView v-bind="{ resource }" />

          Aborted: {{ aborted }}

          <button id="refresh" @click="refresh">Refresh</button>
        `,
      })

      cy.contains('Pending: true')
      cy.contains('Aborted: 0')
      cy.get('#refresh').click()
      cy.contains('Aborted: 1')
    })

    it('...not happened when refresh is not forced', () => {
      mount({
        setup() {
          const aborted = ref(0)
          const { resource } = useSwr({
            fetch: (onAbort) => {
              onAbort(() => {
                aborted.value++
              })

              return DANGLING_PROMISE
            },
          })

          function refresh() {
            resource.value?.refresh()
          }

          return { aborted, resource, refresh }
        },
        template: `
          <ResourceView v-bind="{ resource }" />

          Aborted: {{ aborted }}

          <button @click="refresh">Refresh</button>
        `,
      })

      cy.contains('Pending: true')
      cy.contains('Aborted: 0')
      cy.contains('Refresh')
        .click()
        .then(async () => {
          await nextTick()
          await nextTick()
          await nextTick()
        })
      cy.contains('Aborted: 0')
    })

    it('when composable is disposed', () => {
      mount({
        components: {
          Child: {
            setup() {
              const aborted = inject<Ref<boolean>>('aborted')!
              useSwr({
                fetch: (onAbort) => {
                  onAbort(() => {
                    aborted.value = true
                  })

                  return DANGLING_PROMISE
                },
              })

              return {}
            },
            template: `Unmount me, and you will see`,
          },
        },
        setup() {
          const aborted = ref(false)
          provide('aborted', aborted)

          const showChild = ref(true)

          return { aborted, showChild }
        },
        template: `
          <Child v-if="showChild" />

          Aborted: {{ aborted }}

          <button @click="showChild = false">Hide</button>
        `,
      })

      cy.contains('Aborted: false')
      cy.contains('Hide').click()
      cy.contains('Aborted: true')
    })

    it('when res is reset', () => {
      mount({
        setup() {
          const aborted = ref(false)
          const { resource } = useSwr({
            fetch: (onAbort) => {
              onAbort(() => {
                aborted.value = true
              })

              return DANGLING_PROMISE
            },
          })

          return {
            aborted,
            reset: () => {
              resource.value?.reset()
            },
          }
        },
        template: `
          Aborted: {{ aborted }}

          <button @click="reset">Reset</button>
        `,
      })

      cy.contains('Aborted: false')
      cy.contains('Reset').click()
      cy.contains('Aborted: true')
    })

    it('on key change, and *pending* flag of aborted resource is set to false', () => {
      mount({
        setup() {
          const store = createAmnesiaStore<any>()
          const key = ref('foo')
          const log = reactive<string[]>([])
          useSwr({
            fetch: computed(() => {
              const k = key.value

              return {
                key: k,
                fn: (onAbort) => {
                  onAbort(() => {
                    log.push(k)
                  })

                  return DANGLING_PROMISE
                },
              }
            }),
            store,
          })

          return {
            log,
            isFooPending: computed(() => store.storage.get('foo')?.pending ?? false),
            setKeyToBar() {
              key.value = 'bar'
            },
          }
        },
        template: `
          <span>Foo pending: {{ isFooPending }}</span>
          <pre>{{ log }}</pre>          
          <button @click="setKeyToBar">Update key</button>
        `,
      })

      cy.contains('Foo pending: true')
      cy.get('pre').should('have.text', '[]')
      cy.get('button').click()

      cy.contains('Foo pending: false')
      cy.get('pre').contains(/\[\s*"foo"\s*\]/)
    })

    it('happened and fetch result is not committed to the store', () => {
      mount({
        setup() {
          const store = createAmnesiaStore<any>()
          const key = ref('foo')
          const aborted = ref(false)
          const fooResolved = ref(false)
          const fooProm = useControlledPromise()

          useSwr({
            fetch: computed(() => {
              if (key.value === 'foo') {
                return {
                  key: key.value,
                  fn: (onAbort) => {
                    onAbort(() => {
                      aborted.value = true
                      fooProm.control.value?.resolve('something')
                    })

                    return fooProm.create().finally(() => {
                      fooResolved.value = true
                    })
                  },
                }
              }

              return {
                key: key.value,
                fn: () => DANGLING_PROMISE,
              }
            }),
            store,
          })

          return {
            aborted,
            fooResolved,
            isFooLoaded: computed(() => !!store.storage.get('foo')?.data),
            setKeyToBar() {
              key.value = 'bar'
            },
          }
        },
        template: `
          <span>Aborted: {{ aborted }}</span>
          <span>Resolved: {{ fooResolved }}</span>
          <span>Loaded in store: {{ isFooLoaded }}</span>
          <button @click="setKeyToBar">Update key</button>
        `,
      })

      cy.contains('Aborted: false')
      cy.contains('Resolved: false')
      cy.contains('Loaded in store: false')

      cy.get('button').click()

      cy.contains('Aborted: true')
      cy.contains('Resolved: true')
      cy.contains('Loaded in store: false')
    })
  })
})

describe('etc', () => {
  it('when res is just initialized, it is pending immediately', () => {
    mount({
      setup() {
        const { resource } = useSwr({
          fetch: () => new Promise(() => {}),
        })

        return {
          resource,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />
      `,
    })

    cy.contains('Pending: true')
  })

  it('when res is fetched, its data appears at state', () => {
    mount({
      setup() {
        const { control, create } = useControlledPromise<string>()
        const { resource } = useSwr({
          fetch: create,
        })

        return {
          resource,
          control,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />
        <button v-if="control" @click="control.resolve('foo')">Resolve</button>
      `,
    })

    cy.contains('Resolve').click()
    cy.contains('Pending: false')
    cy.contains('Data: Some(foo)')
  })

  it('when refresh is called, res is stale, but pending again', () => {
    mount({
      setup() {
        const { control, create } = useControlledPromise<string>()
        const { resource } = useSwr({
          fetch: create,
        })

        return {
          resource,
          control,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />
        <button v-if="control" @click="control.resolve('foo')">Resolve</button>
      `,
    })

    cy.contains('Pending: true')
    cy.contains('Resolve').click()
    cy.contains('Refresh').click()
    cy.contains('Pending: true')
    cy.contains('Data: Some(foo)')
  })

  it('when refresh is done, res is updated', () => {
    mount({
      setup() {
        const { control, create } = useControlledPromise<string>()
        const { resource } = useSwr({
          fetch: create,
        })

        return {
          resource,
          control,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />
        <template v-if="control">
          <button @click="control.resolve('foo')">Resolve foo</button>
          <button @click="control.resolve('bar')">Resolve bar</button>
        </template>
      `,
    })

    cy.contains('Pending: true')
    cy.contains('Resolve foo').click()
    cy.contains('Data: Some(foo)')
    cy.contains('Refresh').click()
    cy.contains('Resolve bar').click()
    cy.contains('Data: Some(bar)')
  })

  it('when fetch is errored, error appears', () => {
    mount({
      setup() {
        const { control, create } = useControlledPromise<string>()
        const { resource } = useSwr({
          fetch: create,
        })

        function reject() {
          control.value?.reject(new Error('foobar'))
        }

        return {
          resource,
          control,
          reject,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <template v-if="control">
          <button @click="reject">Reject</button>
        </template>
      `,
    })

    cy.contains('Reject').click()
    cy.contains('Pending: false')
    cy.contains('Data: None')
    cy.contains('Err: Some(Error: foobar)')
  })

  it('when res is loaded, but refresh is failed, error appears and data is stale', () => {
    mount({
      setup() {
        const { control, create } = useControlledPromise<string>()
        const { resource } = useSwr({
          fetch: create,
        })

        return {
          resource,
          control,
          reject: () => {
            control.value?.reject(new Error('foobar'))
          },
          resolve: () => {
            control.value?.resolve('bar')
          },
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <template v-if="control">
          <button @click="resolve">Resolve</button>
          <button @click="reject">Reject</button>
        </template>
      `,
    })

    cy.contains('Resolve').click()
    cy.contains('Refresh').click()
    cy.contains('Reject').click()

    cy.contains('Data: Some(bar)')
    cy.contains('Err: Some')
  })

  it('when res is reset, it is immediately fetched again', () => {
    mount({
      setup() {
        const fetchFires = ref(0)
        const { resource } = useSwr({
          fetch: () =>
            new Promise(() => {
              fetchFires.value++
            }),
        })

        return { fetchFires, resource }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        Fires: {{ fetchFires }}
      `,
    })

    cy.contains('Fires: 1')
    cy.contains('Reset').click()
    cy.contains('Fires: 2')
  })

  // Seems unnecessary
  it('when refresh is called, `fresh` field became false')

  it('when key is updated, then new resource is initialized', () => {
    mount({
      setup() {
        const key = ref('foo')
        const { resource } = useSwr({
          fetch: computed(() => ({
            key: key.value,
            fn: () =>
              new Promise((r) => {
                r({ value: key.value })
              }),
          })),
        })

        return {
          key,
          resource,
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <button @click="key = 'bar'">Set key to bar</button>
      `,
    })

    cy.contains('Key: foo')
    cy.contains('Data: Some({ "value": "foo" })')

    cy.contains('Set key to bar').click()

    cy.contains('Key: bar')
    cy.contains('Data: Some({ "value": "bar" })')
  })

  it(
    'when key is updated, but then returned to the initial one, then initial state is reused and' +
      'fetch is not re-evaluated',
    () => {
      mount({
        setup() {
          const key = ref('foo')
          const { control, create } = useControlledPromise<string>()
          const { resource } = useSwr({
            fetch: computed(() => ({
              key: key.value,
              fn: create,
            })),
          })

          const fired = ref(0)
          whenever(
            () => resource.value?.state.pending,
            () => {
              fired.value++
              control.value?.resolve(key.value)
            },
            { immediate: true },
          )

          return {
            fired,
            key,
            resource,
          }
        },
        template: `
            <ResourceView v-bind="{ resource }" />

            Fired: {{ fired }}
    
            <button @click="key = 'bar'">Set key to bar</button>
            <button @click="key = 'foo'">Set key to foo</button>
          `,
      })

      cy.contains('Data: Some(foo)')

      cy.contains('Set key to bar').click()
      cy.contains('Data: Some(bar)')

      cy.contains('Set key to foo').click()
      cy.contains('Data: Some(foo)')
      cy.contains('Fired: 2')
    },
  )

  it('when keyed fetch is recomputed to the same one, it is not refetched', () => {
    mount({
      setup() {
        const counter = ref(0)
        const { resource } = useSwr({
          fetch: computed(() => {
            const value = counter.value

            return {
              key: 'static',
              fn: async () => value,
            }
          }),
        })

        return { resource, counter }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <button @click="counter++">inc {{ counter }}</button>
      `,
    })

    cy.contains('Data: Some(0)')
    cy.contains('inc 0')
      .click()
      .contains('inc 1')
      .then(async () => {
        await nextTick()
        await nextTick()
        await nextTick()
      })

    cy.contains('Data: Some(0)')

    cy.contains('Refresh').click()
    cy.contains('Data: Some(1)')
  })

  it("when fetch is pending, store state resets and fetch resolves, then store isn't mutated, even pending state", () => {
    mount({
      setup() {
        const store = createAmnesiaStore<any>()
        const prom1 = useControlledPromise()
        const prom2 = useControlledPromise()
        const { resource } = useSwr({
          fetch: {
            key: 'static',
            fn: async () => {
              if (prom1.control.value) return prom2.create()
              return prom1.create()
            },
          },
          store,
        })

        return {
          resource,
          resolveFirst: () => {
            prom1.control.value?.resolve('one')
          },
          resetStore: () => {
            store.storage.clear()
          },
          secondPending: computed(() => !!prom2.control.value),
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <button @click="resetStore">Reset store</button>
        <button v-if="secondPending" @click="resolveFirst">Resolve first</button>
      `,
    })

    cy.contains('Pending: true')
    cy.contains('Reset store').click()
    cy.contains('Resolve first').click()
    cy.contains('Pending: true')
    cy.contains('Data: None')
  })

  it("when fetch is pending, store state resets and fetch rejects, then store's error isn't mutated", () => {
    mount({
      setup() {
        const store = createAmnesiaStore<any>()
        const prom1 = useControlledPromise()
        const prom2 = useControlledPromise()
        const { resource } = useSwr({
          fetch: {
            key: 'static',
            fn: async () => {
              if (prom1.control.value) return prom2.create()
              return prom1.create()
            },
          },
          store,
        })

        return {
          resource,
          rejectFirst: () => {
            prom1.control.value?.reject(new Error('one'))
          },
          resetStore: () => {
            store.storage.clear()
          },
          secondPending: computed(() => !!prom2.control.value),
        }
      },
      template: `
        <ResourceView v-bind="{ resource }" />

        <button @click="resetStore">Reset store</button>
        <button v-if="secondPending" @click="resolveFirst">Reject first</button>
      `,
    })

    cy.contains('Pending: true')
    cy.contains('Reset store').click()
    cy.contains('Reject first').click()
    cy.contains('Pending: true')
    cy.contains('Data: None')
    cy.contains('Err: None')
  })
})

describe('plugins', () => {
  it('is called when there is some resource', () => {
    mount({
      setup() {
        const called = ref(false)
        useSwr({
          fetch: () => DANGLING_PROMISE,
          use: [
            () => {
              called.value = true
            },
          ],
        })

        return { called }
      },
      template: `Called: {{ called }}`,
    })

    cy.contains('Called: true')
  })

  it('is called on key change', () => {
    mount({
      setup() {
        const count = ref(0)
        const key = ref('foo')

        useSwr({
          fetch: computed(() => ({
            key: key.value,
            fn: () => DANGLING_PROMISE,
          })),
          use: [
            () => {
              count.value++
            },
          ],
        })

        return {
          count,
          changeKey() {
            key.value = 'bar'
          },
        }
      },
      template: `
        <p>Count: {{ count }}</p>
        <button @Click="changeKey">Change</button>
      `,
    })

    cy.contains('Count: 1')
    cy.get('button').click()
    cy.contains('Count: 2')
  })

  it('is not called when no resource', () => {
    mount({
      setup() {
        const called = ref(false)

        useSwr({
          fetch: computed(() => null),
          use: [() => {}],
        })

        return { called }
      },
      template: `Called: {{ called }}`,
    })

    cy.contains('Called: false')
  })

  it('plugin scope is disposed on falsy key', () => {
    mount({
      setup() {
        const active = ref(true)
        const disposed = ref(false)

        useSwr({
          fetch: computed(() => active.value && (() => DANGLING_PROMISE)),
          use: [
            () => {
              onScopeDispose(() => {
                disposed.value = true
              })
            },
          ],
        })

        return { active, disposed }
      },
      template: `
        <input v-model="active" type="checkbox">
        <p>Disposed: {{ disposed }}</disposed>
      `,
    })

    cy.contains('Disposed: false')
    cy.get('input').uncheck()
    cy.contains('Disposed: true')
  })

  it('plugin scope is disposed on key change', () => {
    mount({
      setup() {
        const key = ref('foo')
        const disposed = ref(false)

        useSwr({
          fetch: computed(() => ({
            key: key.value,
            fn: () => DANGLING_PROMISE,
          })),
          use: [
            () => {
              onScopeDispose(() => {
                disposed.value = true
              })
            },
          ],
        })

        return { key, disposed }
      },
      template: `
        <button @click="key = 'bar'">Change</button>
        <p>Disposed: {{ disposed }}</disposed>
      `,
    })

    cy.contains('Disposed: false')
    cy.get('button').click()
    cy.contains('Disposed: true')
  })

  it('all plugins are called, even if some of them throws', () => {
    const EXPECTED = 10

    mount({
      setup() {
        const actual = ref(0)

        useSwr({
          fetch: () => DANGLING_PROMISE,
          use: Array.from({ length: EXPECTED }, (v, i) => () => {
            actual.value++
            if (i % 3 === 0) {
              throw new Error('This error should not prevent other plugins to run')
            }
          }),
        })

        return { actual }
      },
      template: `Actual: {{ actual }}`,
    })

    cy.contains('Actual: 10')
  })
})
