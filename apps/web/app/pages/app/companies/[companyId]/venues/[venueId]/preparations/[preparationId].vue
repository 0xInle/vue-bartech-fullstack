<template><PreparationCardScreen :preparation-id="preparationId" /></template>
<script setup lang="ts">
import PreparationCardScreen from "~/features/preparations/components/PreparationCardScreen.vue";
defineOptions({ name: "PreparationCardPage" });
const route = useRoute();
const preparationId = computed(() => String(route.params.preparationId ?? ""));
</script>
