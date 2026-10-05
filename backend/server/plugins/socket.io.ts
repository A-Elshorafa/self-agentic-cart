import type { NitroApp } from 'nitropack'
import { Server as Engine } from 'engine.io'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import { defineEventHandler } from 'h3'
import { SOCKET_EVENTS } from '@shared/contract'
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/contract'
import { addToCart, getCartState, onCartChange, removeFromCart } from '../utils/cart-store'

// Socket.io on top of Nitro's experimental WebSocket support (crossws 0.3.x),
// following https://socket.io/how-to/use-with-nuxt.

type CartServer = Server<ClientToServerEvents, ServerToClientEvents>
type CartSocket = Socket<ClientToServerEvents, ServerToClientEvents>

interface SocketRuntime {
  io: CartServer
  unsubscribe: () => void
}

declare global {
  // Survives dev hot reloads so the previous server can be closed first.
  var __cartSocketRuntime: SocketRuntime | undefined
}

function disposeRuntime(): void {
  const runtime = globalThis.__cartSocketRuntime
  if (!runtime) return
  runtime.unsubscribe()
  // Also closes the bound engine.io server and its clients.
  runtime.io.close()
  globalThis.__cartSocketRuntime = undefined
}

function parseItemId(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  const itemId: unknown = (payload as Record<string, unknown>).itemId
  return typeof itemId === 'number' && Number.isInteger(itemId) && itemId > 0 ? itemId : null
}

function rejectInput(socket: CartSocket, event: string, payload: unknown, reason: string): void {
  console.warn(`[socket] rejected ${event} from ${socket.id}: ${reason}`, payload)
  // Resync only the sender; nothing changed, so nobody else needs an update.
  socket.emit(SOCKET_EVENTS.CART_UPDATED, getCartState())
}

export default defineNitroPlugin((nitroApp: NitroApp) => {
  disposeRuntime()

  const engine = new Engine()
  const io: CartServer = new Server<ClientToServerEvents, ServerToClientEvents>()
  io.bind(engine)

  io.on('connection', (socket) => {
    console.info(`[socket] connected ${socket.id}`)
    socket.emit(SOCKET_EVENTS.CART_UPDATED, getCartState())

    socket.on(SOCKET_EVENTS.CART_ADD, (payload: unknown) => {
      const itemId = parseItemId(payload)
      if (itemId === null) {
        rejectInput(socket, SOCKET_EVENTS.CART_ADD, payload, 'itemId must be a positive integer')
        return
      }
      try {
        addToCart(itemId)
      } catch (error) {
        rejectInput(socket, SOCKET_EVENTS.CART_ADD, payload, error instanceof Error ? error.message : String(error))
      }
    })

    socket.on(SOCKET_EVENTS.CART_REMOVE, (payload: unknown) => {
      const itemId = parseItemId(payload)
      if (itemId === null) {
        rejectInput(socket, SOCKET_EVENTS.CART_REMOVE, payload, 'itemId must be a positive integer')
        return
      }
      // No-op (and no broadcast) when the item is not in the cart.
      removeFromCart(itemId)
    })

    socket.on('disconnect', (reason) => {
      console.info(`[socket] disconnected ${socket.id} (${reason})`)
    })
  })

  // Single source of broadcasts: every cart change, socket-driven or REST-driven.
  const unsubscribe = onCartChange((state) => {
    io.emit(SOCKET_EVENTS.CART_UPDATED, state)
  })

  globalThis.__cartSocketRuntime = { io, unsubscribe }

  nitroApp.router.use('/socket.io/', defineEventHandler({
    handler(event) {
      // HTTP long-polling transport.
      engine.handleRequest(event.node.req, event.node.res)
      event._handled = true
    },
    websocket: {
      open(peer) {
        // @ts-expect-error crossws 0.3 keeps the raw node request on the protected _internal field; prepare() is private in engine.io
        engine.prepare(peer._internal.nodeReq)
        // @ts-expect-error onWebSocket() is private in engine.io; nodeReq lives on crossws' protected _internal field
        engine.onWebSocket(peer._internal.nodeReq, peer._internal.nodeReq.socket, peer.websocket)
      },
    },
  }))

  nitroApp.hooks.hook('close', () => {
    if (globalThis.__cartSocketRuntime?.io === io) disposeRuntime()
  })
})
