<template>
  <div>
    <Button
      label="Вернуться к результатам"
      icon="pi pi-arrow-left"
      severity="secondary"
      variant="text"
      size="small"
      @click="emit('back')"
    />
    <div class="mt-4">
      <LoadingIndicator v-if="detailQuery.isLoading.value" />
      <Message
        v-else-if="detailQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
      >
        Не удалось загрузить карточку продукции.
      </Message>
      <article v-else-if="product" class="flex flex-col gap-5">
        <header>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {{ typeLabel(product.type) }} · Только чтение
          </p>
          <h2 class="text-base mt-2 font-semibold tracking-tight">{{ product.name }}</h2>
          <p class="mt-2 text-sm text-color-secondary">{{ item.venueName }}</p>
          <p v-if="product.type === 'PREPARATION'" class="mt-2 text-sm text-color-secondary">
            {{ product.categoryName }}
          </p>
          <p v-if="product.type === 'COCKTAIL'" class="mt-2 text-sm text-color-secondary">
            <span v-if="product.glass">Посуда: {{ product.glass }}</span>
            <span v-if="product.ice"> · Лёд: {{ product.ice }}</span>
            <span v-if="product.preparationMethod"> · Метод: {{ product.preparationMethod }}</span>
          </p>
        </header>
        <Divider class="!my-0" />

        <section>
          <h3 class="text-sm font-semibold">Состав</h3>
          <ul class="mt-2 divide-y divide-surface">
            <li
              v-for="component in product.components"
              :key="component.id"
              class="flex justify-between gap-4 py-2 text-sm"
            >
              <span>{{ component.name }}</span>
              <span class="shrink-0 text-color-secondary"
                >{{ component.amount }} {{ component.unit }}</span
              >
            </li>
          </ul>
        </section>

        <section v-if="product.type === 'COCKTAIL' && product.garnishes.length">
          <h3 class="text-sm font-semibold">Гарниры</h3>
          <p class="mt-2 text-sm text-color-secondary">
            {{ product.garnishes.map((garnish) => garnish.name).join(", ") }}
          </p>
        </section>

        <section>
          <h3 class="text-sm font-semibold">Технология приготовления</h3>
          <p class="mt-2 whitespace-pre-line text-sm leading-6">{{ product.technology }}</p>
        </section>

        <section v-if="product.output || product.comment">
          <p v-if="product.output" class="text-sm">
            Выход: {{ product.output.amount }} {{ product.output.unit }}
          </p>
          <p v-if="product.comment" class="mt-2 whitespace-pre-line text-sm text-color-secondary">
            {{ product.comment }}
          </p>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { companyProductsControllerGetCompanyProduct } from "@bartech/api-client";
import type { companyProductsControllerGetCompanyProductResponse200 } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import type { WorkspaceSearchItem } from "../composables/useWorkspaceProductSearch";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{ companyId: string; item: WorkspaceSearchItem }>();
const emit = defineEmits<{ back: [] }>();
const identity = useIdentityFlow();
const detailQuery = useQuery({
  queryKey: computed(() => [
    "company-product-search-card",
    props.companyId,
    props.item.venueId,
    props.item.type,
    props.item.id,
  ]),
  enabled: computed(() => Boolean(props.item.venueId)),
  retry: false,
  queryFn: async ({
    signal,
  }): Promise<companyProductsControllerGetCompanyProductResponse200["data"]> => {
    const typePath: Record<string, string> = {
      COCKTAIL: "cocktails",
      PREPARATION: "preparations",
      GARNISH: "garnishes",
    };
    const response = await companyProductsControllerGetCompanyProduct(
      props.companyId,
      typePath[props.item.type] ?? "",
      props.item.id,
      { venueId: props.item.venueId ?? "" },
      { credentials: "include", signal },
      identity.apiFetch,
    );
    return requestApi<companyProductsControllerGetCompanyProductResponse200["data"]>(
      Promise.resolve(response),
    );
  },
});
const product = computed(() => detailQuery.data.value ?? null);

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    COCKTAIL: "Коктейль",
    PREPARATION: "Заготовка",
    GARNISH: "Гарнир",
  };
  return labels[type] ?? "Продукция";
}
</script>
