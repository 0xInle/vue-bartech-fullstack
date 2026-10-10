<template>
  <nav aria-label="Разделы документации" class="flex flex-col gap-5">
    <section v-for="group in articleGroups" :key="group.title">
      <h2 class="mb-1 text-xs font-semibold uppercase tracking-wide text-color-secondary">
        {{ group.title }}
      </h2>
      <div class="flex flex-col gap-1">
        <Button
          v-for="article in group.articles"
          :key="article.id"
          :label="article.title"
          severity="secondary"
          variant="text"
          size="small"
          class="documentation-link w-full text-sm leading-5"
          :class="{ 'documentation-link-active': article.id === activeArticleId }"
          :aria-current="article.id === activeArticleId ? 'page' : undefined"
          @click="$emit('select', article.id)"
        />
      </div>
    </section>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DocumentationArticle } from "~/features/documentation/content/documentation-articles";

defineOptions({ name: "DocumentationTopicNavigation" });

const props = defineProps<{ articles: DocumentationArticle[]; activeArticleId: string }>();

defineEmits<{ select: [articleId: string] }>();

const groups = [
  { title: "Начало работы", articleIds: ["start", "invitations"] },
  { title: "Команда", articleIds: ["roles", "workplaces", "responsibility"] },
  { title: "Работа в приложении", articleIds: ["products", "closing", "help"] },
];

const articleGroups = computed(() =>
  groups.map((group) => ({
    title: group.title,
    articles: group.articleIds
      .map((articleId) => props.articles.find((article) => article.id === articleId))
      .filter((article): article is DocumentationArticle => Boolean(article)),
  })),
);
</script>

<style scoped>
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
