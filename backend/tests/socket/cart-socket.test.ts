import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@shared/contract'
import type { CartState, ClientToServerEvents, ServerToClientEvents } from '@shared/contract'

await setup({ rootDir: fileURLToPath(new URL('../..', import.meta.url)), server: true })

type CartClient = Socket<ServerToClientEvents, ClientToServerEvents>

const UPDATE_TIMEOUT_MS = 3000
const SILENCE_WINDOW_MS = 300

const clients: CartClient[] = []

/** Resolves with the next cart:updated the socket receives. */
function nextUpdate(socket: CartClient, timeoutMs = UPDATE_TIMEOUT_MS): Promise<CartState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(SOCKET_EVENTS.CART_UPDATED, onUpdate)
      reject(new Error(`no ${SOCKET_EVENTS.CART_UPDATED} within ${timeoutMs}ms`))
    }, timeoutMs)
    function onUpdate(state: CartState): void {
      clearTimeout(timer)
      resolve(state)
    }
    socket.once(SOCKET_EVENTS.CART_UPDATED, onUpdate)
  })
}

/** Resolves if no cart:updated arrives within the window; rejects with the state otherwise. */
function expectNoUpdate(socket: CartClient, windowMs = SILENCE_WINDOW_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(SOCKET_EVENTS.CART_UPDATED, onUpdate)
      resolve()
    }, windowMs)
    function onUpdate(state: CartState): void {
      clearTimeout(timer)
      reject(new Error(`unexpected ${SOCKET_EVENTS.CART_UPDATED}: ${JSON.stringify(state)}`))
    }
    socket.once(SOCKET_EVENTS.CART_UPDATED, onUpdate)
  })
}

/** Connects a client and resolves once its initial sync arrives. */
async function connectClient(): Promise<{ socket: CartClient; initial: CartState }> {
  const socket: CartClient = io(url('/'), { transports: ['websocket'], forceNew: true })
  clients.push(socket)
  const initial = await nextUpdate(socket)
  return { socket, initial }
}

/** Emits a payload that does not match the typed contract, to test server-side validation. */
function emitRaw(socket: CartClient, event: string, payload: unknown): void {
  const untyped: Socket = socket
  untyped.emit(event, payload)
}

/** Removes everything in the cart through a fresh client, so each test starts from 0. */
async function emptyCart(): Promise<void> {
  const { socket, initial } = await connectClient()
  let state = initial
  for (const [itemId, quantity] of Object.entries(state.items)) {
    for (let i = 0; i < quantity; i++) {
      const update = nextUpdate(socket)
      socket.emit(SOCKET_EVENTS.CART_REMOVE, { itemId: Number(itemId) })
      state = await update
    }
  }
  if (state.count !== 0) throw new Error(`cart not empty after cleanup: ${JSON.stringify(state)}`)
}

afterEach(async () => {
  await emptyCart()
  while (clients.length > 0) clients.pop()?.disconnect()
})

describe('cart socket', () => {
  it('sends { count: 0, items: {} } to a client right after it connects', async () => {
    const { initial } = await connectClient()
    expect(initial).toEqual({ count: 0, items: {} })
  })

  it('sends the initial sync only to the client that connected', async () => {
    const a = await connectClient()
    const silence = expectNoUpdate(a.socket)
    await connectClient()
    await silence
  })

  it('broadcasts count 1 to both clients when client A adds item 1', async () => {
    const a = await connectClient()
    const b = await connectClient()
    const updates = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 1 })
    const [stateA, stateB] = await updates
    expect(stateA).toEqual({ count: 1, items: { 1: 1 } })
    expect(stateB).toEqual({ count: 1, items: { 1: 1 } })
  })

  it('broadcasts the lower count to both clients when client A removes an item', async () => {
    const a = await connectClient()
    const b = await connectClient()
    const added = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 2 })
    await added
    const removed = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_REMOVE, { itemId: 2 })
    const [stateA, stateB] = await removed
    expect(stateA).toEqual({ count: 0, items: {} })
    expect(stateB).toEqual({ count: 0, items: {} })
  })

  it('does not broadcast when removing an item that is not in the cart', async () => {
    const a = await connectClient()
    const b = await connectClient()
    const silence = Promise.all([expectNoUpdate(a.socket), expectNoUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_REMOVE, { itemId: 5 })
    await silence
  })

  it.each<[string, unknown]>([
    ['an unknown item id', { itemId: 999 }],
    ['a string item id', { itemId: 'x' }],
    ['an empty object', {}],
    ['a bare number', 999],
    ['a bare string', 'x'],
  ])('sends the current state back only to the sender for an add with %s', async (_label, payload) => {
    const a = await connectClient()
    const b = await connectClient()
    const added = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 3 })
    await added

    const senderUpdate = nextUpdate(a.socket)
    const otherSilent = expectNoUpdate(b.socket)
    emitRaw(a.socket, SOCKET_EVENTS.CART_ADD, payload)
    expect(await senderUpdate).toEqual({ count: 1, items: { 3: 1 } })
    await otherSilent
  })

  it('sends the current state back only to the sender for a remove with an invalid payload', async () => {
    const a = await connectClient()
    const b = await connectClient()
    const senderUpdate = nextUpdate(a.socket)
    const otherSilent = expectNoUpdate(b.socket)
    emitRaw(a.socket, SOCKET_EVENTS.CART_REMOVE, { itemId: 'x' })
    expect(await senderUpdate).toEqual({ count: 0, items: {} })
    await otherSilent
  })

  it('keeps working after invalid payloads', async () => {
    const a = await connectClient()
    const b = await connectClient()
    for (const payload of [999, 'x', {}, { itemId: 999 }]) {
      const resync = nextUpdate(a.socket)
      emitRaw(a.socket, SOCKET_EVENTS.CART_ADD, payload)
      await resync
    }
    const updates = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 4 })
    const [stateA, stateB] = await updates
    expect(stateA).toEqual({ count: 1, items: { 4: 1 } })
    expect(stateB).toEqual({ count: 1, items: { 4: 1 } })
  })

  it('sends the current non-zero state to a client that connects later', async () => {
    const a = await connectClient()
    let added = nextUpdate(a.socket)
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 6 })
    await added
    added = nextUpdate(a.socket)
    a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId: 6 })
    await added

    const late = await connectClient()
    expect(late.initial).toEqual({ count: 2, items: { 6: 2 } })
  })

  // Runs last: it deletes item 1 from the store, so later tests could no longer add it.
  it('broadcasts the smaller count to both clients when an item in the cart is deleted over REST', async () => {
    const a = await connectClient()
    const b = await connectClient()
    for (const itemId of [1, 1, 7]) {
      const update = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
      a.socket.emit(SOCKET_EVENTS.CART_ADD, { itemId })
      await update
    }

    const updates = Promise.all([nextUpdate(a.socket), nextUpdate(b.socket)])
    const res = await fetch(url('/api/items/1'), { method: 'DELETE' })
    expect(res.status).toBe(204)
    const [stateA, stateB] = await updates
    expect(stateA).toEqual({ count: 1, items: { 7: 1 } })
    expect(stateB).toEqual({ count: 1, items: { 7: 1 } })
  })
})
