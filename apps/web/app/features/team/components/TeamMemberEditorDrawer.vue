<template>
  <Drawer v-model:visible="visible" position="right" class="w-full sm:!w-96">
    <template v-if="member">
      <div class="space-y-6">
        <header>
          <h2 class="text-base font-semibold">{{ member.fullName }}</h2>
          <p class="mt-1 text-sm text-color-secondary">{{ member.email }}</p>
        </header>

        <form class="space-y-6" @submit.prevent="save">
          <section v-if="member.availableRoles.length" class="space-y-3">
            <label for="team-member-role" class="text-sm font-medium">Должность</label>
            <Select
              id="team-member-role"
              v-model="role"
              :options="availableRoles"
              option-label="label"
              option-value="value"
              size="small"
              class="w-full"
              :disabled="busy"
            />
            <Message v-if="roleChanged" severity="warn" :closable="false">
              При изменении должности дополнительные права сотрудника в этом заведении будут
              сброшены.
            </Message>
          </section>

          <section
            v-if="member.availableRoles.length"
            class="space-y-3 border-t border-surface pt-4"
          >
            <h3 class="text-sm font-medium">Завершение членства</h3>
            <DatePicker
              v-model="lastWorkingDay"
              date-format="dd.mm.yy"
              size="small"
              class="w-full"
              placeholder="Последний рабочий день"
            />
            <Button
              label="Завершить членство"
              severity="danger"
              variant="outlined"
              size="small"
              :disabled="busy || !lastWorkingDay"
              @click="endMembership"
            />
          </section>

          <section class="space-y-3">
            <h3 class="text-sm font-medium">Дополнительные права</h3>
            <p
              v-if="!member.canManageDelegatedPermissions && !roleChanged"
              class="text-sm text-color-secondary"
            >
              {{ permissionNames(member.delegatedPermissions) || "Дополнительных прав нет" }}
            </p>
            <template v-else-if="canEditPermissions">
              <p v-if="readOnlyPermissionNames" class="text-sm text-color-secondary">
                Нельзя изменить: {{ readOnlyPermissionNames }}
              </p>
              <label
                v-for="permission in availablePermissionOptions"
                :key="permission.value"
                class="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  v-model="delegatedPermissions"
                  :input-id="`team-permission-${permission.value}`"
                  :value="permission.value"
                  :disabled="busy || role === 'BAR_MANAGER'"
                />
                <span>{{ permission.label }}</span>
              </label>
            </template>
            <p v-else class="text-sm text-color-secondary">
              {{ permissionNames(member.delegatedPermissions) || "Дополнительных прав нет" }}
            </p>
          </section>

          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

          <div class="flex justify-end gap-2">
            <Button
              label="Отмена"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="busy"
              @click="emit('close')"
            />
            <Button
              v-if="hasChanges"
              type="submit"
              label="Сохранить"
              size="small"
              :loading="busy"
              :disabled="busy"
            />
          </div>
        </form>
      </div>
    </template>
  </Drawer>
</template>

<script setup lang="ts">
import type {
  DelegatedPermission,
  TeamMember,
  UpdateTeamMemberInput,
  VenueRole,
} from "../composables/useVenueTeam";

const props = defineProps<{
  member: TeamMember | null;
  busy: boolean;
  error: string;
}>();
const emit = defineEmits<{
  close: [];
  save: [input: UpdateTeamMemberInput];
  end: [lastWorkingDay: string];
}>();
const visible = computed({
  get: () => props.member !== null,
  set: (value: boolean) => {
    if (!value) emit("close");
  },
});
const role = ref<VenueRole>("BARTENDER");
const delegatedPermissions = ref<DelegatedPermission[]>([]);
const lastWorkingDay = ref<Date | null>(null);
const availableRoles: Array<{ label: string; value: VenueRole }> = [
  { label: "Бармен", value: "BARTENDER" },
  { label: "Барбек", value: "BARBACK" },
  { label: "Стажёр", value: "TRAINEE" },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" },
  { label: "Бар-менеджер", value: "BAR_MANAGER" },
];
const permissionOptions = [
  { label: "Управление продукцией", value: "manage_products" },
  { label: "Управление архивом", value: "manage_product_archive" },
  { label: "Безвозвратное удаление продукции", value: "delete_products_permanently" },
  { label: "Выгрузка данных", value: "export_data" },
  { label: "Приглашение сотрудников", value: "invite_employees" },
  { label: "Управление графиком сотрудников", value: "manage_schedule" },
] satisfies Array<{ label: string; value: DelegatedPermission }>;
const roleChanged = computed(() => Boolean(props.member && role.value !== props.member.role));
const canEditPermissions = computed(
  () => Boolean(props.member?.canManageDelegatedPermissions) && !roleChanged.value,
);
const availablePermissionOptions = computed(() =>
  permissionOptions.filter((permission) =>
    props.member?.availableDelegatedPermissions.includes(permission.value),
  ),
);
const readOnlyPermissionNames = computed(() => {
  const member = props.member;
  if (!member) return "";
  return permissionNames(
    member.delegatedPermissions.filter(
      (permission) => !member.availableDelegatedPermissions.includes(permission),
    ),
  );
});
const hasChanges = computed(() => {
  const member = props.member;
  if (!member) return false;
  return (
    roleChanged.value || !samePermissions(member.delegatedPermissions, delegatedPermissions.value)
  );
});

watch(
  () => props.member,
  (member) => {
    role.value = member?.role ?? "BARTENDER";
    delegatedPermissions.value = getEditablePermissions(member?.delegatedPermissions ?? []);
    lastWorkingDay.value = null;
  },
  { immediate: true },
);

watch(role, (nextRole) => {
  const member = props.member;
  if (!member) return;
  delegatedPermissions.value =
    nextRole === member.role ? getEditablePermissions(member.delegatedPermissions) : [];
});

function save(): void {
  if (!props.member || !hasChanges.value) return;
  emit("save", {
    role: role.value,
    delegatedPermissions: roleChanged.value ? [] : delegatedPermissions.value,
  });
}

function endMembership(): void {
  if (!lastWorkingDay.value) return;
  const date = lastWorkingDay.value;
  emit(
    "end",
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  );
}

function getEditablePermissions(codes: readonly string[]): DelegatedPermission[] {
  return codes.filter((code): code is DelegatedPermission =>
    permissionOptions.some((permission) => permission.value === code),
  );
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
