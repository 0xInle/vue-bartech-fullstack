import type {
  productsControllerCreateIngredientResponse201,
  productsControllerSearchResponse200,
} from "@bartech/api-client";

export type ProductSearchItemResponse = productsControllerSearchResponse200["data"][number];

/** Позиция каталога, доступная для выбора в составе технологической карты. */
export type ProductSearchItem = Omit<ProductSearchItemResponse, "venueId"> & {
  venueId: string | null;
};

/** Результат создания локального ингредиента в текущем заведении. */
export type ProductCreated = productsControllerCreateIngredientResponse201["data"];

export function normalizeProductSearchItem(item: ProductSearchItemResponse): ProductSearchItem {
  return { ...item, venueId: typeof item.venueId === "string" ? item.venueId : null };
}
