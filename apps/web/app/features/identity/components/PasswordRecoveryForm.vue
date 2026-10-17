<template>
  <section>
    <template v-if="step === 'email'">
      <form class="space-y-3" @submit.prevent="$emit('request')">
        <FloatLabel class="w-full" variant="on">
          <InputText
            id="recovery-email"
            :model-value="email"
            required
            type="email"
            maxlength="254"
            autocomplete="email"
            size="small"
            class="w-full"
            @update:model-value="$emit('update:email', String($event))"
          />
          <label for="recovery-email" class="text-xs">Электронная почта</label>
        </FloatLabel>
        <Button
          type="submit"
          :label="busy ? 'Отправляем…' : 'Восстановить'"
          :disabled="disabled"
          :loading="busy"
          size="small"
          class="w-full"
        />
      </form>
    </template>
    <template v-else>
      <h2 class="mb-2 text-base font-semibold">Задайте новый пароль</h2>
      <p class="brand-description mb-3 text-sm">
        Введите код из письма и новый пароль, чтобы восстановить доступ.
      </p>
      <form class="space-y-3" @submit.prevent="$emit('complete')">
        <FloatLabel class="w-full" variant="on">
          <InputText
            id="recovery-code"
            :model-value="code"
            required
            inputmode="numeric"
            pattern="[0-9]{6}"
            minlength="6"
            maxlength="6"
            autocomplete="one-time-code"
            size="small"
            class="w-full"
            @update:model-value="$emit('update:code', String($event))"
          />
          <label for="recovery-code" class="text-xs">Код из письма</label>
        </FloatLabel>
        <FloatLabel class="w-full" variant="on">
          <Password
            :model-value="newPassword"
            input-id="new-password"
            :input-props="{ autocomplete: 'new-password', minlength: 8, maxlength: 256 }"
            required
            :feedback="false"
            toggle-mask
            size="small"
            input-class="w-full"
            class="password-field w-full"
            @update:model-value="$emit('update:newPassword', String($event))"
          />
          <label for="new-password" class="text-xs">Новый пароль</label>
        </FloatLabel>
        <Button
          type="submit"
          :label="busy ? 'Сохраняем…' : 'Сохранить пароль'"
          :disabled="disabled"
          :loading="busy"
          size="small"
          class="w-full"
        />
      </form>
    </template>
    <div class="mt-3 flex justify-center">
      <Button
        type="button"
        label="Вернуться ко входу"
        variant="text"
        size="small"
        class="inline-link"
        @click="$emit('back')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  email: string;
  code: string;
  newPassword: string;
  step: "email" | "code";
  busy: boolean;
  disabled: boolean;
}>();
defineEmits<{
  "update:email": [value: string];
  "update:code": [value: string];
  "update:newPassword": [value: string];
  request: [];
  complete: [];
  back: [];
}>();
</script>
