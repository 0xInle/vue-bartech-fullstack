<template>
  <section>
    <form class="space-y-3" @submit.prevent="$emit('submit')">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-company"
          :model-value="companyName"
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
          required
          maxlength="120"
          autocomplete="name"
          size="small"
          class="w-full"
          @update:model-value="$emit('update:fullName', String($event))"
        />
        <label for="full-name" class="text-xs">ФИО</label>
      </FloatLabel>
      <FloatLabel class="w-full md:w-56" variant="on">
        <CascadeSelect
          input-id="registration-role"
          :model-value="selectedRole"
          :options="roleGroups"
          option-label="label"
          option-group-label="label"
          :option-group-children="['roles']"
          size="small"
          required
          class="w-full"
          @update:model-value="updateRole"
        />
        <label for="registration-role" class="text-xs">Должность</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-email"
          :model-value="email"
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
const selectedRole = computed(() => {
  for (const group of roleGroups) {
    const role = group.roles.find((item) => item.value === props.initialRole);
    if (role) return role;
  }
  return null;
});
const roleGroups = [
  {
    label: "Компания",
    roles: [{ label: "Шеф-бармен", value: "CHEF_BARTENDER" as const }],
  },
  {
    label: "Заведение",
    roles: [
      { label: "Бар-менеджер", value: "BAR_MANAGER" as const },
      { label: "Старший бармен", value: "SENIOR_BARTENDER" as const },
      { label: "Бармен", value: "BARTENDER" as const },
    ],
  },
];

function updateRole(option: { value: InitialRole } | null): void {
  if (option) emit("update:initialRole", option.value);
}
</script>
