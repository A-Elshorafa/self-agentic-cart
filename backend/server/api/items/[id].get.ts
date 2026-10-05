import type { Item } from '@shared/contract'

export default defineEventHandler((event): Item => {
  const id = parseId(event)
  const item = getItem(id)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: `Item ${id} not found` })
  }
  return item
})
