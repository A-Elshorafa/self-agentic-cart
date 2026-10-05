import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { CATEGORIES } from '@shared/contract'
import type { Category, Item } from '@shared/contract'
import { listItems } from '@/api/items'

export interface CategoryGroup {
  category: Category
  items: Item[]
}

// Module-level state: the list is loaded once and shared by every caller.
const items = ref<Item[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let started = false

async function reload(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    items.value = await listItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not load items.'
  } finally {
    loading.value = false
  }
}

const itemsByCategory = computed<CategoryGroup[]>(() =>
  CATEGORIES.map((category) => ({
    category,
    items: items.value.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0),
)

export function useItems(): {
  items: Ref<Item[]>
  itemsByCategory: ComputedRef<CategoryGroup[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  reload: () => Promise<void>
} {
  if (!started) {
    started = true
    void reload()
  }
  return { items, itemsByCategory, loading, error, reload }
}
