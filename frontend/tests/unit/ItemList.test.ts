import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { CATEGORIES } from '@shared/contract'
import type { Item } from '@shared/contract'

const SEED: Item[] = [
  { id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 59.99, image: '🎧' },
  { id: 2, name: 'Smart Watch', category: 'Electronics', price: 129.99, image: '⌚' },
  { id: 3, name: 'Bluetooth Speaker', category: 'Electronics', price: 39.99, image: '🔊' },
  { id: 4, name: 'USB-C Charger', category: 'Electronics', price: 19.99, image: '🔌' },
  { id: 5, name: 'Cotton T-Shirt', category: 'Clothing', price: 14.99, image: '👕' },
  { id: 6, name: 'Denim Jeans', category: 'Clothing', price: 49.99, image: '👖' },
  { id: 7, name: 'Running Shoes', category: 'Clothing', price: 89.99, image: '👟' },
  { id: 8, name: 'Clean Code', category: 'Books', price: 34.99, image: '📘' },
  { id: 9, name: 'The Pragmatic Programmer', category: 'Books', price: 39.99, image: '📗' },
  { id: 10, name: 'Designing Data-Intensive Applications', category: 'Books', price: 44.99, image: '📙' },
]

const mocks = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    listItems: vi.fn<() => Promise<Item[]>>(),
    addToCart: vi.fn<(itemId: number) => void>(),
    removeFromCart: vi.fn<(itemId: number) => void>(),
    count: ref(0),
    connected: ref(true),
    items: ref<Record<number, number>>({}),
  }
})

vi.mock('@/api/items', () => ({
  listItems: mocks.listItems,
}))

vi.mock('@/composables/useCartSocket', () => ({
  useCartSocket: () => ({
    count: mocks.count,
    items: mocks.items,
    connected: mocks.connected,
    quantityOf: (itemId: number) => mocks.items.value[itemId] ?? 0,
    addToCart: mocks.addToCart,
    removeFromCart: mocks.removeFromCart,
  }),
}))

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// useItems keeps module-level state, so load a fresh copy of the component tree per test.
async function mountList() {
  const { default: ItemList } = await import('@/components/ItemList.vue')
  return mount(ItemList)
}

beforeEach(() => {
  vi.resetModules()
  mocks.listItems.mockReset()
  mocks.addToCart.mockReset()
  mocks.removeFromCart.mockReset()
  mocks.connected.value = true
  mocks.items.value = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ItemList', () => {
  it('shows the loading skeleton before the items arrive', async () => {
    const pending = deferred<Item[]>()
    mocks.listItems.mockReturnValue(pending.promise)
    const wrapper = await mountList()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.findAll('h2')).toHaveLength(0)
    pending.resolve(SEED)
    await flushPromises()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
  })

  it('renders 3 category sections in CATEGORIES order', async () => {
    mocks.listItems.mockResolvedValue([...SEED].reverse())
    const wrapper = await mountList()
    await flushPromises()
    const headings = wrapper.findAll('h2').map((h) => h.text())
    expect(headings).toHaveLength(3)
    headings.forEach((heading, index) => expect(heading).toContain(CATEGORIES[index]))
  })

  it('renders 10 item cards in total', async () => {
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    expect(wrapper.findAll('button[aria-label^="Add "]')).toHaveLength(10)
  })

  it('places each item under its own category', async () => {
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    const books = wrapper.findAll('section').find((s) => s.get('h2').text().includes('Books'))
    expect(books?.text()).toContain('Clean Code')
    expect(books?.text()).not.toContain('Smart Watch')
  })

  it('loads the items once', async () => {
    mocks.listItems.mockResolvedValue(SEED)
    await mountList()
    await flushPromises()
    expect(mocks.listItems).toHaveBeenCalledTimes(1)
  })

  it('shows an error with a "Try again" button when loading fails', async () => {
    mocks.listItems.mockRejectedValue(new Error('Network down'))
    const wrapper = await mountList()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Try again')).toBe(true)
  })

  it('calls the API again when "Try again" is clicked', async () => {
    mocks.listItems.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce(SEED)
    const wrapper = await mountList()
    await flushPromises()
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Try again')
    await retry?.trigger('click')
    await flushPromises()
    expect(mocks.listItems).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('h2')).toHaveLength(3)
  })

  it('shows "No items available." for an empty list', async () => {
    mocks.listItems.mockResolvedValue([])
    const wrapper = await mountList()
    await flushPromises()
    expect(wrapper.text()).toContain('No items available.')
  })

  it('calls addToCart(item.id) when a card add button is clicked', async () => {
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    await wrapper.get('button[aria-label="Add Clean Code to cart"]').trigger('click')
    expect(mocks.addToCart).toHaveBeenCalledWith(8)
  })

  it('calls removeFromCart(item.id) when a card remove button is clicked', async () => {
    mocks.items.value = { 6: 1 }
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    await wrapper.get('button[aria-label="Remove Denim Jeans from cart"]').trigger('click')
    expect(mocks.removeFromCart).toHaveBeenCalledWith(6)
  })

  it('passes the quantity from the socket to each card', async () => {
    mocks.items.value = { 8: 1 }
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    const removeClean = wrapper.get('button[aria-label="Remove Clean Code from cart"]')
    const removeSpeaker = wrapper.get('button[aria-label="Remove Bluetooth Speaker from cart"]')
    expect(removeClean.attributes()).not.toHaveProperty('disabled')
    expect(removeSpeaker.attributes()).toHaveProperty('disabled')
  })

  it('disables the card buttons while the socket is disconnected', async () => {
    mocks.connected.value = false
    mocks.listItems.mockResolvedValue(SEED)
    const wrapper = await mountList()
    await flushPromises()
    const addButtons = wrapper.findAll('button[aria-label^="Add "]')
    expect(addButtons.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
  })
})
