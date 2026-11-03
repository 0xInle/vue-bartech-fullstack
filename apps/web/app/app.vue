<template>
  <Toast
    position="top-right"
    :pt="{
      messageContent: { class: '!items-center' },
      messageIcon: { class: '!hidden' },
      summary: { class: '!text-xs' },
      detail: { class: '!text-xs' },
    }"
  />
  <NetworkStatusBanner />
  <PwaUpdatePrompt />
  <NuxtPage />
</template>

<script setup lang="ts">
import { useColorScheme } from "~/composables/useColorScheme";
import PwaUpdatePrompt from "~/features/pwa/components/PwaUpdatePrompt.vue";

const { initializeColorScheme } = useColorScheme();

onMounted(initializeColorScheme);
</script>
