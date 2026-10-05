import type { CartState } from '@shared/contract'
import { getItem } from './item-store'

// In-memory state: resets whenever the server (or this module) reloads.
const quantities = new Map<number, number>()
const listeners = new Set<(state: CartState) => void>()

export function getCartState(): CartState {
  const items: Record<number, number> = {}
  let count = 0
  for (const [itemId, quantity] of quantities) {
    items[itemId] = quantity
    count += quantity
  }
  return { count, items }
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener(getCartState())
    } catch (error) {
      console.error('[cart-store] cart change listener threw:', error)
    }
  }
}

export function addToCart(itemId: number): CartState {
  if (!getItem(itemId)) {
    throw new Error(`Item ${itemId} does not exist`)
  }
  quantities.set(itemId, (quantities.get(itemId) ?? 0) + 1)
  notify()
  return getCartState()
}

export function removeFromCart(itemId: number): CartState {
  const quantity = quantities.get(itemId)
  if (quantity === undefined) return getCartState()
  if (quantity <= 1) {
    quantities.delete(itemId)
  } else {
    quantities.set(itemId, quantity - 1)
  }
  notify()
  return getCartState()
}

export function removeItemFromCart(itemId: number): void {
  if (quantities.delete(itemId)) notify()
}

export function onCartChange(listener: (state: CartState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetCart(): void {
  if (quantities.size === 0) return
  quantities.clear()
  notify()
}
