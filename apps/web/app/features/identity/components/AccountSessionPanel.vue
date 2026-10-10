<template>
  <section>
    <p class="brand-eyebrow text-sm font-medium">Вы вошли как {{ fullName }}</p>
    <slot />
    <Button
      type="button"
      label="Выйти"
      severity="secondary"
      variant="text"
      class="mt-3"
      :disabled="busy"
      size="small"
      @click="$emit('logout')"
    />
  </section>
</template>

<script setup lang="ts">
defineProps<{ fullName: string; busy: boolean }>();
defineEmits<{ logout: [] }>();
</script>
