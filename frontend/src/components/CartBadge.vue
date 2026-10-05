<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useCartSocket } from '@/composables/useCartSocket'
import IconCart from '@/components/icons/IconCart.vue'

const { count, connected } = useCartSocket()

const display = computed(() => (count.value > 99 ? '99+' : String(count.value)))
const label = computed(() => `Cart, ${count.value} ${count.value === 1 ? 'item' : 'items'}`)
const title = computed(() => (connected.value ? label.value : 'Reconnecting…'))

const bumping = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

watch(count, () => {
  bumping.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    bumping.value = false
  }, 200)
})

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button
    type="button"
    class="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    :aria-label="label"
    :title="title"
  >
    <IconCart class="h-6 w-6" />
    <span
      aria-live="polite"
      aria-atomic="true"
      class="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ring-2 ring-white transition-transform duration-200 motion-reduce:transition-none"
      :class="[
        count > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500',
        bumping ? 'motion-safe:scale-125' : 'scale-100',
      ]"
    >
      {{ display }}
    </span>
    <span
      v-if="!connected"
      class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
    >
      <span class="sr-only">Reconnecting…</span>
    </span>
  </button>
</template>
