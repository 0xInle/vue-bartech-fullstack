<template><ArchiveCardScreen :product-id="String(route.params.productId)" /></template>
<script setup lang="ts">
import ArchiveCardScreen from "~/features/archive/components/ArchiveCardScreen.vue";
defineOptions({ name: "ProductArchiveCardPage" });
const route = useRoute();
</script>
