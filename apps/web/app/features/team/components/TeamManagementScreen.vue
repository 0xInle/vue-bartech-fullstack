<template>
  <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
    <header class="shrink-0">
      <h1 class="text-xl font-semibold">График работы</h1>
    </header>
    <ScheduleScreen class="min-h-0 flex-1" :workspace="workspace" />
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import ScheduleScreen from "~/features/schedule/components/ScheduleScreen.vue";

defineProps<{ workspace: Workspace }>();
</script>
