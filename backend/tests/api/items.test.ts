import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { CATEGORIES } from '@shared/contract'
import type { Item, NewItem } from '@shared/contract'
import { call, errorsOf, isRecord } from './helpers'

await setup({ rootDir: fileURLToPath(new URL('../..', import.meta.url)), server: true })

const JSON_TYPE = /application\/json/
const validItem: NewItem = { name: 'Desk Lamp', category: 'Electronics', price: 24.5, image: '💡' }

function isItem(value: unknown): value is Item {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.price === 'number' &&
    typeof value.image === 'string' &&
    (CATEGORIES as readonly unknown[]).includes(value.category)
  )
}

async function createTestItem(data: NewItem = validItem): Promise<Item> {
  const res = await call('POST', '/api/items', data)
  if (!isItem(res.body)) throw new Error(`could not create test item: ${res.status} ${res.text}`)
  return res.body
}

describe('GET /api/items', () => {
  it('returns 200 with JSON', async () => {
    const res = await call('GET', '/api/items')
    expect(res.status).toBe(200)
    expect(res.contentType).toMatch(JSON_TYPE)
  })

  it('lists the 10 seed items across the 3 categories', async () => {
    const { body } = await call('GET', '/api/items')
    expect(Array.isArray(body)).toBe(true)
    const items = Array.isArray(body) ? body.filter(isItem).filter((item) => item.id <= 10) : []
    expect(items).toHaveLength(10)
    expect(new Set(items.map((item) => item.category)).size).toBe(3)
  })

  it('returns only well-formed items', async () => {
    const { body } = await call('GET', '/api/items')
    expect(Array.isArray(body) && body.every(isItem)).toBe(true)
  })
})

describe('GET /api/items/:id', () => {
  it('returns 200 with the item as JSON', async () => {
    const res = await call('GET', '/api/items/3')
    expect(res.status).toBe(200)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(res.body).toMatchObject({ id: 3, name: 'Bluetooth Speaker', category: 'Electronics' })
  })

  it('returns 404 with a JSON error for an unknown id', async () => {
    const res = await call('GET', '/api/items/999')
    expect(res.status).toBe(404)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(res.body).toMatchObject({ statusCode: 404 })
  })

  it.each(['abc', '0', '-1', '1.5'])('returns 400 with a JSON error for the bad id %s', async (id) => {
    const res = await call('GET', `/api/items/${id}`)
    expect(res.status).toBe(400)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(res.body).toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/items', () => {
  it('returns 201 with the created item and a new id', async () => {
    const res = await call('POST', '/api/items', validItem)
    expect(res.status).toBe(201)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(isItem(res.body)).toBe(true)
    expect(res.body).toMatchObject(validItem)
    expect(isRecord(res.body) && Number(res.body.id)).toBeGreaterThan(10)
  })

  it('makes the created item readable by id', async () => {
    const created = await createTestItem()
    const res = await call('GET', `/api/items/${created.id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(created)
  })

  it('returns 400 with a data.errors array for an invalid body', async () => {
    const res = await call('POST', '/api/items', { name: '', category: 'Toys', price: -1, image: '' })
    expect(res.status).toBe(400)
    expect(res.contentType).toMatch(JSON_TYPE)
    const errors = errorsOf(res.body)
    expect(Array.isArray(errors)).toBe(true)
    expect(Array.isArray(errors) ? errors.length : 0).toBe(4)
  })

  it('returns 400 when the body contains an id', async () => {
    const res = await call('POST', '/api/items', { ...validItem, id: 77 })
    expect(res.status).toBe(400)
    expect(Array.isArray(errorsOf(res.body))).toBe(true)
  })
})

describe('PUT /api/items/:id', () => {
  it('returns 200 with only the given field changed', async () => {
    const created = await createTestItem()
    const res = await call('PUT', `/api/items/${created.id}`, { price: 9.5 })
    expect(res.status).toBe(200)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(res.body).toEqual({ ...created, price: 9.5 })
  })

  it('returns 400 with a data.errors array for an invalid body', async () => {
    const res = await call('PUT', '/api/items/2', { category: 'Toys' })
    expect(res.status).toBe(400)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(Array.isArray(errorsOf(res.body))).toBe(true)
  })

  it('returns 400 for an empty patch', async () => {
    const res = await call('PUT', '/api/items/2', {})
    expect(res.status).toBe(400)
    expect(Array.isArray(errorsOf(res.body))).toBe(true)
  })

  it('returns 400 for a bad id', async () => {
    const res = await call('PUT', '/api/items/abc', { price: 1 })
    expect(res.status).toBe(400)
    expect(res.contentType).toMatch(JSON_TYPE)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await call('PUT', '/api/items/999', { price: 1 })
    expect(res.status).toBe(404)
    expect(res.contentType).toMatch(JSON_TYPE)
    expect(res.body).toMatchObject({ statusCode: 404 })
  })
})

describe('DELETE /api/items/:id', () => {
  it('returns 204 with an empty body', async () => {
    const created = await createTestItem()
    const res = await call('DELETE', `/api/items/${created.id}`)
    expect(res.status).toBe(204)
    expect(res.text).toBe('')
  })

  it('makes the deleted item return 404 afterwards', async () => {
    const created = await createTestItem()
    await call('DELETE', `/api/items/${created.id}`)
    const res = await call('GET', `/api/items/${created.id}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 when the delete is repeated', async () => {
    const created = await createTestItem()
    await call('DELETE', `/api/items/${created.id}`)
    const res = await call('DELETE', `/api/items/${created.id}`)
    expect(res.status).toBe(404)
    expect(res.contentType).toMatch(JSON_TYPE)
  })

  it('returns 400 for a bad id', async () => {
    const res = await call('DELETE', '/api/items/abc')
    expect(res.status).toBe(400)
    expect(res.contentType).toMatch(JSON_TYPE)
  })
})
