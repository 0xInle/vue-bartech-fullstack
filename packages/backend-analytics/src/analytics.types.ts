export const ANALYTICS_EVENT_TYPES = [
  "SEARCH_USED",
  "SEARCH_EMPTY",
  "PRODUCT_OPENED",
  "PRODUCT_CREATE_STARTED",
  "PRODUCT_CREATE_COMPLETED",
  "PRODUCT_ARCHIVED",
  "PRODUCT_RESTORED",
  "TECHNICAL_ERROR",
] as const;

export const ANALYTICS_DEVICE_TYPES = ["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"] as const;
export const ANALYTICS_PRODUCT_TYPES = [
  "INGREDIENT",
  "PREPARATION",
  "GARNISH",
  "COCKTAIL",
] as const;
export const ANALYTICS_ERROR_CATEGORIES = ["NETWORK", "API", "VALIDATION", "UNKNOWN"] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
export type AnalyticsDeviceType = (typeof ANALYTICS_DEVICE_TYPES)[number];
export type AnalyticsProductType = (typeof ANALYTICS_PRODUCT_TYPES)[number];
export type AnalyticsErrorCategory = (typeof ANALYTICS_ERROR_CATEGORIES)[number];

export type ProductAnalyticsJob = {
  eventId: string;
  occurredAt: string;
  eventType: AnalyticsEventType;
  deviceType: AnalyticsDeviceType;
  productType?: AnalyticsProductType;
  errorCategory?: AnalyticsErrorCategory;
  result?: "FAILURE";
};
