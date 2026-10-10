<template>
  <form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem_auto]" @submit.prevent="submit">
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
    <Select
      v-model="role"
      :options="roles"
      option-label="label"
      option-value="value"
      size="small"
      class="w-full"
      aria-label="Должность сотрудника"
    />
    <Button type="submit" label="Пригласить" size="small" :loading="busy" :disabled="busy" />
  </form>
</template>

<script setup lang="ts">
import type { VenueRole } from "../composables/useVenueTeam";

const props = defineProps<{ allowBarManager: boolean; busy: boolean }>();
const emit = defineEmits<{ submit: [email: string, role: VenueRole] }>();
const email = ref("");
const role = ref<VenueRole>("BARTENDER");
const roles = computed(() => [
  { label: "Бармен", value: "BARTENDER" as const },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" as const },
  ...(props.allowBarManager ? [{ label: "Бар-менеджер", value: "BAR_MANAGER" as const }] : []),
]);

function submit(): void {
  emit("submit", email.value.trim(), role.value);
}
</script>
