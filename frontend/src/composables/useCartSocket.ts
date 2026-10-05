import { readonly, ref } from 'vue'
import type { Ref } from 'vue'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@shared/contract'
import type { CartState, ClientToServerEvents, ServerToClientEvents } from '@shared/contract'

type CartSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// Module-level singleton: one connection and one copy of the cart state per tab.
const count = ref(0)
const items = ref<Record<number, number>>({})
const connected = ref(false)
let socket: CartSocket | null = null

function applyState(state: CartState): void {
  // The server is the single source of truth; replace, never merge.
  count.value = state.count
  items.value = { ...state.items }
}

function ensureSocket(): CartSocket {
  if (socket) return socket
  // No URL: same origin, so in dev the Vite proxy forwards /socket.io to the backend.
  const created: CartSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  created.on('connect', () => {
    connected.value = true
    console.info('[socket] connected')
  })
  created.on('disconnect', (reason) => {
    connected.value = false
    console.info(`[socket] disconnected (${reason})`)
  })
  created.on(SOCKET_EVENTS.CART_UPDATED, applyState)
  socket = created
  return created
}

export function useCartSocket(): {
  count: Readonly<Ref<number>>
  items: Readonly<Ref<Record<number, number>>>
  connected: Readonly<Ref<boolean>>
  quantityOf: (itemId: number) => number
  addToCart: (itemId: number) => void
  removeFromCart: (itemId: number) => void
} {
  ensureSocket()

  return {
    count: readonly(count),
    items: readonly(items),
    connected: readonly(connected),
    quantityOf: (itemId: number) => items.value[itemId] ?? 0,
    // No optimistic updates: the UI changes when the server broadcasts cart:updated.
    addToCart: (itemId: number) => {
      ensureSocket().emit(SOCKET_EVENTS.CART_ADD, { itemId })
    },
    // Always emit; the server decides whether removing is a no-op.
    removeFromCart: (itemId: number) => {
      ensureSocket().emit(SOCKET_EVENTS.CART_REMOVE, { itemId })
    },
  }
}

/** Closes the connection and resets state (tests, HMR). */
export function disconnectCartSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  count.value = 0
  items.value = {}
  connected.value = false
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disconnectCartSocket()
  })
}
