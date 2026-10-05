// Shared contract between backend and frontend.
// Types and `as const` objects only — no imports, no runtime dependencies.
// Keep in sync with the "Shared Contract" section of README.md.

export const CATEGORIES = ['Electronics', 'Clothing', 'Books'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Item {
  id: number
  name: string
  category: Category
  price: number
  image: string // emoji or URL
}

export type NewItem = Omit<Item, 'id'>

export interface CartState {
  count: number
  items: Record<number, number> // itemId -> quantity
}

export const SOCKET_EVENTS = {
  CART_ADD: 'cart:add',
  CART_REMOVE: 'cart:remove',
  CART_UPDATED: 'cart:updated',
} as const

export interface CartItemPayload {
  itemId: number
}

export interface ServerToClientEvents {
  'cart:updated': (state: CartState) => void
}

export interface ClientToServerEvents {
  'cart:add': (payload: CartItemPayload) => void
  'cart:remove': (payload: CartItemPayload) => void
}

export const API_BASE = '/api'
export const BACKEND_PORT = 3001
export const FRONTEND_PORT = 5173
