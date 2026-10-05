import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { CATEGORIES } from '../shared/contract'
import type { CartState, Item } from '../shared/contract'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function badge(page: Page): Locator {
  return page.getByRole('button', { name: /^Cart, \d+ items?$/ })
}

function addButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^add ${escapeRegExp(name)} to cart$`, 'i') })
}

function removeButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^remove ${escapeRegExp(name)} from cart$`, 'i') })
}

async function expectBadge(page: Page, count: number): Promise<void> {
  await expect(badge(page)).toHaveAccessibleName(new RegExp(`^Cart, ${count} items?$`))
  await expect(badge(page)).toContainText(count > 99 ? '99+' : String(count))
}

async function serverCart(request: APIRequestContext): Promise<CartState> {
  const res = await request.get('/api/cart')
  expect(res.ok()).toBe(true)
  return (await res.json()) as CartState
}

async function serverItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get('/api/items')
  expect(res.ok()).toBe(true)
  return (await res.json()) as Item[]
}

/** Opens the app, waits for the socket to connect and sync, and returns the starting count. */
async function openApp(page: Page, request: APIRequestContext): Promise<number> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^add .+ to cart$/i }).first()).toBeEnabled()
  const { count } = await serverCart(request)
  await expectBadge(page, count)
  return count
}

/** Net number of adds per item name made by the current test, removed again in afterEach. */
const added = new Map<string, number>()

async function clickAdd(page: Page, name: string): Promise<void> {
  await addButton(page, name).click()
  added.set(name, (added.get(name) ?? 0) + 1)
}

async function clickRemove(page: Page, name: string): Promise<void> {
  await removeButton(page, name).click()
  added.set(name, (added.get(name) ?? 0) - 1)
}

test.beforeEach(() => {
  added.clear()
})

test.afterEach(async ({ page, request }) => {
  const leftovers = [...added.entries()].filter(([, n]) => n > 0)
  if (leftovers.length === 0) return
  await page.setViewportSize({ width: 1280, height: 720 })
  let count = await openApp(page, request)
  for (const [name, n] of leftovers) {
    for (let i = 0; i < n; i++) {
      await removeButton(page, name).click()
      count -= 1
      await expectBadge(page, count)
    }
  }
  added.clear()
})

test('loads the page with 10 item cards, 3 category headings and the cart badge at the top-right', async ({ page, request }) => {
  await openApp(page, request)

  await expect(page.getByRole('button', { name: /^add .+ to cart$/i })).toHaveCount(10)
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3)
  for (const category of CATEGORIES) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(category) })).toBeVisible()
  }

  const viewport = page.viewportSize()
  const box = await badge(page).boundingBox()
  expect(viewport).not.toBeNull()
  expect(box).not.toBeNull()
  if (!viewport || !box) return
  expect(viewport.width - (box.x + box.width)).toBeLessThan(100)
  expect(box.y).toBeLessThan(100)
})

test('shows 0 on the badge on a fresh server', async ({ page, request }) => {
  await openApp(page, request)
  await expectBadge(page, 0)
})

test('raises the badge by 1 per add and lowers it by 1 per remove', async ({ page, request }) => {
  const start = await openApp(page, request)

  await clickAdd(page, 'Clean Code')
  await expectBadge(page, start + 1)

  await clickAdd(page, 'Smart Watch')
  await expectBadge(page, start + 2)

  await clickRemove(page, 'Clean Code')
  await expectBadge(page, start + 1)
})

test('disables the remove button for an item with quantity 0', async ({ page, request }) => {
  await openApp(page, request)
  const cart = await serverCart(request)
  const item = (await serverItems(request)).find((i) => (cart.items[i.id] ?? 0) === 0)
  expect(item).toBeDefined()
  if (!item) return

  await expect(removeButton(page, item.name)).toBeDisabled()
  await expect(addButton(page, item.name)).toBeEnabled()
})

test('updates the badge in a second tab without reloading', async ({ page, context, request }) => {
  const start = await openApp(page, request)
  const other = await context.newPage()
  await openApp(other, request)

  await clickAdd(page, 'Denim Jeans')

  await expectBadge(page, start + 1)
  await expectBadge(other, start + 1)
  await other.close()
})

test('keeps the server-side count after a reload', async ({ page, request }) => {
  const start = await openApp(page, request)
  await clickAdd(page, 'Running Shoes')
  await expectBadge(page, start + 1)

  await page.reload()
  await expect(addButton(page, 'Running Shoes')).toBeEnabled()
  await expectBadge(page, start + 1)
})

test('stays a single page with no internal links and an unchanged URL', async ({ page, request }) => {
  const navigations: string[] = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url())
  })

  const start = await openApp(page, request)
  const initialUrl = page.url()

  const internalLinks = await page
    .locator('a[href^="/"]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')).filter((href) => href !== '/'))
  expect(internalLinks).toEqual([])

  await clickAdd(page, 'USB-C Charger')
  await expectBadge(page, start + 1)
  await clickRemove(page, 'USB-C Charger')
  await expectBadge(page, start)
  await badge(page).click()

  expect(page.url()).toBe(initialUrl)
  expect(navigations).toEqual([initialUrl])
})

test.describe('on a 375x812 mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('has no horizontal scroll and keeps the badge visible', async ({ page, request }) => {
    await openApp(page, request)

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)

    await expect(badge(page)).toBeVisible()
    await expect(badge(page)).toBeInViewport()
  })

  test('keeps the badge visible after scrolling to the bottom', async ({ page, request }) => {
    await openApp(page, request)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(addButton(page, 'Designing Data-Intensive Applications')).toBeInViewport()
    await expect(badge(page)).toBeInViewport()
  })
})
