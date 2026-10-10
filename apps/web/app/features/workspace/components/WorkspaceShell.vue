<template>
  <div class="min-h-screen bg-zinc-50 text-zinc-900 lg:flex">
    <aside class="hidden w-72 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 lg:flex">
      <NuxtLink to="/" class="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
        IndieBar
      </NuxtLink>
      <div class="mb-6">
        <p class="mb-2 text-xs font-medium text-zinc-500">Рабочее пространство</p>
        <Select
          v-if="workspaceOptions.length > 1"
          :model-value="workspaceKey"
          :options="workspaceOptions"
          option-label="label"
          option-value="key"
          size="small"
          class="w-full"
          aria-label="Выбрать заведение"
          @update:model-value="selectWorkspace"
        />
        <div v-else class="rounded-lg border border-zinc-200 px-3 py-2">
          <p class="truncate text-sm font-medium">{{ workspace.venue.name }}</p>
          <p class="truncate text-xs text-zinc-500">{{ workspace.company.name }}</p>
        </div>
      </div>

      <nav aria-label="Основная навигация" class="flex flex-col gap-1">
        <NuxtLink
          :to="homePath"
          class="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          :aria-current="isProfile || isTeam ? undefined : 'page'"
        >
          Главная
        </NuxtLink>
        <NuxtLink
          v-if="workspace.permissions.includes('view_team')"
          :to="teamPath"
          class="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          :aria-current="isTeam ? 'page' : undefined"
        >
          Команда
        </NuxtLink>
        <NuxtLink
          v-if="workspace.permissions.includes('invite_chef_bartender')"
          :to="companyChefPath"
          class="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          :aria-current="isCompanyChefs ? 'page' : undefined"
        >
          Шеф-бармены компании
        </NuxtLink>
      </nav>

      <div class="mt-auto border-t border-zinc-200 pt-4">
        <p class="truncate text-sm font-medium">{{ fullName }}</p>
        <NuxtLink
          :to="profilePath"
          class="mt-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          :aria-current="isProfile ? 'page' : undefined"
        >
          Профиль
        </NuxtLink>
        <NuxtLink
          v-if="workspace.permissions.includes('view_team')"
          :to="teamPath"
          class="mt-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          :aria-current="isTeam ? 'page' : undefined"
        >
          Команда
        </NuxtLink>
      </div>
    </aside>

    <div class="fixed inset-x-0 top-0 z-10 border-b border-zinc-200 bg-white p-3 lg:hidden">
      <div class="mb-2 flex items-center justify-between">
        <NuxtLink to="/" class="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700"
          >IndieBar</NuxtLink
        >
        <NuxtLink :to="profilePath" class="text-sm font-medium text-emerald-700">Профиль</NuxtLink>
      </div>
      <Select
        v-if="workspaceOptions.length > 1"
        :model-value="workspaceKey"
        :options="workspaceOptions"
        option-label="label"
        option-value="key"
        size="small"
        class="w-full"
        aria-label="Выбрать заведение"
        @update:model-value="selectWorkspace"
      />
      <div v-else class="text-sm">
        <span class="font-medium">{{ workspace.venue.name }}</span>
        <span class="text-zinc-500"> · {{ workspace.company.name }}</span>
      </div>
    </div>

    <main class="min-w-0 flex-1 px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">
      <slot />
    </main>

    <nav
      aria-label="Мобильная навигация"
      class="fixed inset-x-0 bottom-0 z-10 grid border-t border-zinc-200 bg-white p-2 lg:hidden"
      :class="{
        'grid-cols-4':
          workspace.permissions.includes('view_team') &&
          workspace.permissions.includes('invite_chef_bartender'),
        'grid-cols-3':
          workspace.permissions.includes('view_team') !==
          workspace.permissions.includes('invite_chef_bartender'),
        'grid-cols-2':
          !workspace.permissions.includes('view_team') &&
          !workspace.permissions.includes('invite_chef_bartender'),
      }"
    >
      <NuxtLink
        :to="homePath"
        class="rounded-md px-3 py-2 text-center text-sm text-zinc-700 hover:bg-zinc-100"
        :aria-current="isProfile || isTeam ? undefined : 'page'"
      >
        Главная
      </NuxtLink>
      <NuxtLink
        :to="profilePath"
        class="rounded-md px-3 py-2 text-center text-sm text-zinc-700 hover:bg-zinc-100"
        :aria-current="isProfile ? 'page' : undefined"
      >
        Профиль
      </NuxtLink>
      <NuxtLink
        v-if="workspace.permissions.includes('view_team')"
        :to="teamPath"
        class="rounded-md px-3 py-2 text-center text-sm text-zinc-700 hover:bg-zinc-100"
        :aria-current="isTeam ? 'page' : undefined"
      >
        Команда
      </NuxtLink>
      <NuxtLink
        v-if="workspace.permissions.includes('invite_chef_bartender')"
        :to="companyChefPath"
        class="rounded-md px-3 py-2 text-center text-sm text-zinc-700 hover:bg-zinc-100"
        :aria-current="isCompanyChefs ? 'page' : undefined"
      >
        Шеф-бармены
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";

defineOptions({ name: "WorkspaceShell" });

const props = defineProps<{
  workspace: Workspace;
  workplaces: Workspace[];
  fullName: string;
}>();
const emit = defineEmits<{ switch: [workspace: Workspace] }>();
const route = useRoute();

const workspaceKey = computed(() => `${props.workspace.company.id}:${props.workspace.venue.id}`);
const workspaceOptions = computed(() =>
  props.workplaces.map((item) => ({
    ...item,
    key: `${item.company.id}:${item.venue.id}`,
    label: `${item.company.name} · ${item.venue.name}`,
  })),
);
const homePath = computed(
  () => `/app/companies/${props.workspace.company.id}/venues/${props.workspace.venue.id}`,
);
const profilePath = computed(() => `${homePath.value}/profile`);
const teamPath = computed(() => `${homePath.value}/team`);
const companyChefPath = computed(() => `${homePath.value}/chefs`);
const isProfile = computed(() => route.path.endsWith("/profile"));
const isTeam = computed(() => route.path.endsWith("/team"));
const isCompanyChefs = computed(() => route.path.endsWith("/chefs"));

function selectWorkspace(key: string): void {
  const selected = props.workplaces.find((item) => `${item.company.id}:${item.venue.id}` === key);
  if (selected) emit("switch", selected);
}
</script>
