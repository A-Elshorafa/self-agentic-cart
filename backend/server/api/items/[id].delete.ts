export default defineEventHandler((event): null => {
  const id = parseId(event)
  if (!deleteItem(id)) {
    throw createError({ statusCode: 404, statusMessage: `Item ${id} not found` })
  }
  setResponseStatus(event, 204)
  return null
})
