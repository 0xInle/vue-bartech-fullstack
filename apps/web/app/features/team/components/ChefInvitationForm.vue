<template>
  <form class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="submit">
    <FloatLabel variant="on">
      <InputText
        id="chef-invitation-email"
        v-model="email"
        type="email"
        autocomplete="email"
        maxlength="254"
        required
        size="small"
        class="w-full"
      />
      <label for="chef-invitation-email" class="text-xs">Электронная почта</label>
    </FloatLabel>
    <Button type="submit" label="Пригласить шеф-бармена" size="small" :loading="busy" />
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
