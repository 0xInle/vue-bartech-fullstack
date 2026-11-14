<template>
  <section class="space-y-4" aria-labelledby="account-deletion-pending-heading">
    <h2 id="account-deletion-pending-heading" class="text-sm font-medium">
      Удаление аккаунта ожидает подтверждения
    </h2>
    <p class="text-xs text-color-secondary">
      Аккаунт будет окончательно удалён {{ scheduledAt }}. До этого момента вы можете отменить
      удаление. Рабочие роли и доступы уже завершены.
    </p>
    <Message
      v-if="errorMessage"
      severity="error"
      size="small"
      :closable="false"
      :pt="compactMessagePt"
    >
      {{ errorMessage }}
    </Message>
    <FloatLabel variant="on">
      <InputText
        id="account-deletion-cancel-password"
        v-model="password"
        class="w-full"
        type="password"
        autocomplete="current-password"
        :disabled="busy"
        maxlength="256"
      />
      <label for="account-deletion-cancel-password" class="text-xs">Текущий пароль</label>
    </FloatLabel>
    <div class="grid gap-2 sm:grid-cols-2">
      <Button
        label="Отменить удаление"
        size="small"
        :loading="busyAction === 'cancel'"
        :disabled="busy || !password"
        @click="$emit('cancel', password)"
      />
      <Button
        label="Выйти"
        severity="secondary"
        variant="outlined"
        size="small"
        :disabled="busy"
        @click="$emit('logout')"
      />
    </div>
    <Button
      label="Забыли пароль?"
      severity="secondary"
      variant="text"
      size="small"
      :disabled="busy"
      @click="$emit('recover')"
    />
  </section>
</template>

<script setup lang="ts">
import { compactMessagePt } from "~/utils/primevue-message";

defineOptions({ name: "AccountDeletionPendingPanel" });

const props = defineProps<{
  deletionScheduledAt: string | null;
  busy: boolean;
  busyAction: string;
  errorMessage: string;
}>();
defineEmits<{ cancel: [password: string]; logout: []; recover: [] }>();

const password = ref("");
const scheduledAt = computed(() => {
  if (!props.deletionScheduledAt) return "через семь дней";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(props.deletionScheduledAt));
});
</script>
