<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    class="w-full sm:!w-96"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">Управление сотрудником</span>
    </template>
    <template v-if="member">
      <div class="space-y-3">
        <Message
          v-if="roleChanged"
          severity="warn"
          size="small"
          :closable="false"
          :pt="compactMessagePt"
        >
          При смене должности персональные права заменятся правами новой роли.
        </Message>
        <header>
          <h2 class="text-sm font-medium text-color-secondary">{{ member.fullName }}</h2>
        </header>

        <form class="space-y-6" @submit.prevent="save">
          <section v-if="member.availableRoles.length" class="space-y-3">
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <FloatLabel variant="on">
                <Select
                  v-model="role"
                  input-id="team-member-role"
                  :options="availableRoles"
                  option-label="label"
                  option-value="value"
                  size="small"
                  class="w-full"
                  :disabled="busy"
                />
                <label for="team-member-role" class="text-xs">Должность</label>
              </FloatLabel>
              <Button
                label="Подтвердить"
                size="small"
                :loading="busy"
                :disabled="busy || !roleChanged"
                @click="emit('confirm-role', role)"
              />
            </div>
          </section>

          <section class="space-y-3">
            <h3 class="text-sm font-medium">Разрешения сотрудника</h3>
            <p
              v-if="
                !member.canManagePermissionOverrides &&
                member.role !== 'BAR_MANAGER' &&
                !roleChanged
              "
              class="text-sm text-color-secondary"
            >
              {{ permissionNames(member.permissions) || "Разрешений нет" }}
            </p>
            <template v-else-if="shouldShowPermissionToggles">
              <div class="flex flex-col gap-0.5">
                <div
                  v-for="permission in availablePermissionOptions"
                  :key="permission.value"
                  class="flex items-center gap-2 text-sm"
                >
                  <ToggleSwitch
                    :model-value="permissions.includes(permission.value)"
                    :input-id="`team-permission-${permission.value}`"
                    :disabled="busy || roleChanged || !canEditPermissions"
                    class="scale-75 origin-left"
                    @update:model-value="setPermission(permission.value, $event)"
                  />
                  <label :for="`team-permission-${permission.value}`" class="text-xs">
                    {{ permission.label }}
                  </label>
                </div>
              </div>
            </template>
            <p v-else class="text-sm text-color-secondary">
              {{ permissionNames(member.permissions) || "Разрешений нет" }}
            </p>
          </section>

          <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
            error
          }}</Message>

          <div class="flex justify-end gap-2">
            <Button
              label="Отмена"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="busy"
              @click="requestClose"
            />
            <Button
              type="submit"
              label="Сохранить"
              size="small"
              :loading="busy"
              :disabled="busy || roleChanged || !permissionsChanged"
            />
          </div>
        </form>
      </div>
    </template>
  </Drawer>
</template>

<script setup lang="ts">
import type {
  PermissionCode,
  TeamMember,
  UpdateTeamMemberInput,
  VenueRole,
} from "../composables/useVenueTeam";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{
  member: TeamMember | null;
  busy: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  "confirm-role": [role: VenueRole];
  save: [input: UpdateTeamMemberInput];
}>();
const visible = computed({
  get: () => props.member !== null,
  set: (value: boolean) => {
    if (!value) requestClose();
  },
});
const role = ref<VenueRole>("BARTENDER");
const permissions = ref<PermissionCode[]>([]);
const availableRoles: Array<{ label: string; value: VenueRole }> = [
  { label: "Бармен", value: "BARTENDER" },
  { label: "Барбек", value: "BARBACK" },
  { label: "Стажёр", value: "TRAINEE" },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" },
  { label: "Бар-менеджер", value: "BAR_MANAGER" },
];
const permissionOptions = [
  { label: "Просмотр продукции", value: "view_products" },
  { label: "Просмотр архива", value: "view_archive" },
  { label: "Просмотр команды", value: "view_team" },
  { label: "Управление продукцией", value: "manage_products" },
  { label: "Управление архивом", value: "manage_product_archive" },
  { label: "Безвозвратное удаление продукции", value: "delete_products_permanently" },
  { label: "Выгрузка данных", value: "export_data" },
  { label: "Приглашение сотрудников", value: "invite_employees" },
  { label: "Приглашение бар-менеджера", value: "invite_bar_manager" },
  { label: "Управление командой", value: "manage_team" },
  { label: "Управление разрешениями", value: "manage_delegated_permissions" },
  { label: "Управление своим заведением", value: "manage_venue" },
  { label: "Просмотр истории действий", value: "view_history" },
  { label: "Просмотр графика сотрудников", value: "view_schedule" },
  { label: "Управление графиком сотрудников", value: "manage_schedule" },
] satisfies Array<{ label: string; value: PermissionCode }>;
const roleChanged = computed(() => Boolean(props.member && role.value !== props.member.role));
const canEditPermissions = computed(() => Boolean(props.member?.canManagePermissionOverrides));
const shouldShowPermissionToggles = computed(
  () => canEditPermissions.value || props.member?.role === "BAR_MANAGER",
);
const availablePermissionOptions = computed(() => permissionOptions);
const permissionsChanged = computed(() => {
  const member = props.member;
  if (!member) return false;
  return !samePermissions(getEditablePermissions(member.permissions), permissions.value);
});
watch(
  () => props.member,
  (member) => {
    role.value = member?.role ?? "BARTENDER";
    permissions.value = getEditablePermissions(member?.permissions ?? []);
  },
  { immediate: true },
);

watch(role, (nextRole) => {
  const member = props.member;
  if (!member) return;
  permissions.value = nextRole === member.role ? getEditablePermissions(member.permissions) : [];
});

function save(): void {
  if (!props.member || !permissionsChanged.value || roleChanged.value) return;
  emit("save", {
    role: role.value,
    permissions: permissions.value,
  });
}

function getEditablePermissions(codes: readonly string[]): PermissionCode[] {
  return permissionOptions
    .filter((permission) => codes.includes(permission.value))
    .map(({ value }) => value);
}

function setPermission(permission: PermissionCode, enabled: boolean | undefined): void {
  if (enabled && !permissions.value.includes(permission)) permissions.value.push(permission);
  if (!enabled) permissions.value = permissions.value.filter((code) => code !== permission);
}

function requestClose(): void {
  emit("close");
}

function permissionNames(codes: string[]): string {
  return codes
    .map((code) => permissionOptions.find((permission) => permission.value === code)?.label)
    .filter((label): label is string => Boolean(label))
    .join(", ");
}

function samePermissions(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((code) => second.includes(code));
}
</script>
