<template>
  <section>
    <form class="space-y-3 pt-2" novalidate @submit.prevent="submit">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="company-creation-name"
          :model-value="companyName"
          :invalid="companyNameInvalid"
          required
          maxlength="120"
          autocomplete="organization"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:companyName', String($event))"
        />
        <label for="company-creation-name" class="text-xs">Название компании</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="company-creation-venue"
          :model-value="venueName"
          :invalid="venueNameInvalid"
          required
          maxlength="120"
          autocomplete="organization-title"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:venueName', String($event))"
        />
        <label for="company-creation-venue" class="text-xs">Название первого заведения</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <Select
          v-model="selectedRole"
          input-id="company-creation-role"
          :options="roles"
          option-label="label"
          option-value="value"
          size="small"
          :invalid="roleInvalid"
          required
          class="w-full"
        />
        <label for="company-creation-role" class="text-xs">Должность</label>
      </FloatLabel>
      <Button
        type="submit"
        :label="busy ? 'Создаём…' : 'Создать компанию'"
        :disabled="disabled"
        :loading="busy"
        size="small"
        class="w-full"
      />
      <Button
        type="button"
        label="К рабочим пространствам"
        icon="pi pi-arrow-left"
        severity="secondary"
        variant="outlined"
        :disabled="busy"
        size="small"
        class="w-full"
        @click="$emit('cancel')"
      />
    </form>
  </section>
</template>

<script setup lang="ts">
type InitialRole = "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";

const props = defineProps<{
  companyName: string;
  venueName: string;
  initialRole: InitialRole | "";
  busy: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  "update:companyName": [value: string];
  "update:venueName": [value: string];
  "update:initialRole": [value: InitialRole];
  submit: [];
  cancel: [];
}>();

const roles: { label: string; value: InitialRole }[] = [
  { label: "Шеф-бармен", value: "CHEF_BARTENDER" },
  { label: "Бар-менеджер", value: "BAR_MANAGER" },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" },
  { label: "Бармен", value: "BARTENDER" },
];

const selectedRole = computed({
  get: () => props.initialRole || null,
  set: (role: InitialRole | null) => {
    if (role) emit("update:initialRole", role);
  },
});

const validationAttempted = ref(false);
const companyNameInvalid = computed(() => validationAttempted.value && !props.companyName.trim());
const venueNameInvalid = computed(() => validationAttempted.value && !props.venueName.trim());
const roleInvalid = computed(() => validationAttempted.value && !props.initialRole);

function submit(): void {
  validationAttempted.value = true;
  if (companyNameInvalid.value || venueNameInvalid.value || roleInvalid.value) return;
  emit("submit");
}
</script>
