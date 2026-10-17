<template><GarnishCardScreen :garnish-id="garnishId" /></template>
<script setup lang="ts">
import GarnishCardScreen from "~/features/garnishes/components/GarnishCardScreen.vue";
defineOptions({ name: "GarnishCardPage" });
const route = useRoute();
const garnishId = computed(() => String(route.params.garnishId ?? ""));
</script>
