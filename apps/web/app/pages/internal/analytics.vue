<template>
  <InternalProductAnalyticsScreen />
</template>

<script setup lang="ts">
import InternalProductAnalyticsScreen from "~/features/analytics/components/InternalProductAnalyticsScreen.vue";

defineOptions({ name: "InternalProductAnalyticsPage" });
useSeoMeta({ title: "Продуктовая аналитика — IndieBar", robots: "noindex, nofollow" });
</script>
