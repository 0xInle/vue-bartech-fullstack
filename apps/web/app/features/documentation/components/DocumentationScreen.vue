<template>
  <main class="documentation-page min-h-screen">
    <header class="documentation-header border-b">
      <div
        class="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <NuxtLink v-slot="{ href, navigate }" to="/" custom>
          <Button
            as="a"
            :href="href"
            label="Вернуться"
            icon="pi pi-arrow-left"
            severity="secondary"
            variant="text"
            size="small"
            @click="navigate"
          />
        </NuxtLink>
        <span class="text-sm font-medium text-color-secondary">Справочный центр</span>
      </div>
    </header>

    <div class="mx-auto max-w-screen-2xl px-4 sm:px-6">
      <div class="documentation-mobile-actions flex items-center gap-2 py-4">
        <Button
          label="Разделы"
          icon="pi pi-bars"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="openDrawer('topics')"
        />
        <Button
          label="В статье"
          icon="pi pi-list"
          severity="secondary"
          variant="outlined"
          size="small"
          @click="openDrawer('contents')"
        />
      </div>

      <div class="documentation-layout">
        <aside class="documentation-sidebar" aria-label="Навигация по документации">
          <DocumentationTopicNavigation
            :articles="documentationArticles"
            :active-article-id="activeArticle.id"
            @select="selectArticle"
          />
        </aside>

        <section class="documentation-article-column min-w-0 py-10">
          <DocumentationArticle :article="activeArticle" />
        </section>

        <aside class="documentation-sidebar" aria-label="Содержание статьи">
          <DocumentationArticleNavigation
            :sections="activeArticle.sections"
            :active-section-id="activeSectionId"
            label="В этой статье"
            @navigate="navigateToSection"
          />
        </aside>
      </div>
    </div>

    <Drawer
      v-model:visible="drawerVisible"
      :header="drawerTitle"
      position="left"
      class="drawer-size-md"
    >
      <DocumentationTopicNavigation
        v-if="drawerView === 'topics'"
        :articles="documentationArticles"
        :active-article-id="activeArticle.id"
        @select="selectArticle"
      />
      <DocumentationArticleNavigation
        v-else
        :sections="activeArticle.sections"
        :active-section-id="activeSectionId"
        label="В этой статье"
        @navigate="navigateToSection"
      />
    </Drawer>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DocumentationArticle from "~/features/documentation/components/DocumentationArticle.vue";
import DocumentationArticleNavigation from "~/features/documentation/components/DocumentationArticleNavigation.vue";
import DocumentationTopicNavigation from "~/features/documentation/components/DocumentationTopicNavigation.vue";
import { documentationArticles } from "~/features/documentation/content/documentation-articles";

defineOptions({ name: "DocumentationScreen" });

type DrawerView = "topics" | "contents";

const activeArticleId = ref(documentationArticles[0]?.id ?? "start");
const activeSectionId = ref("");
const drawerVisible = ref(false);
const drawerView = ref<DrawerView>("topics");
let sectionObserver: IntersectionObserver | undefined;
const activeArticle = computed(
  () =>
    documentationArticles.find((article) => article.id === activeArticleId.value) ??
    documentationArticles[0]!,
);
const drawerTitle = computed(() => (drawerView.value === "topics" ? "Разделы" : "В этой статье"));

function selectArticle(articleId: string): void {
  activeArticleId.value = articleId;
  drawerVisible.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDrawer(view: DrawerView): void {
  drawerView.value = view;
  drawerVisible.value = true;
}

function navigateToSection(sectionId: string): void {
  activeSectionId.value = sectionId;
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  drawerVisible.value = false;
}

function trackArticleSections(): void {
  sectionObserver?.disconnect();
  activeSectionId.value = activeArticle.value.sections[0]?.id ?? "";

  void nextTick(() => {
    const sectionElements = activeArticle.value.sections
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => section !== null);

    sectionObserver = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];

        if (visibleSection) {
          activeSectionId.value = visibleSection.target.id;
        }
      },
      { rootMargin: "-12% 0px -72%" },
    );

    sectionElements.forEach((section) => sectionObserver?.observe(section));
  });
}

onMounted(trackArticleSections);
onBeforeUnmount(() => sectionObserver?.disconnect());
watch(activeArticleId, trackArticleSections);
</script>

<style scoped>
.documentation-page {
  background: var(--p-surface-50);
  color: var(--p-text-color);
}

.documentation-header,
.documentation-sidebar {
  border-color: var(--p-content-border-color);
}

.documentation-sidebar {
  display: none;
}

@media (min-width: 64rem) {
  .documentation-layout {
    display: grid;
    grid-template-columns: 14rem minmax(0, 1fr) 13rem;
    gap: 1.5rem;
  }

  .documentation-mobile-actions {
    display: none;
  }

  .documentation-sidebar {
    position: sticky;
    top: 0;
    display: block;
    max-height: 100vh;
    overflow-y: auto;
    padding-block: 2.5rem;
  }

  .documentation-article-column {
    padding-block: 2.5rem;
  }
}

:global(.app-dark) .documentation-page {
  background: var(--p-surface-950);
}
</style>
