<template>
  <InternalAuditScreen />
</template>

<script setup lang="ts">
import InternalAuditScreen from "~/features/internal-audit/components/InternalAuditScreen.vue";

defineOptions({ name: "InternalAuditPage" });
useSeoMeta({ title: "Внутренний журнал действий — IndieBar", robots: "noindex, nofollow" });
</script>
