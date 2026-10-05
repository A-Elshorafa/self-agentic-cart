import type { Item } from '@shared/contract'

export default defineEventHandler(async (event): Promise<Item> => {
  const data = validateNewItem(await readBody(event))
  const item = createItem(data)
  setResponseStatus(event, 201)
  return item
})
