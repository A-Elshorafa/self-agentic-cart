import type { Item } from '@shared/contract'

export default defineEventHandler(async (event): Promise<Item> => {
  const id = parseId(event)
  const patch = validateItemPatch(await readBody(event))
  const item = updateItem(id, patch)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: `Item ${id} not found` })
  }
  return item
})
