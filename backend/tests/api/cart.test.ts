import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { call } from './helpers'

await setup({ rootDir: fileURLToPath(new URL('../..', import.meta.url)), server: true })

describe('GET /api/cart', () => {
  it('returns 200 with JSON', async () => {
    const res = await call('GET', '/api/cart')
    expect(res.status).toBe(200)
    expect(res.contentType).toMatch(/application\/json/)
  })

  it('returns the empty cart { count: 0, items: {} } on a fresh server', async () => {
    const res = await call('GET', '/api/cart')
    expect(res.body).toEqual({ count: 0, items: {} })
  })
})
