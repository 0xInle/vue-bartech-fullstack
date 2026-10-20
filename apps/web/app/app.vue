<template>
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
