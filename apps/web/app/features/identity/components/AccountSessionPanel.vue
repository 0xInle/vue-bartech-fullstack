<template>
  <section>
    <p class="brand-eyebrow text-sm font-medium">Вы вошли как {{ fullName }}</p>
    <slot />
    <div class="mt-4 flex justify-center">
      <Button type="button" label="Выйти" :disabled="busy" size="small" @click="$emit('logout')" />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ fullName: string; busy: boolean }>();
defineEmits<{ logout: [] }>();
</script>
