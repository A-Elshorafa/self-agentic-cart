<script setup lang="ts">
import { computed } from 'vue'
import type { Item } from '@shared/contract'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconMinus from '@/components/icons/IconMinus.vue'

const props = withDefaults(defineProps<{ item: Item; quantity: number; disabled?: boolean }>(), {
  disabled: false,
})

const emit = defineEmits<{ add: []; remove: [] }>()

const priceFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const price = computed(() => priceFormat.format(props.item.price))
const inCart = computed(() => props.quantity > 0)
</script>

<template>
  <article
    class="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 transition-shadow hover:shadow-md"
    :class="inCart ? 'ring-2 ring-indigo-500' : 'ring-slate-200'"
  >
    <div class="mb-4 text-5xl leading-none" aria-hidden="true">{{ item.image }}</div>
    <h3 class="font-semibold text-slate-900">{{ item.name }}</h3>
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        {{ item.category }}
      </span>
      <span class="font-medium tabular-nums text-slate-900">{{ price }}</span>
    </div>

    <div class="mt-5 flex items-center justify-between">
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        :disabled="disabled || quantity === 0"
        :aria-label="`Remove ${item.name} from cart`"
        @click="emit('remove')"
      >
        <IconMinus class="h-5 w-5" />
      </button>
      <span
        class="min-w-8 text-center text-lg font-semibold tabular-nums"
        :class="inCart ? 'text-indigo-600' : 'text-slate-400'"
        :aria-label="`${quantity} in cart`"
      >
        {{ quantity }}
      </span>
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-600"
        :disabled="disabled"
        :aria-label="`Add ${item.name} to cart`"
        @click="emit('add')"
      >
        <IconPlus class="h-5 w-5" />
      </button>
    </div>
  </article>
</template>
