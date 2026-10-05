import type { Item, NewItem } from '@shared/contract'
import { SEED_ITEMS } from './seed'
import { removeItemFromCart } from './cart-store'

// In-memory state: resets whenever the server (or this module) reloads.
const items = new Map<number, Item>()
let nextId = 1

function seed(): void {
  items.clear()
  for (const item of SEED_ITEMS) {
    items.set(item.id, { ...item })
  }
  nextId = Math.max(0, ...SEED_ITEMS.map((item) => item.id)) + 1
}

seed()

export function listItems(): Item[] {
  return [...items.values()]
    .sort((a, b) => a.id - b.id)
    .map((item) => ({ ...item }))
}

export function getItem(id: number): Item | undefined {
  const item = items.get(id)
  return item ? { ...item } : undefined
}

export function createItem(data: NewItem): Item {
  const item: Item = {
    id: nextId++,
    name: data.name,
    category: data.category,
    price: data.price,
    image: data.image,
  }
  items.set(item.id, item)
  return { ...item }
}

export function updateItem(id: number, patch: Partial<NewItem>): Item | undefined {
  const existing = items.get(id)
  if (!existing) return undefined
  const updated: Item = {
    id,
    name: patch.name ?? existing.name,
    category: patch.category ?? existing.category,
    price: patch.price ?? existing.price,
    image: patch.image ?? existing.image,
  }
  items.set(id, updated)
  return { ...updated }
}

export function deleteItem(id: number): boolean {
  const deleted = items.delete(id)
  if (deleted) removeItemFromCart(id)
  return deleted
}

export function resetItems(): void {
  seed()
}
