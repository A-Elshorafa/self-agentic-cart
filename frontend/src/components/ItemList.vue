<script setup lang="ts">
import { useItems } from '@/composables/useItems'
import { useCartSocket } from '@/composables/useCartSocket'
import ItemCard from '@/components/ItemCard.vue'

const { items, itemsByCategory, loading, error, reload } = useItems()
const { connected, quantityOf, addToCart, removeFromCart } = useCartSocket()

const gridClass = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
</script>

<template>
  <div v-if="loading && items.length === 0" aria-busy="true" aria-label="Loading items">
    <div class="mb-4 h-6 w-40 animate-pulse rounded bg-slate-200" />
    <div :class="gridClass">
      <div
        v-for="n in 8"
        :key="n"
        class="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        <div class="mb-4 h-12 w-12 rounded-lg bg-slate-200" />
        <div class="h-4 w-3/4 rounded bg-slate-200" />
        <div class="mt-3 h-4 w-1/2 rounded bg-slate-200" />
        <div class="mt-5 flex items-center justify-between">
          <div class="h-10 w-10 rounded-full bg-slate-200" />
          <div class="h-10 w-10 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  </div>

  <div
    v-else-if="error"
    role="alert"
    class="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200"
  >
    <p class="font-medium text-slate-900">Couldn't load items.</p>
    <p class="mt-1 text-sm text-slate-500">{{ error }}</p>
    <button
      type="button"
      class="mt-4 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      @click="reload"
    >
      Try again
    </button>
  </div>

  <p v-else-if="itemsByCategory.length === 0" class="py-12 text-center text-slate-500">
    No items available.
  </p>

  <div v-else class="space-y-10">
    <section
      v-for="group in itemsByCategory"
      :key="group.category"
      :aria-labelledby="`cat-${group.category}`"
    >
      <h2
        :id="`cat-${group.category}`"
        class="mb-4 flex items-baseline gap-2 text-xl font-semibold text-slate-900"
      >
        {{ group.category }}
        <span class="text-sm font-normal text-slate-500">({{ group.items.length }})</span>
      </h2>
      <div :class="gridClass">
        <ItemCard
          v-for="item in group.items"
          :key="item.id"
          :item="item"
          :quantity="quantityOf(item.id)"
          :disabled="!connected"
          @add="addToCart(item.id)"
          @remove="removeFromCart(item.id)"
        />
      </div>
    </section>
  </div>
</template>
