<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <LoadingIndicator v-if="redirecting" screen />
    <Message v-else severity="info" :closable="false" :pt="compactMessagePt">
      Выберите рабочее пространство, чтобы открыть техподдержку.
      <NuxtLink to="/" class="ml-1 underline">Перейти к рабочим пространствам</NuxtLink>
    </Message>
  </main>
</template>

<script setup lang="ts">
import { compactMessagePt } from "~/utils/primevue-message";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";

const route = useRoute();
const identity = useIdentityFlow();
const redirecting = ref(true);

onMounted(async () => {
  if (identity.sessionState.value === "idle") {
    await Promise.allSettled([identity.refreshCsrf()]);
    await identity.loadSession();
  }
  const queryCompanyId = singleQuery(route.query.companyId);
  const queryVenueId = singleQuery(route.query.venueId);
  const requested = identity.currentUser.value?.workplaces.find(
    ({ company, venue }) => company.id === queryCompanyId && venue.id === queryVenueId,
  );
  const workplaces = identity.currentUser.value?.workplaces ?? [];
  const destination = requested ?? (workplaces.length === 1 ? workplaces[0] : null);
  if (destination) {
    await navigateTo({
      path: `/app/companies/${destination.company.id}/venues/${destination.venue.id}/support`,
      replace: true,
    });
    return;
  }
  redirecting.value = false;
});

function singleQuery(value: unknown) {
  return typeof value === "string" ? value : "";
}
</script>
