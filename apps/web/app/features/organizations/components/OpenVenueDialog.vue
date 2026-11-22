<template>
  <Dialog
    v-model:visible="visible"
    modal
    :dismissable-mask="!busy"
    :closable="!busy"
    :close-on-escape="!busy"
    header="Создание рабочего пространства"
    class="dialog-size-sm"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <form class="space-y-3 pt-2" novalidate @submit.prevent="createVenue">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="open-venue-name"
          v-model="venueName"
          :invalid="venueNameInvalid"
          required
          maxlength="120"
          autocomplete="organization-title"
          size="small"
          class="w-full"
          :disabled="busy"
        />
        <label for="open-venue-name" class="text-xs">Название заведения</label>
      </FloatLabel>
      <FloatLabel v-if="!isChefBartender" class="w-full" variant="on">
        <Select
          v-model="initialRole"
          input-id="open-venue-role"
          :options="roles"
          option-label="label"
          option-value="value"
          size="small"
          :invalid="roleInvalid"
          required
          class="w-full"
          :disabled="busy"
        />
        <label for="open-venue-role" class="text-xs">Ваша должность</label>
      </FloatLabel>
      <Message v-if="errorMessage" severity="error" :closable="false" class="w-full">
        {{ errorMessage }}
      </Message>
      <div class="flex gap-2">
        <Button
          type="button"
          label="Отмена"
          severity="secondary"
          variant="outlined"
          :disabled="busy"
          size="small"
          class="flex-1"
          @click="visible = false"
        />
        <Button
          type="submit"
          :label="busy ? 'Создаём…' : 'Создать'"
          :loading="busy"
          :disabled="busy"
          size="small"
          class="flex-1"
        />
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useVenueManagement } from "~/features/organizations/composables/useVenueManagement";

type LocalRole = "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";

const props = defineProps<{ companyId: string }>();
const identity = useIdentityFlow();
const {
  canCreateVenue: permission,
  createVenue: requestCreateVenue,
  isChefBartender,
} = useVenueManagement(props.companyId);
const visible = ref(false);
const busy = ref(false);
const venueName = ref("");
const initialRole = ref<LocalRole | "">("");
const errorMessage = ref("");
const validationAttempted = ref(false);
const venueNameInvalid = computed(() => validationAttempted.value && !venueName.value.trim());
const roleInvalid = computed(
  () => validationAttempted.value && !isChefBartender.value && !initialRole.value,
);
const roles: { label: string; value: LocalRole }[] = [
  { label: "Бармен", value: "BARTENDER" },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" },
  { label: "Бар-менеджер", value: "BAR_MANAGER" },
];

function open(): void {
  if (!permission.value) return;
  venueName.value = "";
  initialRole.value = "";
  errorMessage.value = "";
  validationAttempted.value = false;
  visible.value = true;
}

async function createVenue(): Promise<void> {
  if (!permission.value) return;
  validationAttempted.value = true;
  if (venueNameInvalid.value || roleInvalid.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const result = await requestCreateVenue(venueName.value, initialRole.value || undefined);
    await identity.loadSession();
    await navigateTo(result.redirectTo);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось открыть заведение. Попробуйте ещё раз.";
  } finally {
    busy.value = false;
  }
}

defineExpose({ open });
</script>
