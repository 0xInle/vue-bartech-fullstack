<template>
  <section>
    <form class="space-y-3 pt-2" novalidate @submit.prevent="submit">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-company"
          :model-value="companyName"
          :invalid="companyNameInvalid"
          required
          maxlength="120"
          autocomplete="organization"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:companyName', String($event))"
        />
        <label for="registration-company" class="text-xs">Название компании</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-venue"
          :model-value="venueName"
          :invalid="venueNameInvalid"
          required
          maxlength="120"
          autocomplete="organization-title"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:venueName', String($event))"
        />
        <label for="registration-venue" class="text-xs">Название заведения</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="full-name"
          :model-value="fullName"
          :invalid="fullNameInvalid"
          required
          maxlength="120"
          autocomplete="name"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:fullName', String($event))"
        />
        <label for="full-name" class="text-xs">Имя и фамилия</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <Select
          v-model="selectedRole"
          input-id="registration-role"
          :options="roles"
          option-label="label"
          option-value="value"
          size="small"
          :invalid="roleInvalid"
          required
          class="w-full"
        />
        <label for="registration-role" class="text-xs">Должность</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-email"
          :model-value="email"
          :invalid="emailInvalid"
          required
          type="email"
          maxlength="254"
          autocomplete="email"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:email', String($event))"
        />
        <label for="registration-email" class="text-xs">Электронная почта</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <Password
          :model-value="password"
          input-id="registration-password"
          :input-props="{ autocomplete: 'new-password', minlength: 8, maxlength: 256 }"
          :invalid="passwordInvalid"
          required
          :feedback="false"
          toggle-mask
          size="small"
          input-class="w-full"
          class="password-field w-full"
          @update:model-value="$emit('update:password', String($event))"
        />
        <label for="registration-password" class="text-xs">Пароль</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <Password
          :model-value="passwordConfirmation"
          input-id="registration-password-confirmation"
          :input-props="{ autocomplete: 'new-password', minlength: 8, maxlength: 256 }"
          :invalid="passwordConfirmationInvalid"
          required
          :feedback="false"
          toggle-mask
          size="small"
          input-class="w-full"
          class="password-field w-full"
          @update:model-value="$emit('update:passwordConfirmation', String($event))"
        />
        <label for="registration-password-confirmation" class="text-xs">Подтверждение пароля</label>
      </FloatLabel>
      <Message v-if="passwordConfirmationError" severity="error" :closable="false" class="w-full">
        {{ passwordConfirmationError }}
      </Message>
      <Button
        type="submit"
        :label="busy ? 'Отправляем…' : 'Продолжить'"
        :disabled="disabled"
        :loading="busy"
        size="small"
        class="w-full"
      />
    </form>
  </section>
</template>

<script setup lang="ts">
import { isValidPersonName } from "~/utils/person-name";

type InitialRole = "CHEF_BARTENDER" | "BAR_MANAGER" | "SENIOR_BARTENDER" | "BARTENDER";
const props = defineProps<{
  fullName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  passwordConfirmationError: string;
  companyName: string;
  venueName: string;
  initialRole: InitialRole | "";
  busy: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{
  "update:fullName": [value: string];
  "update:email": [value: string];
  "update:password": [value: string];
  "update:passwordConfirmation": [value: string];
  "update:companyName": [value: string];
  "update:venueName": [value: string];
  "update:initialRole": [value: InitialRole];
  submit: [];
}>();
const selectedRole = computed({
  get: () => props.initialRole || null,
  set: (role: InitialRole | null) => {
    if (role) emit("update:initialRole", role);
  },
});
const validationAttempted = ref(false);
const companyNameInvalid = computed(() => validationAttempted.value && !props.companyName.trim());
const venueNameInvalid = computed(() => validationAttempted.value && !props.venueName.trim());
const fullNameInvalid = computed(
  () => validationAttempted.value && !isValidPersonName(props.fullName),
);
const roleInvalid = computed(() => validationAttempted.value && !props.initialRole);
const emailInvalid = computed(
  () => validationAttempted.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email.trim()),
);
const passwordInvalid = computed(
  () => validationAttempted.value && (props.password.length < 8 || props.password.length > 256),
);
const passwordConfirmationInvalid = computed(
  () =>
    validationAttempted.value &&
    (props.passwordConfirmation.length < 8 ||
      props.passwordConfirmation.length > 256 ||
      props.passwordConfirmation !== props.password ||
      Boolean(props.passwordConfirmationError)),
);

function submit(): void {
  validationAttempted.value = true;
  if (
    companyNameInvalid.value ||
    venueNameInvalid.value ||
    fullNameInvalid.value ||
    roleInvalid.value ||
    emailInvalid.value ||
    passwordInvalid.value ||
    props.passwordConfirmation.length < 8 ||
    props.passwordConfirmation.length > 256
  ) {
    return;
  }
  emit("submit");
}
const roles: { label: string; value: InitialRole }[] = [
  { label: "Шеф-бармен", value: "CHEF_BARTENDER" },
  { label: "Бар-менеджер", value: "BAR_MANAGER" },
  { label: "Старший бармен", value: "SENIOR_BARTENDER" },
  { label: "Бармен", value: "BARTENDER" },
];
</script>
