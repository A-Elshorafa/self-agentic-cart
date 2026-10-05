import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartState } from '@shared/contract'
import {
  addToCart,
  getCartState,
  onCartChange,
  removeFromCart,
  removeItemFromCart,
  resetCart,
} from '../../server/utils/cart-store'
import { resetItems } from '../../server/utils/item-store'

const unsubscribers: Array<() => void> = []

function listen(listener: (state: CartState) => void): () => void {
  const unsubscribe = onCartChange(listener)
  unsubscribers.push(unsubscribe)
  return unsubscribe
}

beforeEach(() => {
  resetItems()
  resetCart()
})

afterEach(() => {
  while (unsubscribers.length > 0) unsubscribers.pop()?.()
  vi.restoreAllMocks()
})

describe('cart state', () => {
  it('starts empty as { count: 0, items: {} }', () => {
    expect(getCartState()).toEqual({ count: 0, items: {} })
  })

  it('counts quantity 2 after adding the same item twice', () => {
    addToCart(1)
    expect(addToCart(1)).toEqual({ count: 2, items: { 1: 2 } })
  })

  it('sets count to the sum of quantities across items', () => {
    addToCart(1)
    addToCart(1)
    addToCart(5)
    addToCart(9)
    expect(getCartState()).toEqual({ count: 4, items: { 1: 2, 5: 1, 9: 1 } })
  })

  it('lowers the quantity on removeFromCart', () => {
    addToCart(3)
    addToCart(3)
    expect(removeFromCart(3)).toEqual({ count: 1, items: { 3: 1 } })
  })

  it('deletes the item key when the quantity reaches 0', () => {
    addToCart(3)
    const state = removeFromCart(3)
    expect(state.items).not.toHaveProperty('3')
    expect(state).toEqual({ count: 0, items: {} })
  })

  it('never lets the count go below 0', () => {
    removeFromCart(1)
    addToCart(1)
    removeFromCart(1)
    removeFromCart(1)
    expect(getCartState()).toEqual({ count: 0, items: {} })
  })

  it('throws when adding an unknown item id', () => {
    expect(() => addToCart(999)).toThrow()
    expect(getCartState()).toEqual({ count: 0, items: {} })
  })

  it('drops the whole line with removeItemFromCart', () => {
    addToCart(2)
    addToCart(2)
    addToCart(4)
    removeItemFromCart(2)
    expect(getCartState()).toEqual({ count: 1, items: { 4: 1 } })
  })

  it('empties the cart with resetCart', () => {
    addToCart(2)
    resetCart()
    expect(getCartState()).toEqual({ count: 0, items: {} })
  })

  it('returns a copy so callers cannot change the cart', () => {
    addToCart(1)
    const state = getCartState()
    state.items[1] = 50
    state.count = 50
    expect(getCartState()).toEqual({ count: 1, items: { 1: 1 } })
  })
})

describe('onCartChange', () => {
  it('is called with the new state on every add', () => {
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    addToCart(1)
    addToCart(1)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenLastCalledWith({ count: 2, items: { 1: 2 } })
  })

  it('is called with the new state on a real remove', () => {
    addToCart(1)
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    removeFromCart(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ count: 0, items: {} })
  })

  it('is called when removeItemFromCart drops a line', () => {
    addToCart(6)
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    removeItemFromCart(6)
    expect(listener).toHaveBeenCalledWith({ count: 0, items: {} })
  })

  it('is not called on a no-op remove', () => {
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    removeFromCart(7)
    expect(listener).not.toHaveBeenCalled()
  })

  it('is not called when removeItemFromCart targets an item not in the cart', () => {
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    removeItemFromCart(7)
    expect(listener).not.toHaveBeenCalled()
  })

  it('is not called when adding an unknown item fails', () => {
    const listener = vi.fn<(state: CartState) => void>()
    listen(listener)
    expect(() => addToCart(999)).toThrow()
    expect(listener).not.toHaveBeenCalled()
  })

  it('stops being called after unsubscribe', () => {
    const listener = vi.fn<(state: CartState) => void>()
    const unsubscribe = listen(listener)
    addToCart(1)
    unsubscribe()
    addToCart(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps calling other listeners when one listener throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const before = vi.fn<(state: CartState) => void>()
    const after = vi.fn<(state: CartState) => void>()
    listen(before)
    listen(() => {
      throw new Error('boom')
    })
    listen(after)
    addToCart(1)
    expect(before).toHaveBeenCalledWith({ count: 1, items: { 1: 1 } })
    expect(after).toHaveBeenCalledWith({ count: 1, items: { 1: 1 } })
  })

  it('does not let a throwing listener break the caller', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    listen(() => {
      throw new Error('boom')
    })
    expect(addToCart(1)).toEqual({ count: 1, items: { 1: 1 } })
  })
})
