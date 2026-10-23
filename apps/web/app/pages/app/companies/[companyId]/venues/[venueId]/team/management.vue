<template>
  <TeamManagementPageScreen />
</template>

<script setup lang="ts">
import TeamManagementPageScreen from "~/features/team/components/TeamManagementPageScreen.vue";

defineOptions({ name: "VenueTeamManagementPage" });
useHead({ title: "Управление командой" });
</script>
