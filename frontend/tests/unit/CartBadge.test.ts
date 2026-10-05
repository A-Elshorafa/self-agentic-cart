import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CartBadge from '@/components/CartBadge.vue'

const cart = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { count: ref(0), connected: ref(true) }
})

vi.mock('@/composables/useCartSocket', async () => {
  const { ref } = await import('vue')
  return {
    useCartSocket: () => ({
      count: cart.count,
      items: ref({}),
      connected: cart.connected,
      quantityOf: () => 0,
      addToCart: vi.fn(),
      removeFromCart: vi.fn(),
    }),
  }
})

function mountBadge() {
  return mount(CartBadge)
}

beforeEach(() => {
  cart.count.value = 0
  cart.connected.value = true
})

describe('CartBadge', () => {
  it('shows 0 by default', () => {
    expect(mountBadge().text()).toContain('0')
  })

  it('shows the current count', async () => {
    const wrapper = mountBadge()
    cart.count.value = 7
    await nextTick()
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('7')
  })

  it('shows 99 at exactly 99', () => {
    cart.count.value = 99
    expect(mountBadge().find('[aria-live="polite"]').text()).toBe('99')
  })

  it('shows 99+ above 99', () => {
    cart.count.value = 150
    expect(mountBadge().find('[aria-live="polite"]').text()).toBe('99+')
  })

  it('announces the count in an aria-live polite region', () => {
    cart.count.value = 4
    expect(mountBadge().find('[aria-live="polite"]').exists()).toBe(true)
  })

  it('has the aria-label "Cart, N items"', () => {
    cart.count.value = 3
    expect(mountBadge().get('button').attributes('aria-label')).toBe('Cart, 3 items')
  })

  it('has the aria-label "Cart, 0 items" when empty', () => {
    expect(mountBadge().get('button').attributes('aria-label')).toBe('Cart, 0 items')
  })

  it('uses the real count in the aria-label above 99', () => {
    cart.count.value = 150
    expect(mountBadge().get('button').attributes('aria-label')).toBe('Cart, 150 items')
  })

  it('shows a reconnecting signal when disconnected', () => {
    cart.connected.value = false
    expect(mountBadge().text()).toMatch(/reconnecting/i)
  })

  it('shows no reconnecting signal while connected', () => {
    expect(mountBadge().text()).not.toMatch(/reconnecting/i)
  })

  it('shows the reconnecting signal as soon as the connection drops', async () => {
    const wrapper = mountBadge()
    cart.connected.value = false
    await nextTick()
    expect(wrapper.text()).toMatch(/reconnecting/i)
  })
})
