<template>
  <CocktailCardScreen :cocktail-id="cocktailId" />
</template>

<script setup lang="ts">
import CocktailCardScreen from "~/features/cocktails/components/CocktailCardScreen.vue";

defineOptions({ name: "CocktailCardPage" });

const route = useRoute();
const cocktailId = computed(() => String(route.params.cocktailId ?? ""));
</script>
