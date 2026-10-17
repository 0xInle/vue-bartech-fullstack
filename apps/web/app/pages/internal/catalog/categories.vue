<template>
  <InternalCatalogCategoriesScreen />
</template>

<script setup lang="ts">
import InternalCatalogCategoriesScreen from "~/features/internal-catalog/components/InternalCatalogCategoriesScreen.vue";

defineOptions({ name: "InternalCatalogCategoriesPage" });
useSeoMeta({ title: "Категории ингредиентов — IndieBar", robots: "noindex, nofollow" });
</script>
