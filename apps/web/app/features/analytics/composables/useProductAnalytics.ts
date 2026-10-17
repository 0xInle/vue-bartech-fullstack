import { analyticsControllerCreate } from "@bartech/api-client";
import type { ProductAnalyticsEventDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { analyticsDeviceType } from "../utils/device-type";

type ProductType = NonNullable<ProductAnalyticsEventDto["productType"]>;
type ErrorCategory = NonNullable<ProductAnalyticsEventDto["errorCategory"]>;
type ProductEvent = {
  eventType:
    | "PRODUCT_OPENED"
    | "PRODUCT_CREATE_STARTED"
    | "PRODUCT_CREATE_COMPLETED"
    | "PRODUCT_ARCHIVED"
    | "PRODUCT_RESTORED";
  productType: ProductType;
};
type ProductAnalyticsInput =
  | { eventType: "SEARCH_USED" | "SEARCH_EMPTY" }
  | ProductEvent
  | { eventType: "TECHNICAL_ERROR"; errorCategory: ErrorCategory; result: "FAILURE" };

export function useProductAnalytics() {
  const identity = useIdentityFlow();

  async function track(input: ProductAnalyticsInput): Promise<void> {
    if (import.meta.server) return;
    try {
      if (!identity.csrfToken.value) await identity.refreshCsrf();
      await analyticsControllerCreate(
        {
          ...input,
          eventId: crypto.randomUUID(),
          deviceType: analyticsDeviceType(),
        },
        { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
        identity.apiFetch,
      );
    } catch {
      // Аналитика не должна менять результат пользовательской операции.
    }
  }

  return { track };
}
