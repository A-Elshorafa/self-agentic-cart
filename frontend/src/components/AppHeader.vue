<script setup lang="ts">
import CartBadge from '@/components/CartBadge.vue'
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <h1 class="text-lg font-semibold tracking-tight text-slate-900">Cart App</h1>
      <CartBadge />
    </div>
  </header>
</template>
