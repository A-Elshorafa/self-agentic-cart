import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Item } from '@shared/contract'
import ItemCard from '@/components/ItemCard.vue'

const item: Item = { id: 8, name: 'Clean Code', category: 'Books', price: 34.99, image: '📘' }

function mountCard(props: { quantity: number; disabled?: boolean; item?: Item }) {
  return mount(ItemCard, { props: { item, ...props } })
}

function addButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.get('button[aria-label="Add Clean Code to cart"]')
}

function removeButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.get('button[aria-label="Remove Clean Code from cart"]')
}

describe('ItemCard', () => {
  it('shows the item name', () => {
    expect(mountCard({ quantity: 0 }).text()).toContain('Clean Code')
  })

  it('shows the item category', () => {
    expect(mountCard({ quantity: 0 }).text()).toContain('Books')
  })

  it('shows the price formatted in USD', () => {
    expect(mountCard({ quantity: 0 }).text()).toContain('$34.99')
  })

  it('formats thousands with a separator and two decimals', () => {
    const wrapper = mountCard({ quantity: 0, item: { ...item, price: 1234.5 } })
    expect(wrapper.text()).toContain('$1,234.50')
  })

  it('shows the item image', () => {
    expect(mountCard({ quantity: 0 }).text()).toContain('📘')
  })

  it('shows the quantity', () => {
    expect(mountCard({ quantity: 3 }).text()).toContain('3')
  })

  it('emits add when the add button is clicked', async () => {
    const wrapper = mountCard({ quantity: 0 })
    await addButton(wrapper).trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('emits remove when the remove button is clicked', async () => {
    const wrapper = mountCard({ quantity: 2 })
    await removeButton(wrapper).trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('disables the remove button at quantity 0', () => {
    expect(removeButton(mountCard({ quantity: 0 })).attributes()).toHaveProperty('disabled')
  })

  it('keeps the add button enabled at quantity 0', () => {
    expect(addButton(mountCard({ quantity: 0 })).attributes()).not.toHaveProperty('disabled')
  })

  it('enables the remove button when the quantity is above 0', () => {
    expect(removeButton(mountCard({ quantity: 1 })).attributes()).not.toHaveProperty('disabled')
  })

  it('disables both buttons when disconnected', () => {
    const wrapper = mountCard({ quantity: 2, disabled: true })
    expect(addButton(wrapper).attributes()).toHaveProperty('disabled')
    expect(removeButton(wrapper).attributes()).toHaveProperty('disabled')
  })

  it('does not emit add while disconnected', async () => {
    const wrapper = mountCard({ quantity: 2, disabled: true })
    await addButton(wrapper).trigger('click')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('includes the item name in both button aria-labels', () => {
    const labels = mountCard({ quantity: 1 })
      .findAll('button')
      .map((button) => button.attributes('aria-label') ?? '')
    expect(labels).toHaveLength(2)
    expect(labels.every((label) => label.includes('Clean Code'))).toBe(true)
  })
})
