import { API_BASE } from '@shared/contract'
import type { Item, NewItem } from '@shared/contract'

export class ApiError extends Error {
  readonly status: number
  readonly errors?: string[]

  constructor(status: number, message: string, errors?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

interface ErrorBody {
  statusMessage?: unknown
  message?: unknown
  data?: { errors?: unknown }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText || `Request failed with status ${res.status}`
  let errors: string[] | undefined
  try {
    const body: unknown = await res.json()
    if (isRecord(body)) {
      const err = body as ErrorBody
      if (typeof err.statusMessage === 'string' && err.statusMessage) message = err.statusMessage
      else if (typeof err.message === 'string' && err.message) message = err.message
      const list = isRecord(err.data) ? err.data.errors : undefined
      if (Array.isArray(list)) errors = list.filter((e): e is string => typeof e === 'string')
    }
  } catch {
    // Body was not JSON; keep the status text.
  }
  return new ApiError(res.status, message, errors)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch (cause) {
    throw new ApiError(0, cause instanceof Error ? cause.message : 'Network error')
  }
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function listItems(): Promise<Item[]> {
  return request<Item[]>('/items')
}

export function getItem(id: number): Promise<Item> {
  return request<Item>(`/items/${id}`)
}

export function createItem(data: NewItem): Promise<Item> {
  return request<Item>('/items', { method: 'POST', body: JSON.stringify(data) })
}

export function updateItem(id: number, patch: Partial<NewItem>): Promise<Item> {
  return request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export async function deleteItem(id: number): Promise<void> {
  await request<void>(`/items/${id}`, { method: 'DELETE' })
}
