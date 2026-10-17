<template>
  <PublicEntryScreen />
</template>

<script setup lang="ts">
import PublicEntryScreen from "~/components/entrypoints/PublicEntryScreen.vue";

defineOptions({ name: "LandingPage" });

useSeoMeta({
  title: "IndieBar — рабочее пространство барной команды",
  description:
    "Создавайте и поддерживайте технологические карты бара в одном рабочем пространстве.",
  ogTitle: "IndieBar — технологические карты бара",
  ogDescription: "Рецептуры и продукты барной команды в одном месте.",
  ogType: "website",
  ogLocale: "ru_RU",
});

const publicSiteOrigin = usePublicSiteOrigin();
useHead(() => ({
  link: publicSiteOrigin.value
    ? [{ rel: "canonical", href: new URL("/", publicSiteOrigin.value).toString() }]
    : [],
  meta: publicSiteOrigin.value
    ? [{ property: "og:url", content: new URL("/", publicSiteOrigin.value).toString() }]
    : [],
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "IndieBar",
        description: "Рабочее пространство для барной команды.",
        inLanguage: "ru",
      }),
    },
  ],
}));
</script>
