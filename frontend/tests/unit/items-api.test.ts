import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Item, NewItem } from '@shared/contract'
import { ApiError, createItem, deleteItem, getItem, listItems, updateItem } from '@/api/items'

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

const item: Item = { id: 8, name: 'Clean Code', category: 'Books', price: 34.99, image: '📘' }
const newItem: NewItem = { name: 'Desk Lamp', category: 'Electronics', price: 24.5, image: '💡' }

let fetchMock: FetchMock

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

interface SentRequest {
  url: string
  method: string
  contentType: string | null
  body: unknown
}

function lastRequest(): SentRequest {
  const call = fetchMock.mock.lastCall
  if (!call) throw new Error('fetch was not called')
  const [input, init] = call
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
  return {
    url: String(input),
    method: (init?.method ?? 'GET').toUpperCase(),
    contentType: new Headers(init?.headers).get('Content-Type'),
    body,
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error: unknown) {
    return error
  }
  throw new Error('expected the request to fail')
}

beforeEach(() => {
  fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('items API client', () => {
  it('listItems sends GET /api/items and returns the items', async () => {
    fetchMock.mockResolvedValue(jsonResponse([item]))
    await expect(listItems()).resolves.toEqual([item])
    expect(lastRequest()).toMatchObject({ url: '/api/items', method: 'GET', body: undefined })
  })

  it('getItem sends GET /api/items/:id and returns the item', async () => {
    fetchMock.mockResolvedValue(jsonResponse(item))
    await expect(getItem(8)).resolves.toEqual(item)
    expect(lastRequest()).toMatchObject({ url: '/api/items/8', method: 'GET' })
  })

  it('createItem sends POST /api/items with a JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 11, ...newItem }, 201))
    await expect(createItem(newItem)).resolves.toEqual({ id: 11, ...newItem })
    expect(lastRequest()).toEqual({
      url: '/api/items',
      method: 'POST',
      contentType: 'application/json',
      body: newItem,
    })
  })

  it('updateItem sends PUT /api/items/:id with a JSON patch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...item, price: 9.5 }))
    await expect(updateItem(8, { price: 9.5 })).resolves.toEqual({ ...item, price: 9.5 })
    expect(lastRequest()).toEqual({
      url: '/api/items/8',
      method: 'PUT',
      contentType: 'application/json',
      body: { price: 9.5 },
    })
  })

  it('deleteItem sends DELETE /api/items/:id and resolves on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(deleteItem(8)).resolves.toBeUndefined()
    expect(lastRequest()).toMatchObject({ url: '/api/items/8', method: 'DELETE' })
  })

  it('throws ApiError with status and errors on a 400', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 400, statusMessage: 'Invalid item', data: { errors: ['price must be >= 0'] } },
        400,
      ),
    )
    const error = await rejectionOf(createItem({ ...newItem, price: -1 }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, errors: ['price must be >= 0'] })
  })

  it('throws ApiError with status 404 for an unknown item', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 404, statusMessage: 'Item 999 not found' }, 404))
    const error = await rejectionOf(getItem(999))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Item 999 not found' })
  })

  it('throws ApiError with status 404 when deleting an unknown item', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ statusCode: 404, statusMessage: 'Item 999 not found' }, 404))
    const error = await rejectionOf(deleteItem(999))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404 })
  })

  it('throws ApiError with status 0 on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await rejectionOf(listItems())
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0 })
  })
})
