<template>
  <div class="layout">
    <AppHeader />
    <main class="main-content flex">
      <RouterView />
    </main>
    <AppFooter v-if="route.meta.footer" />
  </div>
</template>

<script setup lang="ts">
import AppFooter from './layouts/AppFooter.vue'
import AppHeader from './layouts/AppHeader.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  justify-content: space-evenly;
  padding: 20px 0;
}
</style>
