import type { Item } from '@shared/contract'

export default defineEventHandler((): Item[] => listItems())
