<template><GarnishListScreen :garnish-id="garnishId" /></template>
<script setup lang="ts">
import GarnishListScreen from "./GarnishListScreen.vue";
defineProps<{ garnishId: string }>();
</script>
