import { query, createSWR } from 'vswr'

const swr = createSWR()

swr.query('')

function setup1() {
  const { data } = query<number>('/users', {
    // fetcher
  })
}
