<template>
  <DocumentationScreen />
</template>

<script setup lang="ts">
import DocumentationScreen from "~/features/documentation/components/DocumentationScreen.vue";

defineOptions({ name: "DocumentationPage" });

useSeoMeta({
  title: "Документация IndieBar",
  description: "Краткие ответы о заведениях, сотрудниках, ролях, техкартах и работе в IndieBar.",
  ogTitle: "Документация IndieBar",
  ogDescription: "Краткие ответы о заведениях, сотрудниках, ролях, техкартах и работе в IndieBar.",
  ogType: "website",
  ogLocale: "ru_RU",
});

const publicSiteOrigin = usePublicSiteOrigin();
useHead(() => ({
  link: publicSiteOrigin.value
    ? [{ rel: "canonical", href: new URL("/docs", publicSiteOrigin.value).toString() }]
    : [],
  meta: publicSiteOrigin.value
    ? [{ property: "og:url", content: new URL("/docs", publicSiteOrigin.value).toString() }]
    : [],
}));
</script>
