<template><ArchiveListScreen :selected-product-id="String(route.params.productId)" /></template>
<script setup lang="ts">
import ArchiveListScreen from "~/features/archive/components/ArchiveListScreen.vue";
defineOptions({ name: "ProductArchiveCardPage" });
const route = useRoute();
</script>
