<template>
  <SupportPageScreen />
</template>

<script setup lang="ts">
import SupportPageScreen from "~/features/support/components/SupportPageScreen.vue";

defineOptions({ name: "VenueSupportPage" });
useHead({ title: "Обращение в техподдержку" });
</script>
