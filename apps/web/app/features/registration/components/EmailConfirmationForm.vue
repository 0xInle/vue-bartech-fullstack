<template>
  <section>
    <h2 class="mt-5 text-2xl font-semibold">Подтвердите почту</h2>
    <p class="brand-description mt-2 text-sm">
      Введите шестизначный код из письма для {{ email }}.
    </p>
    <form class="mt-6 space-y-4" @submit.prevent="$emit('submit')">
      <FloatLabel class="w-full" variant="on">
        <InputText
          id="registration-code"
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
        <label for="registration-code" class="text-xs">Код подтверждения</label>
      </FloatLabel>
      <Button
        type="submit"
        :label="busy ? 'Проверяем…' : 'Подтвердить и создать'"
        :disabled="disabled"
        :loading="busy"
        size="small"
        class="w-full"
      />
    </form>
    <div class="mt-4 flex flex-wrap gap-x-2 gap-y-1">
      <Button
        type="button"
        label="Отправить новый код"
        variant="text"
        size="small"
        class="inline-link"
        :disabled="disabled"
        @click="$emit('resend')"
      />
      <Button
        type="button"
        label="Изменить данные"
        severity="secondary"
        variant="text"
        size="small"
        class="inline-link"
        @click="$emit('edit')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ email: string; code: string; busy: boolean; disabled: boolean }>();
defineEmits<{
  "update:code": [value: string];
  submit: [];
  resend: [];
  edit: [];
}>();
</script>
