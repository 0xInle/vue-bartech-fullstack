<template>
  <section>
    <form class="space-y-3" novalidate @submit.prevent="submit">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="login-email"
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
        <label for="login-email" class="text-xs">Электронная почта</label>
      </FloatLabel>
      <FloatLabel class="w-full" variant="on">
        <Password
          :model-value="password"
          input-id="login-password"
          :input-props="{ autocomplete: 'current-password', maxlength: 256 }"
          :invalid="passwordInvalid"
          required
          :feedback="false"
          toggle-mask
          size="small"
          input-class="w-full"
          class="password-field w-full"
          @update:model-value="$emit('update:password', String($event))"
        />
        <label for="login-password" class="text-xs">Пароль</label>
      </FloatLabel>
      <Button
        type="submit"
        :label="busy ? 'Входим…' : 'Войти'"
        :disabled="disabled"
        :loading="busy"
        size="small"
        class="w-full"
      />
    </form>
    <div class="mt-3 flex justify-center">
      <Button
        type="button"
        label="Забыли пароль?"
        variant="text"
        size="small"
        class="inline-link"
        @click="$emit('recover')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ email: string; password: string; busy: boolean; disabled: boolean }>();
const emit = defineEmits<{
  "update:email": [value: string];
  "update:password": [value: string];
  submit: [];
  recover: [];
}>();

const validationAttempted = ref(false);
const emailInvalid = computed(
  () => validationAttempted.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email.trim()),
);
const passwordInvalid = computed(() => validationAttempted.value && props.password.length === 0);

function submit(): void {
  validationAttempted.value = true;
  if (emailInvalid.value || passwordInvalid.value) return;
  emit("submit");
}
</script>
