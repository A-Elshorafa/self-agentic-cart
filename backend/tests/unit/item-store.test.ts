import { beforeEach, describe, expect, it } from 'vitest'
import { CATEGORIES } from '@shared/contract'
import type { NewItem } from '@shared/contract'
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  resetItems,
  updateItem,
} from '../../server/utils/item-store'
import { addToCart, getCartState, resetCart } from '../../server/utils/cart-store'

const newItem: NewItem = { name: 'Test Lamp', category: 'Electronics', price: 9.5, image: '💡' }

beforeEach(() => {
  resetCart()
  resetItems()
})

describe('item store seed', () => {
  it('starts with exactly 10 items', () => {
    expect(listItems()).toHaveLength(10)
  })

  it('uses ids 1 to 10 in ascending order', () => {
    expect(listItems().map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('covers exactly the 3 categories from CATEGORIES', () => {
    const categories = new Set(listItems().map((item) => item.category))
    expect([...categories].sort()).toEqual([...CATEGORIES].sort())
  })

  it('gives every item a name, a non-negative price and an image', () => {
    for (const item of listItems()) {
      expect(item.name.length).toBeGreaterThan(0)
      expect(item.price).toBeGreaterThanOrEqual(0)
      expect(item.image.length).toBeGreaterThan(0)
    }
  })
})

describe('getItem', () => {
  it('returns the item with the given id', () => {
    expect(getItem(8)).toMatchObject({ id: 8, name: 'Clean Code', category: 'Books' })
  })

  it('returns undefined for an unknown id', () => {
    expect(getItem(999)).toBeUndefined()
  })
})

describe('createItem', () => {
  it('assigns the next id after the seed', () => {
    expect(createItem(newItem)).toEqual({ id: 11, ...newItem })
  })

  it('keeps incrementing ids for each new item', () => {
    createItem(newItem)
    expect(createItem(newItem).id).toBe(12)
  })

  it('makes the created item available through listItems and getItem', () => {
    const created = createItem(newItem)
    expect(listItems()).toHaveLength(11)
    expect(getItem(created.id)).toEqual(created)
  })
})

describe('updateItem', () => {
  it('merges a partial change and keeps the other fields', () => {
    const before = getItem(3)
    const updated = updateItem(3, { price: 1.23 })
    expect(updated).toEqual({ ...before, price: 1.23 })
    expect(getItem(3)).toEqual(updated)
  })

  it('returns undefined for an unknown id', () => {
    expect(updateItem(999, { name: 'Nope' })).toBeUndefined()
  })
})

describe('deleteItem', () => {
  it('removes the item and returns true', () => {
    expect(deleteItem(2)).toBe(true)
    expect(getItem(2)).toBeUndefined()
    expect(listItems()).toHaveLength(9)
  })

  it('returns false for an unknown id', () => {
    expect(deleteItem(999)).toBe(false)
  })

  it('also removes the deleted item from the cart', () => {
    addToCart(2)
    addToCart(2)
    addToCart(5)
    deleteItem(2)
    expect(getCartState()).toEqual({ count: 1, items: { 5: 1 } })
  })
})

describe('returned objects are copies', () => {
  it('does not change the store when a listed item is mutated', () => {
    const [first] = listItems()
    first.name = 'Mutated'
    expect(getItem(first.id)?.name).not.toBe('Mutated')
  })

  it('does not change the store when an item from getItem is mutated', () => {
    const item = getItem(1)
    if (!item) throw new Error('seed item 1 missing')
    item.price = 0
    expect(getItem(1)?.price).toBe(59.99)
  })

  it('does not change the store when a created item is mutated', () => {
    const created = createItem(newItem)
    created.name = 'Mutated'
    expect(getItem(created.id)?.name).toBe(newItem.name)
  })

  it('does not change the store when an updated item is mutated', () => {
    const updated = updateItem(4, { name: 'Charger' })
    if (!updated) throw new Error('seed item 4 missing')
    updated.name = 'Mutated'
    expect(getItem(4)?.name).toBe('Charger')
  })
})

describe('resetItems', () => {
  it('brings back the seed after changes', () => {
    const seed = listItems()
    createItem(newItem)
    updateItem(1, { name: 'Changed' })
    deleteItem(10)
    resetItems()
    expect(listItems()).toEqual(seed)
  })

  it('restarts id assignment after the seed', () => {
    createItem(newItem)
    resetItems()
    expect(createItem(newItem).id).toBe(11)
  })
})
