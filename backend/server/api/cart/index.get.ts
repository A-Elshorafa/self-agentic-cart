import type { CartState } from '@shared/contract'

export default defineEventHandler((): CartState => getCartState())
