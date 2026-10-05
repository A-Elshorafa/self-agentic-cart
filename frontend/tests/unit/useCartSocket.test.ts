import { afterEach, describe, expect, it, vi } from 'vitest'
import { SOCKET_EVENTS } from '@shared/contract'
import type { CartState } from '@shared/contract'

const fake = vi.hoisted(() => {
  class FakeSocket {
    private handlers = new Map<string, Set<(...args: unknown[]) => void>>()
    readonly emitted: Array<{ event: string; payload: unknown }> = []
    disconnected = false

    on(event: string, handler: (...args: unknown[]) => void): this {
      const set = this.handlers.get(event) ?? new Set()
      set.add(handler)
      this.handlers.set(event, set)
      return this
    }

    emit(event: string, payload: unknown): this {
      this.emitted.push({ event, payload })
      return this
    }

    removeAllListeners(): this {
      this.handlers.clear()
      return this
    }

    disconnect(): this {
      this.disconnected = true
      return this
    }

    /** Simulates an event arriving from the server. */
    receive(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers.get(event) ?? []) handler(...args)
    }
  }
  const sockets: FakeSocket[] = []
  return { FakeSocket, sockets }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = new fake.FakeSocket()
    fake.sockets.push(socket)
    return socket
  }),
}))

const { useCartSocket, disconnectCartSocket } = await import('@/composables/useCartSocket')
const { io } = await import('socket.io-client')

function currentSocket(): InstanceType<typeof fake.FakeSocket> {
  const socket = fake.sockets.at(-1)
  if (!socket) throw new Error('no socket was created')
  return socket
}

function serverSends(state: CartState): void {
  currentSocket().receive(SOCKET_EVENTS.CART_UPDATED, state)
}

afterEach(() => {
  disconnectCartSocket()
  fake.sockets.length = 0
  vi.mocked(io).mockClear()
})

describe('useCartSocket', () => {
  it('starts with a count of 0 and no items', () => {
    const cart = useCartSocket()
    expect(cart.count.value).toBe(0)
    expect(cart.items.value).toEqual({})
  })

  it('starts disconnected', () => {
    expect(useCartSocket().connected.value).toBe(false)
  })

  it('updates count and items when cart:updated arrives', () => {
    const cart = useCartSocket()
    serverSends({ count: 3, items: { 1: 2, 4: 1 } })
    expect(cart.count.value).toBe(3)
    expect(cart.items.value).toEqual({ 1: 2, 4: 1 })
  })

  it('replaces the previous state instead of merging it', () => {
    const cart = useCartSocket()
    serverSends({ count: 3, items: { 1: 2, 4: 1 } })
    serverSends({ count: 1, items: { 4: 1 } })
    expect(cart.items.value).toEqual({ 4: 1 })
  })

  it('does not change the count optimistically after addToCart', () => {
    const cart = useCartSocket()
    cart.addToCart(1)
    expect(cart.count.value).toBe(0)
    expect(cart.quantityOf(1)).toBe(0)
  })

  it('does not change the count optimistically after removeFromCart', () => {
    const cart = useCartSocket()
    serverSends({ count: 1, items: { 1: 1 } })
    cart.removeFromCart(1)
    expect(cart.count.value).toBe(1)
  })

  it('emits cart:add with { itemId } on addToCart', () => {
    useCartSocket().addToCart(7)
    expect(currentSocket().emitted).toEqual([{ event: SOCKET_EVENTS.CART_ADD, payload: { itemId: 7 } }])
  })

  it('emits cart:remove with { itemId } on removeFromCart', () => {
    useCartSocket().removeFromCart(7)
    expect(currentSocket().emitted).toEqual([{ event: SOCKET_EVENTS.CART_REMOVE, payload: { itemId: 7 } }])
  })

  it('emits cart:remove even when the local quantity is 0', () => {
    const cart = useCartSocket()
    expect(cart.quantityOf(2)).toBe(0)
    cart.removeFromCart(2)
    expect(currentSocket().emitted).toHaveLength(1)
  })

  it('creates a single socket when called twice', () => {
    useCartSocket()
    useCartSocket()
    expect(io).toHaveBeenCalledTimes(1)
    expect(fake.sockets).toHaveLength(1)
  })

  it('shares state between callers', () => {
    const first = useCartSocket()
    const second = useCartSocket()
    serverSends({ count: 2, items: { 3: 2 } })
    expect(first.count.value).toBe(2)
    expect(second.count.value).toBe(2)
  })

  it('connects without a URL through the /socket.io path', () => {
    useCartSocket()
    const [first] = vi.mocked(io).mock.calls[0] ?? []
    expect(first).toMatchObject({ path: '/socket.io' })
  })

  it('sets connected to true on connect', () => {
    const cart = useCartSocket()
    currentSocket().receive('connect')
    expect(cart.connected.value).toBe(true)
  })

  it('sets connected back to false on disconnect', () => {
    const cart = useCartSocket()
    currentSocket().receive('connect')
    currentSocket().receive('disconnect', 'transport close')
    expect(cart.connected.value).toBe(false)
  })

  it('returns the quantity of an item with quantityOf, and 0 for items not in the cart', () => {
    const cart = useCartSocket()
    serverSends({ count: 3, items: { 1: 2, 4: 1 } })
    expect(cart.quantityOf(1)).toBe(2)
    expect(cart.quantityOf(4)).toBe(1)
    expect(cart.quantityOf(9)).toBe(0)
  })

  it('returns read-only refs', () => {
    const cart = useCartSocket()
    const writable = cart.count as unknown as { value: number }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    writable.value = 42
    expect(cart.count.value).toBe(0)
    warn.mockRestore()
  })

  it('disconnectCartSocket closes the socket and resets the state', () => {
    const cart = useCartSocket()
    const socket = currentSocket()
    socket.receive('connect')
    serverSends({ count: 5, items: { 2: 5 } })
    disconnectCartSocket()
    expect(socket.disconnected).toBe(true)
    expect(cart.count.value).toBe(0)
    expect(cart.items.value).toEqual({})
    expect(cart.connected.value).toBe(false)
  })

  it('creates a new socket after disconnectCartSocket', () => {
    useCartSocket()
    disconnectCartSocket()
    useCartSocket()
    expect(io).toHaveBeenCalledTimes(2)
  })
})
