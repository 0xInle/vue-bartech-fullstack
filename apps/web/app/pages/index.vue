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
});
</script>
