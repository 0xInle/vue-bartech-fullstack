<template>
  <DocumentationScreen />
</template>

<script setup lang="ts">
import DocumentationScreen from "~/features/documentation/components/DocumentationScreen.vue";

defineOptions({ name: "DocumentationPage" });

useSeoMeta({
  title: "Документация IndieBar",
  description: "Краткие ответы о заведениях, сотрудниках, ролях, техкартах и работе в IndieBar.",
});
</script>
