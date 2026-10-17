<template>
  <InternalAuthScreen />
</template>

<script setup lang="ts">
import InternalAuthScreen from "~/features/internal-auth/components/InternalAuthScreen.vue";

defineOptions({ name: "InternalAuthenticationPage" });
useSeoMeta({ title: "Внутренний вход — IndieBar", robots: "noindex, nofollow" });
</script>
