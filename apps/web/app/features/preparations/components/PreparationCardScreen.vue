<template><PreparationListScreen :preparation-id="preparationId" /></template>
<script setup lang="ts">
import PreparationListScreen from "./PreparationListScreen.vue";
defineProps<{ preparationId: string }>();
</script>
