<template>
  <div class="flex items-center gap-1" aria-label="Действия рабочего пространства">
    <Button
      v-tooltip.top="{ value: 'Справочный центр', class: 'app-tooltip' }"
      as="router-link"
      to="/docs"
      icon="pi pi-question-circle"
      aria-label="Справочный центр"
      severity="secondary"
      variant="outlined"
      size="small"
      class="app-icon-button"
    />
    <Button
      v-tooltip.top="{ value: 'Сменить тему', class: 'app-tooltip' }"
      type="button"
      :icon="colorScheme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
      :aria-label="colorScheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
      :aria-pressed="colorScheme === 'dark'"
      severity="secondary"
      variant="outlined"
      size="small"
      class="app-icon-button"
      @click="toggleColorScheme"
    />
  </div>
</template>

<script setup lang="ts">
import { useColorScheme } from "~/composables/useColorScheme";

const { colorScheme, toggleColorScheme } = useColorScheme();
</script>
