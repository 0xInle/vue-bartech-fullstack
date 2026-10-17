<template>
  <InternalServiceProductsScreen />
</template>

<script setup lang="ts">
import InternalServiceProductsScreen from "~/features/internal-service-access/components/InternalServiceProductsScreen.vue";

defineOptions({ name: "InternalServiceProductsPage" });
useSeoMeta({ title: "Служебная работа с продукцией — IndieBar", robots: "noindex, nofollow" });
</script>
