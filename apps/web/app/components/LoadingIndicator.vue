<template>
  <div
    class="flex w-full justify-center"
    :class="screen && 'fixed inset-0 z-[9999] items-center bg-surface-0'"
    role="status"
  >
    <ProgressSpinner
      aria-label="Загрузка"
      :style="[
        { width: screen ? '4rem' : '2rem', height: screen ? '4rem' : '2rem' },
        {
          '--p-progressspinner-color-1': 'var(--p-button-text-primary-color)',
          '--p-progressspinner-color-2': 'var(--p-button-text-primary-color)',
          '--p-progressspinner-color-3': 'var(--p-button-text-primary-color)',
          '--p-progressspinner-color-4': 'var(--p-button-text-primary-color)',
        },
      ]"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ screen?: boolean }>(), { screen: false });
</script>
