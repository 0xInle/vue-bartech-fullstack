<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-base font-semibold">Приглашение сотрудника</h2>
      <label
        v-if="allowNewVenueInvite"
        for="invite-new-venue"
        class="flex items-center gap-2 text-xs"
      >
        <Checkbox
          v-model="newVenue"
          input-id="invite-new-venue"
          binary
          size="small"
          :disabled="busy"
        />
        <span>В новое заведение</span>
      </label>
    </div>
    <FloatLabel variant="on">
      <InputText
        id="invite-email"
        v-model="email"
        type="email"
        autocomplete="email"
        maxlength="254"
        required
        size="small"
        class="w-full"
      />
      <label for="invite-email" class="text-xs">Электронная почта</label>
    </FloatLabel>
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
      <FloatLabel variant="on">
        <Select
          v-model="role"
          input-id="invite-role"
          :options="roles"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
          :disabled="busy"
          aria-label="Должность сотрудника"
        />
        <label for="invite-role" class="text-xs">Должность</label>
      </FloatLabel>
      <Button
        type="submit"
        label="Пригласить"
        size="small"
        :loading="busy"
        :disabled="busy || !role"
      />
    </div>
  </form>
</template>

<script setup lang="ts">
import { watch } from "vue";
import type { VenueRole } from "../composables/useVenueTeam";

type InviteRole = VenueRole | "CHEF_BARTENDER";

const props = defineProps<{
  allowVenueInvites: boolean;
  allowBarManager: boolean;
  allowChefBartender: boolean;
  allowNewVenueInvite: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{ submit: [email: string, role: InviteRole, newVenue: boolean] }>();
const email = ref("");
const role = ref<InviteRole | null>(null);
const newVenue = ref(false);
const roles = computed(() =>
  newVenue.value
    ? [
        { label: "Бар-менеджер", value: "BAR_MANAGER" as const },
        { label: "Старший бармен", value: "SENIOR_BARTENDER" as const },
        { label: "Бармен", value: "BARTENDER" as const },
      ]
    : [
        ...(props.allowVenueInvites
          ? [
              { label: "Бармен", value: "BARTENDER" as const },
              { label: "Барбек", value: "BARBACK" as const },
              { label: "Стажёр", value: "TRAINEE" as const },
              { label: "Старший бармен", value: "SENIOR_BARTENDER" as const },
              ...(props.allowBarManager
                ? [{ label: "Бар-менеджер", value: "BAR_MANAGER" as const }]
                : []),
            ]
          : []),
        ...(props.allowChefBartender
          ? [{ label: "Шеф-бармен", value: "CHEF_BARTENDER" as const }]
          : []),
      ],
);

watch(
  roles,
  (availableRoles) => {
    if (role.value && !availableRoles.some((option) => option.value === role.value)) {
      role.value = null;
    }
  },
  { immediate: true },
);

function submit(): void {
  if (role.value) emit("submit", email.value.trim(), role.value, newVenue.value);
}
</script>
