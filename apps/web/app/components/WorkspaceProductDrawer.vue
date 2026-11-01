<template>
  <CocktailCardDrawer
    v-if="cocktailId"
    :visible="true"
    :cocktail-id="cocktailId"
    read-only
    :workspace="props.workspace"
    @update:visible="close"
  />
  <PreparationCardDrawer
    v-else-if="preparationId"
    :visible="true"
    :preparation-id="preparationId"
    read-only
    :workspace="props.workspace"
    @update:visible="close"
  />
  <GarnishCardDrawer
    v-else-if="garnishId"
    :visible="true"
    :garnish-id="garnishId"
    read-only
    :workspace="props.workspace"
    @update:visible="close"
  />
  <ArchiveProductDrawer
    v-else-if="archiveProductId"
    :visible="true"
    :product-id="archiveProductId"
    :workspace="props.workspace"
    @update:visible="close"
  />
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import { ArchiveProductDrawer } from "~/features/archive";
import { CocktailCardDrawer } from "~/features/cocktails";
import { GarnishCardDrawer } from "~/features/garnishes";
import { PreparationCardDrawer } from "~/features/preparations";
import { useWorkspaceProductDrawer } from "~/composables/useWorkspaceProductDrawer";

const props = defineProps<{ workspace: Workspace }>();
const route = useRoute();
const { close, target } = useWorkspaceProductDrawer();
const cocktailId = computed(() =>
  target.value?.type === "COCKTAIL" && target.value.status === "ACTIVE" ? target.value.id : "",
);
const preparationId = computed(() =>
  target.value?.type === "PREPARATION" && target.value.status === "ACTIVE" ? target.value.id : "",
);
const garnishId = computed(() =>
  target.value?.type === "GARNISH" && target.value.status === "ACTIVE" ? target.value.id : "",
);
const archiveProductId = computed(() =>
  target.value?.status === "ARCHIVED" ? target.value.id : "",
);
watch(
  () => route.fullPath,
  () => close(),
);
</script>
