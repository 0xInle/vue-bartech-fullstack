<template>
  <div class="mt-2 flex justify-center gap-1" aria-label="Действия рабочего пространства">
    <Button
      v-tooltip.top="{ value: 'Профиль', class: 'app-tooltip' }"
      type="button"
      icon="pi pi-user"
      aria-label="Профиль"
      severity="secondary"
      variant="text"
      size="small"
      class="workspace-action-icon-button"
      @click="$emit('openProfile')"
    />
    <Button
      v-tooltip.top="{ value: 'Сменить тему', class: 'app-tooltip' }"
      type="button"
      :icon="colorScheme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
      :aria-label="colorScheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
      :aria-pressed="colorScheme === 'dark'"
      severity="secondary"
      variant="text"
      size="small"
      class="workspace-action-icon-button"
      @click="toggleColorScheme"
    />
    <Button
      v-tooltip.top="{ value: 'Справочный центр', class: 'app-tooltip' }"
      as="router-link"
      to="/docs"
      icon="pi pi-question-circle"
      aria-label="Справочный центр"
      severity="secondary"
      variant="text"
      size="small"
      class="workspace-action-icon-button"
      @click="$emit('openDocs')"
    />
  </div>
</template>

<script setup lang="ts">
import { useColorScheme } from "~/composables/useColorScheme";

defineEmits<{ openProfile: []; openDocs: [] }>();
const { colorScheme, toggleColorScheme } = useColorScheme();
</script>
