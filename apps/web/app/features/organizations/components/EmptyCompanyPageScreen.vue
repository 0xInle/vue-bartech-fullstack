<template>
  <main class="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
    <div v-if="loading" class="mx-auto max-w-5xl pt-8">
      <LoadingIndicator screen />
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
        <h1 class="text-xl mt-1 font-semibold">
          {{
            closure?.status === "PENDING_CLOSURE"
              ? "Продолжить работу компании"
              : "Добавить заведение"
          }}
        </h1>
        <p v-if="closure?.status !== 'PENDING_CLOSURE'" class="mt-2 text-sm text-zinc-600">
          Пригласите бар-менеджера — он укажет название заведения при принятии приглашения.
        </p>
      </header>
      <CompanyClosureBanner :company-id="company.id" />
      <Message v-if="closure?.status === 'PENDING_CLOSURE'" severity="info" :closable="false">
        <template v-if="closure.canCancel">
          Создайте новое заведение, чтобы продолжить работу. Компания восстановится вместе с его
          созданием.
        </template>
        <template v-else>
          Продолжить работу можно после создания нового заведения шеф-барменом компании.
        </template>
      </Message>
      <Button
        v-if="closure?.status === 'PENDING_CLOSURE' && closure.canCancel"
        type="button"
        label="Создать новое заведение"
        size="small"
        class="w-full"
        @click="openVenueDialog?.open()"
      />
      <OpenVenueDialog
        v-if="closure?.status === 'PENDING_CLOSURE' && closure.canCancel"
        ref="openVenueDialog"
        :company-id="company.id"
      />
      <template v-if="isClosureReady && closure?.status !== 'PENDING_CLOSURE'">
        <OrganizationLifecyclePanel :company="company" />
        <CompanyVenueInvitationScreen :company="company" :can-invite="true" />
      </template>
      <Message v-if="hasClosureError" severity="error" :closable="false">
        Не удалось проверить состояние компании. Обновите страницу.
      </Message>
      <LoadingIndicator v-if="!isClosureReady && !hasClosureError" screen />
    </section>
  </main>
</template>

<script setup lang="ts">
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import CompanyVenueInvitationScreen from "./CompanyVenueInvitationScreen.vue";
import CompanyClosureBanner from "./CompanyClosureBanner.vue";
import OrganizationLifecyclePanel from "./OrganizationLifecyclePanel.vue";
import OpenVenueDialog from "./OpenVenueDialog.vue";
import { useOrganizationLifecycle } from "../composables/useOrganizationLifecycle";

defineOptions({ name: "EmptyCompanyPageScreen" });

const route = useRoute();
const identity = useIdentityFlow();
const companyId = computed(() => String(route.params.companyId ?? ""));
const { closureQuery } = useOrganizationLifecycle(companyId);
const closure = computed(() => closureQuery.data.value);
const isClosureReady = computed(() => closureQuery.isSuccess.value);
const hasClosureError = computed(() => closureQuery.isError.value);
const openVenueDialog = ref<InstanceType<typeof OpenVenueDialog> | null>(null);
const company = computed(
  () => identity.currentUser.value?.companies.find((item) => item.id === companyId.value) ?? null,
);
const loading = computed(
  () =>
    identity.sessionState.value === "idle" ||
    identity.sessionState.value === "loading" ||
    (Boolean(company.value) && !isClosureReady.value && !hasClosureError.value),
);

onMounted(async () => {
  await identity.loadSession();
  if (identity.sessionState.value === "unauthenticated") await navigateTo("/");
});
</script>
