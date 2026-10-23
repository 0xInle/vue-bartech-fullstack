<template>
  <TeamPageScreen />
</template>

<script setup lang="ts">
import TeamPageScreen from "~/features/team/components/TeamPageScreen.vue";

defineOptions({ name: "VenueSchedulePage" });
useHead({ title: "График работы" });
</script>
