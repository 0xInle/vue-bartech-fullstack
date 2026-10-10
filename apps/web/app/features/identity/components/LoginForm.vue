<template>
  <section>
    <form class="space-y-3" @submit.prevent="$emit('submit')">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="login-email"
          :model-value="email"
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
        :disabled="busy"
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
defineProps<{ email: string; password: string; busy: boolean }>();
defineEmits<{
  "update:email": [value: string];
  "update:password": [value: string];
  submit: [];
  recover: [];
}>();
</script>
