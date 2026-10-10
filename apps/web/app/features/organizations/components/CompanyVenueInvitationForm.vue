<template>
  <form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="submit">
    <FloatLabel variant="on">
      <InputText
        id="new-venue-manager-email"
        v-model="email"
        type="email"
        autocomplete="email"
        maxlength="254"
        required
        size="small"
        class="w-full"
      />
      <label for="new-venue-manager-email" class="text-xs">Электронная почта</label>
    </FloatLabel>
    <Button type="submit" label="Пригласить бар-менеджера" size="small" :loading="busy" />
  </form>
</template>

<script setup lang="ts">
defineProps<{ busy: boolean }>();
const emit = defineEmits<{ submit: [email: string] }>();
const email = ref("");

function submit(): void {
  emit("submit", email.value.trim());
}
</script>
