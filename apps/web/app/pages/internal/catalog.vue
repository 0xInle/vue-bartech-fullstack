<template>
  <InternalCatalogScreen />
</template>

<script setup lang="ts">
import InternalCatalogScreen from "~/features/internal-catalog/components/InternalCatalogScreen.vue";

defineOptions({ name: "InternalCatalogPage" });
useSeoMeta({ title: "Проверка каталога — IndieBar", robots: "noindex, nofollow" });
</script>
