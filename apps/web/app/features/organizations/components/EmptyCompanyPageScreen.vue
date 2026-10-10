<template>
  <main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
    <div v-if="loading" class="mx-auto max-w-5xl pt-8">
      <Message severity="info" :closable="false">Загружаем компанию…</Message>
    </div>
    <div v-else-if="identity.sessionState.value === 'error'" class="mx-auto max-w-5xl pt-8">
      <Message severity="error" :closable="false">
        {{ identity.sessionErrorMessage.value }}
      </Message>
    </div>
    <div v-else-if="!company" class="mx-auto max-w-5xl pt-8">
      <Message severity="error" :closable="false">
        Компания недоступна или в ней уже появились заведения.
      </Message>
    </div>
    <section v-else class="mx-auto max-w-5xl space-y-6">
      <header>
        <NuxtLink to="/" class="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          IndieBar
        </NuxtLink>
        <p class="mt-6 text-sm font-medium text-emerald-700">{{ company.name }}</p>
        <h1 class="mt-1 text-2xl font-semibold">Добавить заведение</h1>
        <p class="mt-2 text-sm text-zinc-600">
          Пригласите бар-менеджера — он укажет название заведения при принятии приглашения.
        </p>
      </header>
      <CompanyVenueInvitationScreen :company="company" :can-invite="true" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import CompanyVenueInvitationScreen from "./CompanyVenueInvitationScreen.vue";

defineOptions({ name: "EmptyCompanyPageScreen" });

const route = useRoute();
const identity = useIdentityFlow();
const companyId = computed(() => String(route.params.companyId ?? ""));
const company = computed(
  () => identity.currentUser.value?.companies.find((item) => item.id === companyId.value) ?? null,
);
const loading = computed(
  () => identity.sessionState.value === "idle" || identity.sessionState.value === "loading",
);

onMounted(async () => {
  await identity.loadSession();
  if (identity.sessionState.value === "unauthenticated") await navigateTo("/");
});
</script>
