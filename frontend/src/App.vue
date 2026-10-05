<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import ItemList from '@/components/ItemList.vue'
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <AppHeader />
    <main class="mx-auto max-w-6xl px-4 py-8"><ItemList /></main>
  </div>
</template>
