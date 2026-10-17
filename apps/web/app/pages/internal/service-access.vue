<template>
  <InternalServiceAccessScreen />
</template>

<script setup lang="ts">
import InternalServiceAccessScreen from "~/features/internal-service-access/components/InternalServiceAccessScreen.vue";

defineOptions({ name: "InternalServiceAccessPage" });
useSeoMeta({ title: "Служебный доступ — IndieBar", robots: "noindex, nofollow" });
</script>
