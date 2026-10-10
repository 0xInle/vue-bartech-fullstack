<template>
  <nav :aria-label="label">
    <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-color-secondary">
      {{ label }}
    </h2>
    <div class="border-l pl-3">
      <Button
        v-for="section in sections"
        :key="section.id"
        as="a"
        :href="`#${section.id}`"
        :label="section.title"
        severity="secondary"
        variant="text"
        size="small"
        class="documentation-link w-full text-sm leading-5"
        :class="{ 'documentation-link-active': section.id === activeSectionId }"
        :aria-current="section.id === activeSectionId ? 'location' : undefined"
        @click.prevent="$emit('navigate', section.id)"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { DocumentationSection } from "~/features/documentation/content/documentation-articles";

defineOptions({ name: "DocumentationArticleNavigation" });

defineProps<{ sections: DocumentationSection[]; activeSectionId: string; label: string }>();

defineEmits<{ navigate: [sectionId: string] }>();
</script>

<style scoped>
div {
  border-color: var(--p-content-border-color);
}

:deep(.p-button.documentation-link) {
  justify-content: flex-start;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--p-text-muted-color);
}

:deep(.p-button.documentation-link .p-button-label) {
  flex: initial;
  text-align: left;
}

:deep(.p-button.documentation-link:hover),
:deep(.p-button.documentation-link:focus-visible) {
  background: transparent;
  box-shadow: none;
  color: var(--p-primary-color);
}

:deep(.p-button.documentation-link.documentation-link-active) {
  color: var(--p-primary-color);
}
</style>
