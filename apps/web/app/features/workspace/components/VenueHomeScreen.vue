<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">{{ errorMessage }}</Message>
  </div>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <template #home-search>
      <WorkspaceProductSearch :workspace="workspace" mode="home" />
    </template>
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <section class="flex min-w-0 flex-col gap-3">
        <ProductCostCalculator :workspace="workspace" />
        <VenueChecklists
          :company-id="workspace.company.id"
          :venue-id="workspace.venue.id"
          :can-manage="workspace.permissions.includes('manage_venue')"
        />
        <TeamAnnouncements
          :company-id="workspace.company.id"
          :venue-id="workspace.venue.id"
          :can-manage="workspace.permissions.includes('manage_venue')"
        />
      </section>
      <Divider layout="vertical" class="!mx-0 !my-0 !hidden self-stretch lg:!flex" />
      <section class="min-w-0 space-y-3">
        <Divider class="!my-0 lg:!hidden" />
        <TodayShiftRoster :company-id="workspace.company.id" :venue-id="workspace.venue.id" />
        <MyVenueReminders :company-id="workspace.company.id" :venue-id="workspace.venue.id" />
        <RecentAuditEvents :company-id="workspace.company.id" :venue-id="workspace.venue.id" />
      </section>
    </div>
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { compactMessagePt } from "~/utils/primevue-message";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import WorkspaceProductSearch from "~/features/products/components/WorkspaceProductSearch.vue";
import TodayShiftRoster from "~/features/workspace/components/TodayShiftRoster.vue";
import MyVenueReminders from "~/features/workspace/components/MyVenueReminders.vue";
import RecentAuditEvents from "~/features/workspace/components/RecentAuditEvents.vue";
import TeamAnnouncements from "~/features/workspace/components/TeamAnnouncements.vue";
import VenueChecklists from "~/features/workspace/components/VenueChecklists.vue";
import ProductCostCalculator from "~/features/products/components/ProductCostCalculator.vue";

defineOptions({ name: "VenueHomeScreen" });

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
</script>
