<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal/service-access" class="text-sm font-semibold text-primary"
        >К списку доступов</NuxtLink
      >
      <h1 class="text-xl mt-4 font-semibold tracking-tight">Служебная работа с продукцией</h1>
      <Message severity="info" :closable="false" class="mt-3">
        Активная сессия · компания {{ companyId }} · заведение {{ venueId }}. Доступ действует
        только в этой области; состояние сессии проверяется сервером при каждом запросе.
      </Message>
    </header>

    <Message
      v-if="!auth.state.user || !auth.state.user.permissions.includes('service_access')"
      severity="error"
      :closable="false"
      >Нет разрешения на служебный доступ.</Message
    >
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>
    <div v-else class="space-y-5">
      <Card>
        <template #title>Поиск продукции</template>
        <template #content>
          <InputText
            v-model="productSearch.searchText.value"
            size="small"
            minlength="2"
            maxlength="160"
            placeholder="Название продукции"
            class="w-full"
          />
          <ul v-if="searchResults.length" class="mt-3 divide-y divide-surface">
            <li v-for="item in searchResults" :key="item.id" class="py-2 text-sm">
              <span class="font-medium">{{ item.name }}</span>
              <span class="ml-2 text-color-secondary">{{ item.type }}</span>
            </li>
          </ul>
        </template>
      </Card>

      <div class="grid gap-5 lg:grid-cols-3">
        <Card>
          <template #title>Ингредиенты</template>
          <template #content>
            <p class="mb-3 text-sm text-color-secondary">
              Локальные ингредиенты доступны только этому заведению.
            </p>
            <ul class="divide-y divide-surface">
              <li v-for="item in ingredientResults" :key="item.id" class="py-2 text-sm">
                <Button
                  :label="item.name"
                  severity="secondary"
                  variant="link"
                  size="small"
                  class="px-0"
                  @click="openIngredient(item.id)"
                />
              </li>
            </ul>
            <form class="mt-4 grid gap-2" @submit.prevent="createIngredient">
              <InputText
                v-model="ingredientName"
                required
                maxlength="160"
                size="small"
                placeholder="Название"
              />
              <Select
                v-model="categoryCode"
                :options="preparations.referencesQuery.data.value?.ingredientCategories ?? []"
                option-label="name"
                option-value="code"
                required
                size="small"
                placeholder="Категория"
              />
              <InputText
                v-model="brand"
                maxlength="120"
                size="small"
                placeholder="Бренд, необязательно"
              />
              <Button type="submit" label="Создать ингредиент" size="small" :loading="creating" />
            </form>
          </template>
        </Card>

        <Card>
          <template #title>Заготовки</template>
          <template #content>
            <Button
              label="Создать заготовку"
              size="small"
              class="mb-3"
              @click="openForm('preparation', 'create')"
            />
            <ul class="divide-y divide-surface">
              <li
                v-for="item in preparations.listQuery.data.value ?? []"
                :key="item.id"
                class="py-2"
              >
                <Button
                  :label="item.name"
                  severity="secondary"
                  variant="link"
                  size="small"
                  class="px-0"
                  @click="openForm('preparation', 'edit', item.id)"
                />
                <p class="text-xs text-color-secondary">{{ item.componentSummary }}</p>
              </li>
            </ul>
          </template>
        </Card>

        <Card>
          <template #title>Гарниры</template>
          <template #content>
            <Button
              label="Создать гарнир"
              size="small"
              class="mb-3"
              @click="openForm('garnish', 'create')"
            />
            <ul class="divide-y divide-surface">
              <li v-for="item in garnishes.listQuery.data.value ?? []" :key="item.id" class="py-2">
                <Button
                  :label="item.name"
                  severity="secondary"
                  variant="link"
                  size="small"
                  class="px-0"
                  @click="openForm('garnish', 'edit', item.id)"
                />
                <p class="text-xs text-color-secondary">{{ item.componentSummary }}</p>
              </li>
            </ul>
          </template>
        </Card>

        <Card class="lg:col-span-3">
          <template #title>Коктейли</template>
          <template #content>
            <Button
              label="Создать коктейль"
              size="small"
              class="mb-3"
              @click="openForm('cocktail', 'create')"
            />
            <ul class="grid gap-2 sm:grid-cols-2">
              <li
                v-for="item in cocktails.listQuery.data.value ?? []"
                :key="item.id"
                class="rounded border border-surface p-3"
              >
                <Button
                  :label="item.name"
                  severity="secondary"
                  variant="link"
                  size="small"
                  class="px-0"
                  @click="openForm('cocktail', 'edit', item.id)"
                />
                <p class="text-xs text-color-secondary">{{ item.componentSummary }}</p>
              </li>
            </ul>
          </template>
        </Card>
      </div>

      <LoadingIndicator v-if="loadingProducts" screen />
      <Button
        label="Завершить служебную сессию"
        severity="danger"
        size="small"
        :loading="ending"
        @click="endSession"
      />
    </div>

    <PreparationFormDrawer
      v-if="formType === 'preparation' && (formMode === 'create' || preparationQuery.data.value)"
      :visible="formVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :service-session-id="serviceSessionId"
      :can-manage="true"
      :mode="formMode"
      :preparation="preparationQuery.data.value"
      @update:visible="formVisible = $event"
      @created="closeForm"
      @updated="closeForm"
    />
    <GarnishFormDrawer
      v-if="formType === 'garnish' && (formMode === 'create' || garnishQuery.data.value)"
      :visible="formVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :service-session-id="serviceSessionId"
      :can-manage="true"
      :mode="formMode"
      :garnish="garnishQuery.data.value"
      @update:visible="formVisible = $event"
      @created="closeForm"
      @updated="closeForm"
    />
    <CocktailFormDrawer
      v-if="formType === 'cocktail' && (formMode === 'create' || cocktailQuery.data.value)"
      :visible="formVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :service-session-id="serviceSessionId"
      :can-manage="true"
      :mode="formMode"
      :cocktail="cocktailQuery.data.value"
      @update:visible="formVisible = $event"
      @created="closeForm"
      @updated="closeForm"
    />
  </main>
  <Drawer
    :visible="Boolean(selectedIngredient)"
    position="right"
    :style="{ width: 'min(100vw, 36rem)' }"
    header="Редактировать локальный ингредиент"
    @update:visible="!$event && (selectedIngredient = null)"
  >
    <form v-if="selectedIngredient" class="grid gap-3" @submit.prevent="saveIngredient">
      <InputText
        v-model="selectedIngredient.name"
        required
        maxlength="160"
        size="small"
        placeholder="Название"
      />
      <Select
        v-model="selectedIngredient.ingredient.categoryCode"
        :options="ingredientCategoryOptions"
        option-label="name"
        option-value="code"
        required
        size="small"
        placeholder="Категория"
      />
      <Message
        v-if="!selectedIngredient.ingredient.category.isActive"
        severity="warn"
        :closable="false"
      >
        Текущая категория «{{ selectedIngredient.ingredient.category.name }}» неактивна. Её можно
        сохранить без изменения или выбрать активную категорию.
      </Message>
      <InputText
        v-model="selectedIngredient.ingredient.brand"
        maxlength="120"
        size="small"
        placeholder="Бренд"
      />
      <InputText
        v-model="selectedIngredient.ingredient.strength"
        inputmode="decimal"
        size="small"
        placeholder="Крепость"
      />
      <InputText
        v-model="selectedIngredient.ingredient.country"
        maxlength="80"
        size="small"
        placeholder="Страна"
      />
      <InputText
        v-model="selectedIngredient.ingredient.externalIdentifier"
        maxlength="120"
        size="small"
        placeholder="Внешний идентификатор"
      />
      <div class="flex justify-end gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          @click="selectedIngredient = null"
        />
        <Button type="submit" label="Сохранить" :loading="savingIngredient" />
      </div>
    </form>
  </Drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { identityControllerCsrf } from "@bartech/api-client";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useCocktails } from "~/features/cocktails/composables/useCocktails";
import CocktailFormDrawer from "~/features/cocktails/components/CocktailFormDrawer.vue";
import { useGarnishes } from "~/features/garnishes/composables/useGarnishes";
import GarnishFormDrawer from "~/features/garnishes/components/GarnishFormDrawer.vue";
import { usePreparations } from "~/features/preparations/composables/usePreparations";
import PreparationFormDrawer from "~/features/preparations/components/PreparationFormDrawer.vue";
import { useProductSearch } from "~/features/products/composables/useProductSearch";

defineOptions({ name: "InternalServiceProductsScreen" });

const auth = useInternalAuth();
const route = useRoute();
const apiFetch = useApiFetch();
const serviceSessionId = String(route.params.serviceSessionId);
const companyId = String(route.params.companyId);
const venueId = String(route.params.venueId);
const sessionReady = ref(false);
const canUseServiceAccess = computed(
  () => sessionReady.value && Boolean(auth.state.user?.permissions.includes("service_access")),
);
const serviceOptions = { serviceSessionId, enabled: canUseServiceAccess };
const preparations = usePreparations(
  () => companyId,
  () => venueId,
  serviceOptions,
);
const garnishes = useGarnishes(
  () => companyId,
  () => venueId,
  serviceOptions,
);
const cocktails = useCocktails(
  () => companyId,
  () => venueId,
  serviceOptions,
);
const productSearch = useProductSearch(
  () => companyId,
  () => venueId,
  serviceOptions,
);
const ingredientResults = computed(() =>
  (productSearch.searchQuery.data.value ?? []).filter((item) => item.type === "INGREDIENT"),
);
const searchResults = computed(() => productSearch.searchQuery.data.value ?? []);
const selectedProductId = ref("");
type InternalIngredientCard = {
  id: string;
  name: string;
  ingredient: {
    categoryCode: string;
    category: { code: string; name: string; isActive: boolean };
    brand: string | null;
    strength: string | null;
    country: string | null;
    externalIdentifier: string | null;
  };
};
const selectedIngredient = ref<InternalIngredientCard | null>(null);
const ingredientCategoryOptions = computed(() => {
  const active = preparations.referencesQuery.data.value?.ingredientCategories ?? [];
  if (selectedIngredient.value && !selectedIngredient.value.ingredient.category.isActive) {
    return [...active, selectedIngredient.value.ingredient.category];
  }
  return active;
});
const formType = ref<"preparation" | "garnish" | "cocktail" | "">("");
const formMode = ref<"create" | "edit">("create");
const formVisible = ref(false);
const ingredientName = ref("");
const categoryCode = ref("");
const brand = ref("");
const error = ref("");
const creating = ref(false);
const savingIngredient = ref(false);
const ending = ref(false);
const loadingProducts = computed(
  () =>
    preparations.listQuery.isLoading.value ||
    garnishes.listQuery.isLoading.value ||
    cocktails.listQuery.isLoading.value,
);
const preparationId = computed(() =>
  formType.value === "preparation" && formMode.value === "edit" ? selectedProductId.value : "",
);
const garnishId = computed(() =>
  formType.value === "garnish" && formMode.value === "edit" ? selectedProductId.value : "",
);
const cocktailId = computed(() =>
  formType.value === "cocktail" && formMode.value === "edit" ? selectedProductId.value : "",
);
const preparationQuery = preparations.preparationQuery(preparationId);
const garnishQuery = garnishes.garnishQuery(garnishId);
const cocktailQuery = cocktails.cocktailQuery(cocktailId);

onMounted(async () => {
  await auth.loadSession();
  sessionReady.value = true;
});

function openForm(type: "preparation" | "garnish" | "cocktail", mode: "create" | "edit", id = "") {
  formType.value = type;
  formMode.value = mode;
  selectedProductId.value = id;
  formVisible.value = true;
}

function closeForm() {
  formVisible.value = false;
  selectedProductId.value = "";
  formType.value = "";
}

async function createIngredient() {
  error.value = "";
  creating.value = true;
  try {
    const create = preparations.createLocalIngredient;
    await create({
      name: ingredientName.value,
      categoryCode: categoryCode.value,
      brand: brand.value || undefined,
    });
    ingredientName.value = "";
    categoryCode.value = "";
    brand.value = "";
    await productSearch.searchQuery.refetch();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось создать ингредиент";
  } finally {
    creating.value = false;
  }
}

async function openIngredient(productId: string) {
  error.value = "";
  try {
    selectedIngredient.value = await request<InternalIngredientCard>(
      `${serviceProductsPath()}/ingredients/${productId}`,
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось открыть ингредиент";
  }
}

async function saveIngredient() {
  if (!selectedIngredient.value) return;
  savingIngredient.value = true;
  error.value = "";
  try {
    const ingredient = selectedIngredient.value;
    await mutate(
      `${serviceProductsPath()}/ingredients/${ingredient.id}`,
      {
        name: ingredient.name,
        categoryCode: ingredient.ingredient.categoryCode,
        brand: ingredient.ingredient.brand || undefined,
        strength: ingredient.ingredient.strength
          ? Number(ingredient.ingredient.strength)
          : undefined,
        country: ingredient.ingredient.country || undefined,
        externalIdentifier: ingredient.ingredient.externalIdentifier || undefined,
      },
      "PATCH",
    );
    selectedIngredient.value = null;
    await Promise.all([productSearch.searchQuery.refetch(), preparations.listQuery.refetch()]);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось сохранить ингредиент";
  } finally {
    savingIngredient.value = false;
  }
}

async function endSession() {
  ending.value = true;
  try {
    await mutate(`/api/v1/internal/service-access/sessions/${serviceSessionId}/end`);
    await navigateTo("/internal/service-access");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось завершить сессию";
  } finally {
    ending.value = false;
  }
}

function serviceProductsPath() {
  return `/api/v1/internal/service-sessions/${serviceSessionId}/companies/${companyId}/venues/${venueId}/products`;
}

async function request<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { credentials: "include" });
  return readResponse<T>(response);
}

async function mutate(path: string, body?: unknown, method = "POST") {
  const csrf = await identityControllerCsrf({ credentials: "include" }, apiFetch);
  if (csrf.status < 200 || csrf.status >= 300) throw new Error("Не удалось проверить запрос");
  const response = await apiFetch(path, {
    method,
    credentials: "include",
    headers: {
      "x-csrf-token": csrf.data.token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return readResponse(response);
}

async function readResponse<T = void>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) throw new Error(body.detail ?? "Не удалось выполнить запрос");
  return body as T;
}
</script>
