import { url } from '@nuxt/test-utils/e2e'

export interface ApiResponse {
  status: number
  contentType: string
  text: string
  body: unknown
}

/** Calls the test server and never throws on 4xx/5xx, so status codes can be asserted. */
export async function call(method: string, path: string, body?: unknown): Promise<ApiResponse> {
  const res = await fetch(url(path), {
    method,
    headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = text === '' ? undefined : JSON.parse(text)
  } catch {
    parsed = undefined
  }
  return { status: res.status, contentType: res.headers.get('content-type') ?? '', text, body: parsed }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Field-level messages from an h3 error body (`data.errors`). */
export function errorsOf(body: unknown): unknown {
  return isRecord(body) && isRecord(body.data) ? body.data.errors : undefined
}
