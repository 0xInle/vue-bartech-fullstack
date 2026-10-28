<template>
  <CocktailListScreen :cocktail-id="cocktailId" />
</template>

<script setup lang="ts">
import CocktailListScreen from "~/features/cocktails/components/CocktailListScreen.vue";

defineOptions({ name: "CocktailCardPage" });

const route = useRoute();
const cocktailId = computed(() => String(route.params.cocktailId ?? ""));
</script>
