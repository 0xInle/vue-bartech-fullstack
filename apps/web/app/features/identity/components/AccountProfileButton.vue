<template>
  <div class="min-w-0 max-w-32 sm:max-w-40">
    <Button
      type="button"
      icon="pi pi-user"
      :label="fullName"
      :aria-label="`Профиль: ${fullName}`"
      class="account-profile-button max-w-full px-2"
      severity="secondary"
      variant="outlined"
      size="small"
      @click="emit('open')"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ fullName: string }>();
const emit = defineEmits<{ open: [] }>();
</script>
