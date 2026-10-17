<template>
  <InternalCatalogManagementScreen />
</template>

<script setup lang="ts">
import InternalCatalogManagementScreen from "~/features/internal-catalog/components/InternalCatalogManagementScreen.vue";

defineOptions({ name: "InternalCatalogManagementPage" });
useSeoMeta({ title: "Управление каталогом — IndieBar", robots: "noindex, nofollow" });
</script>
