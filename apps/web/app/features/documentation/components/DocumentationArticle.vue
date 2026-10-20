<template>
  <article class="mx-auto max-w-2xl text-sm">
    <h1 class="text-xl font-semibold tracking-tight">{{ article.title }}</h1>
    <p class="mt-3 mb-3 leading-6 text-color-secondary">{{ article.summary }}</p>

    <section
      v-for="section in article.sections"
      :id="section.id"
      :key="section.id"
      class="scroll-mt-6 border-t pt-6 first:mt-6 first:border-t-0 first:pt-0 sm:first:mt-8"
    >
      <h2 class="text-base mb-2 font-semibold tracking-tight">{{ section.title }}</h2>
      <p
        v-for="paragraph in section.paragraphs ?? []"
        :key="paragraph"
        class="mb-3 max-w-2xl leading-6 text-color-secondary last:mb-0"
      >
        {{ paragraph }}
      </p>
      <ul
        v-if="section.bullets?.length"
        class="max-w-2xl list-disc space-y-2 pl-5 leading-6 text-color-secondary"
      >
        <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
      </ul>
    </section>
  </article>
</template>

<script setup lang="ts">
import type { DocumentationArticle as DocumentationArticleContent } from "~/features/documentation/content/documentation-articles";

defineOptions({ name: "DocumentationArticle" });

defineProps<{ article: DocumentationArticleContent }>();
</script>

<style scoped>
section {
  border-color: var(--p-content-border-color);
}
</style>
