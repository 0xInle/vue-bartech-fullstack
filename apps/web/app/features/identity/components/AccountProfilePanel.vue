<template>
  <section class="mx-auto max-w-3xl space-y-6">
    <header>
      <p class="text-sm font-medium uppercase tracking-wide text-emerald-700">IndieBar</p>
      <h1 class="mt-2 text-2xl font-semibold">Профиль</h1>
    </header>

    <Message v-if="showInstallAction" severity="info" :closable="false">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>Установите IndieBar как приложение на это устройство.</span>
        <div class="flex flex-wrap gap-2">
          <Button
            label="Установить приложение"
            size="small"
            :loading="installing"
            :disabled="installing"
            @click="installApp"
          />
          <Button
            label="Не сейчас"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="installing"
            @click="dismissInstall"
          />
        </div>
      </div>
    </Message>

    <Message v-if="installError" severity="error" :closable="false">
      {{ installError }}
    </Message>

    <section class="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 class="text-base font-semibold">Учётная запись</h2>
      <dl class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-sm text-zinc-500">Имя</dt>
          <dd class="mt-1 font-medium">{{ fullName }}</dd>
        </div>
        <div>
          <dt class="text-sm text-zinc-500">Электронная почта</dt>
          <dd class="mt-1 break-all font-medium">{{ email }}</dd>
        </div>
      </dl>
    </section>

    <section class="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 class="text-base font-semibold">Компании, заведения и права</h2>
      <ul v-if="workplaces.length" class="mt-4 divide-y divide-zinc-200">
        <li
          v-for="workplace in workplaces"
          :key="`${workplace.company.id}:${workplace.venue.id}`"
          class="py-4 first:pt-0 last:pb-0"
        >
          <p class="font-medium">{{ workplace.venue.name }}</p>
          <p class="mt-1 text-sm text-zinc-500">
            {{ workplace.company.name }} · {{ workplace.roleLabel }} ·
            {{ workplace.scope === "company" ? "уровень компании" : "уровень заведения" }}
          </p>
          <ul class="mt-3 flex flex-wrap gap-2" :aria-label="`Права: ${workplace.venue.name}`">
            <li v-for="permission in workplace.permissions" :key="permission">
              <Tag :value="permissionLabels[permission] ?? permission" severity="secondary" />
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="mt-3 text-sm text-zinc-600">Сейчас у аккаунта нет доступных заведений.</p>
      <ul v-if="companies.length" class="mt-4 divide-y divide-zinc-200">
        <li v-for="company in companies" :key="company.id" class="py-3 first:pt-0 last:pb-0">
          <p class="font-medium">{{ company.name }}</p>
          <NuxtLink
            :to="`/app/companies/${company.id}`"
            class="mt-1 inline-block text-sm text-emerald-700 hover:underline"
          >
            Добавить заведение
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 class="text-base font-semibold">Сеанс</h2>
      <p class="mt-1 text-sm text-zinc-600">
        Можно завершить текущий сеанс или выйти из IndieBar на всех устройствах.
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          label="Выйти на этом устройстве"
          severity="secondary"
          size="small"
          :disabled="busy"
          @click="$emit('logout')"
        />
        <Button
          label="Выйти на всех устройствах"
          severity="danger"
          size="small"
          :disabled="busy"
          @click="$emit('logout-all')"
        />
      </div>
      <Message v-if="errorMessage" severity="error" :closable="false" class="mt-4">
        {{ errorMessage }}
      </Message>
    </section>
  </section>
</template>

<script setup lang="ts">
import type { CompanySummary, Workspace } from "~/types/user-workspaces";

defineOptions({ name: "AccountProfilePanel" });

defineProps<{
  fullName: string;
  email: string;
  workplaces: Workspace[];
  companies: CompanySummary[];
  busy: boolean;
  errorMessage: string;
}>();
defineEmits<{ logout: []; "logout-all": [] }>();

const pwa = useNuxtApp().$pwa;
const installing = ref(false);
const installedFromPrompt = ref(false);
const installError = ref("");
const showInstallAction = computed(() =>
  Boolean(pwa?.showInstallPrompt && !pwa.isPWAInstalled && !installedFromPrompt.value),
);

async function installApp() {
  if (!pwa || installing.value) return;

  installing.value = true;
  installError.value = "";

  try {
    const choice = await pwa.install();
    installedFromPrompt.value = choice?.outcome === "accepted";
  } catch {
    installError.value = "Не удалось открыть предложение установки. Попробуйте позже.";
  } finally {
    installing.value = false;
  }
}

function dismissInstall() {
  pwa?.cancelInstall();
}

const permissionLabels: Record<string, string> = {
  view_products: "Просмотр продукции",
  view_archive: "Просмотр архива",
  view_team: "Просмотр команды",
  manage_products: "Управление продукцией",
  manage_product_archive: "Управление архивом",
  delete_products_permanently: "Безвозвратное удаление",
  export_data: "Выгрузка данных",
  invite_employees: "Приглашение сотрудников",
  invite_bar_manager: "Приглашение бар-менеджера",
  invite_chef_bartender: "Приглашение шеф-бармена",
  manage_team: "Управление командой",
  manage_delegated_permissions: "Управление делегированными правами",
  create_venues: "Создание заведений",
  manage_venue: "Управление своим заведением",
  manage_venues: "Управление заведениями компании",
  manage_company: "Управление компанией",
  view_history: "Просмотр истории действий",
};
</script>
