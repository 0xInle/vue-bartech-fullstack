<template>
  <section class="documents">
    <AppDocumentsNav @open-component="showComponent" />
    <component :is="activeComponent" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDocumentsNav from './components/AppDocumentsNav.vue'
import AppDocumentsChecklist from './components/AppDocumentsChecklist.vue'
import AppDocumentsRequests from './components/AppDocumentsRequests.vue'
import AppDocumentsTechcards from './components/AppDocumentsTechcards.vue'

const activeTab = ref('')

function showComponent(tab: string) {
  activeTab.value = tab
}

const activeComponent = computed(() => {
  if (activeTab.value === 'checklists') return AppDocumentsChecklist
  if (activeTab.value === 'requests') return AppDocumentsRequests
  if (activeTab.value === 'techcards') return AppDocumentsTechcards
  return null
})
</script>

<style scoped>
.documents {
  width: 100%;
  gap: 20px;
}
</style>
