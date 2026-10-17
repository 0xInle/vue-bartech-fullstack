<template>
  <ClosureOperationScreen :operation-id="operationId" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import ClosureOperationScreen from "~/features/exports/components/ClosureOperationScreen.vue";

defineOptions({ name: "ClosureOperationPage" });

const route = useRoute();
const operationId = computed(() => String(route.params.operationId ?? ""));
</script>
